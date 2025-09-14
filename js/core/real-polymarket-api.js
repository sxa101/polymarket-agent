import { ProductionConfig, Environment } from '../config/production-config.js';
import { Logger } from '../utils/logger.js';

export class RealPolymarketAPI {
    constructor() {
        this.config = ProductionConfig;
        this.logger = new Logger('RealPolymarketAPI');
        
        this.clobBaseURL = this.config.POLYMARKET_APIS.CLOB_BASE;
        this.gammaBaseURL = this.config.POLYMARKET_APIS.GAMMA_BASE;
        this.wsURL = this.config.POLYMARKET_APIS.WEBSOCKET;
        
        this.headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'PolymarketTradingAgent/1.0'
        };
        
        this.rateLimitDelay = 1000 / this.config.RATE_LIMITS.API_CALLS_PER_SECOND;
        this.lastRequestTime = 0;
        this.requestQueue = [];
        this.isProcessingQueue = false;
        
        // Circuit breaker for error handling
        this.circuitBreaker = {
            failures: 0,
            isOpen: false,
            lastFailureTime: 0
        };
    }

    async initialize() {
        this.logger.info('Initializing Real Polymarket API...');
        
        try {
            // Validate configuration
            const configValidation = this.validateConfiguration();
            if (!configValidation.isValid) {
                throw new Error(`Configuration invalid: ${configValidation.errors.join(', ')}`);
            }
            
            // Test API connectivity
            await this.healthCheck();
            
            this.logger.info('Real Polymarket API initialized successfully');
            return true;
            
        } catch (error) {
            this.logger.error('Failed to initialize Real Polymarket API:', error);
            throw error;
        }
    }

    validateConfiguration() {
        const errors = [];
        
        if (!this.clobBaseURL) errors.push('Missing CLOB API URL');
        if (!this.gammaBaseURL) errors.push('Missing Gamma API URL');
        if (!this.wsURL) errors.push('Missing WebSocket URL');
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    async healthCheck() {
        try {
            const response = await this.makeRequest(`${this.gammaBaseURL}/markets?limit=1`);
            this.logger.info('API health check passed');
            return true;
        } catch (error) {
            this.logger.error('API health check failed:', error);
            throw new Error('Polymarket API is not accessible');
        }
    }

    async makeRequest(url, options = {}) {
        // Check circuit breaker
        if (this.circuitBreaker.isOpen) {
            const timeSinceFailure = Date.now() - this.circuitBreaker.lastFailureTime;
            if (timeSinceFailure < this.config.ERROR_HANDLING.CIRCUIT_BREAKER_TIMEOUT) {
                throw new Error('Circuit breaker is open - API temporarily unavailable');
            } else {
                // Reset circuit breaker
                this.circuitBreaker.isOpen = false;
                this.circuitBreaker.failures = 0;
            }
        }

        return new Promise((resolve, reject) => {
            this.requestQueue.push({ url, options, resolve, reject });
            this.processQueue();
        });
    }

    async processQueue() {
        if (this.isProcessingQueue || this.requestQueue.length === 0) {
            return;
        }

        this.isProcessingQueue = true;

        while (this.requestQueue.length > 0) {
            const { url, options, resolve, reject } = this.requestQueue.shift();
            
            try {
                // Rate limiting
                const now = Date.now();
                const timeSinceLastRequest = now - this.lastRequestTime;
                if (timeSinceLastRequest < this.rateLimitDelay) {
                    await this.delay(this.rateLimitDelay - timeSinceLastRequest);
                }

                const response = await fetch(url, {
                    ...options,
                    headers: {
                        ...this.headers,
                        ...options.headers
                    }
                });

                this.lastRequestTime = Date.now();

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();
                
                // Reset circuit breaker on success
                this.circuitBreaker.failures = 0;
                
                resolve(data);

            } catch (error) {
                this.handleRequestError(error);
                reject(error);
            }
        }

        this.isProcessingQueue = false;
    }

    handleRequestError(error) {
        this.circuitBreaker.failures++;
        this.circuitBreaker.lastFailureTime = Date.now();
        
        if (this.circuitBreaker.failures >= this.config.ERROR_HANDLING.CIRCUIT_BREAKER_THRESHOLD) {
            this.circuitBreaker.isOpen = true;
            this.logger.warn('Circuit breaker opened due to repeated failures');
        }
        
        this.logger.error('API request failed:', error);
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // CRITICAL: Real crypto market discovery (Updated for actual market types)
    async fetchRealCryptoMarkets() {
        try {
            this.logger.info('Fetching real crypto markets...');
            
            // Use the correct API parameter for current markets
            const response = await this.makeRequest(
                `${this.gammaBaseURL}/markets?closed=false&limit=100&offset=0`
            );
            
            if (!Array.isArray(response)) {
                throw new Error('Invalid response format from markets API');
            }
            
            // Filter for crypto markets (updated for real market types)
            const cryptoMarkets = response.filter(market => {
                return this.isRealCryptoMarket(market);
            });
            
            this.logger.info(`Found ${cryptoMarkets.length} real crypto markets out of ${response.length} total markets`);
            
            // Transform to our internal format
            return cryptoMarkets.map(market => this.transformMarketData(market));
            
        } catch (error) {
            this.logger.error('Failed to fetch real crypto markets:', error);
            
            // Fallback behavior based on configuration
            if (this.config.ERROR_HANDLING.FALLBACK_TO_DEMO) {
                this.logger.warn('Falling back to demo data due to API failure');
                return [];
            }
            
            throw error;
        }
    }

    // NEW: Real crypto market detection (updated for actual market types)
    isRealCryptoMarket(market) {
        try {
            const question = market.question?.toLowerCase() || '';
            const description = market.description?.toLowerCase() || '';
            
            // Check for crypto-related content (expanded list)
            const cryptoTerms = [
                'bitcoin', 'btc',
                'ethereum', 'eth',
                'crypto', 'cryptocurrency',
                'solana', 'sol',
                'cardano', 'ada',
                'polygon', 'matic',
                'avalanche', 'avax',
                'polkadot', 'dot',
                'chainlink', 'link',
                'uniswap', 'uni',
                'tether', 'usdt', 'usdc',
                'coinbase', 'binance'
            ];
            
            const hasCryptoContent = cryptoTerms.some(term => 
                question.includes(term) || description.includes(term)
            );
            
            if (!hasCryptoContent) return false;
            
            // Check market is active (not expired)
            const endDate = new Date(market.endDate || 0);
            const now = new Date();
            const isActive = endDate > now;
            
            if (!isActive) return false;
            
            // Check volume threshold (much lower for real markets)
            const volume = parseFloat(market.volume || '0');
            const hasVolume = volume >= 1000; // $1000 minimum volume
            
            if (!hasVolume) return false;
            
            // Prioritize high-volume crypto markets
            const isHighVolume = volume >= 100000; // $100k+ volume
            const isPriceMarket = question.includes('reach') || 
                                  question.includes('hit') || 
                                  question.includes('dip') || 
                                  question.includes('price');
            
            if (isHighVolume && isPriceMarket) {
                this.logger.debug(`Found high-volume crypto price market: ${market.question}`);
                return true;
            }
            
            // Also include other crypto-related markets
            const isCryptoEvent = question.includes('insolvent') || 
                                  question.includes('depeg') ||
                                  question.includes('ceo') ||
                                  question.includes('coinbase');
            
            if (isCryptoEvent && hasVolume) {
                this.logger.debug(`Found crypto event market: ${market.question}`);
                return true;
            }
            
            return false;
            
        } catch (error) {
            this.logger.error('Error checking market validity:', error);
            return false;
        }
    }

    checkMarketDuration(market) {
        if (!market.startDate || !market.endDate) return false;
        
        const startTime = new Date(market.startDate);
        const endTime = new Date(market.endDate);
        const duration = endTime - startTime;
        
        // Allow some tolerance (±2 minutes) for 15-minute markets
        const tolerance = 2 * 60 * 1000; // 2 minutes
        const expectedDuration = this.config.MARKET_FILTERS.DURATION_15MIN;
        
        return Math.abs(duration - expectedDuration) <= tolerance;
    }

    checkChainlinkIntegration(market) {
        // Look for Chainlink-specific metadata
        return market.oracle?.includes('chainlink') || 
               market.oracleSource === 'chainlink' ||
               market.metadata?.oracle === 'chainlink' ||
               market.automatedResolution === true;
    }

    transformMarketData(rawMarket) {
        return {
            id: rawMarket.id,
            marketId: rawMarket.id,
            asset: this.extractAssetFromMarket(rawMarket),
            question: rawMarket.question,
            description: rawMarket.description,
            startTime: new Date(rawMarket.startDate || rawMarket.createdAt).getTime(),
            endTime: new Date(rawMarket.endDate || rawMarket.resolutionDate).getTime(),
            status: rawMarket.active ? 'active' : rawMarket.closed ? 'closed' : 'unknown',
            outcomes: rawMarket.outcomes || ['Yes', 'No'],
            tokens: rawMarket.tokens || [],
            volume: parseFloat(rawMarket.volume || '0'),
            liquidity: parseFloat(rawMarket.liquidity || '0'),
            currentPrice: this.calculateCurrentPrice(rawMarket),
            yesShares: {
                price: parseFloat(rawMarket.yesPrice || '0.5'),
                volume: parseFloat(rawMarket.yesVolume || '0')
            },
            noShares: {
                price: parseFloat(rawMarket.noPrice || '0.5'),
                volume: parseFloat(rawMarket.noVolume || '0')
            },
            metadata: {
                category: rawMarket.category,
                subCategory: rawMarket.subCategory,
                image: rawMarket.image,
                tags: rawMarket.tags || [],
                oracle: rawMarket.oracle,
                chainlinkReference: rawMarket.chainlinkFeedId
            },
            updatedAt: Date.now()
        };
    }

    extractAssetFromMarket(market) {
        const text = (market.question + ' ' + (market.description || '')).toLowerCase();
        
        for (const asset of this.config.MARKET_FILTERS.CRYPTO_ASSETS) {
            if (text.includes(asset.toLowerCase())) {
                return asset;
            }
        }
        
        return 'UNKNOWN';
    }

    calculateCurrentPrice(market) {
        // Calculate current mid-price from yes/no shares
        const yesPrice = parseFloat(market.yesPrice || '0.5');
        const noPrice = parseFloat(market.noPrice || '0.5');
        
        // Ensure prices sum to approximately 1.0
        if (Math.abs((yesPrice + noPrice) - 1.0) > 0.1) {
            return 0.5; // Default if prices seem invalid
        }
        
        return yesPrice;
    }

    // Real order book data
    async getRealOrderBook(marketId) {
        try {
            const response = await this.makeRequest(`${this.clobBaseURL}/book?market=${marketId}`);
            
            return {
                bids: response.bids?.map(bid => ({
                    price: parseFloat(bid.price),
                    size: parseFloat(bid.size),
                    timestamp: bid.timestamp || Date.now()
                })) || [],
                asks: response.asks?.map(ask => ({
                    price: parseFloat(ask.price),
                    size: parseFloat(ask.size),
                    timestamp: ask.timestamp || Date.now()
                })) || [],
                spread: this.calculateSpread(response.bids, response.asks),
                timestamp: Date.now()
            };
            
        } catch (error) {
            this.logger.error(`Failed to get order book for ${marketId}:`, error);
            throw error;
        }
    }

    calculateSpread(bids, asks) {
        if (!bids?.length || !asks?.length) return 0;
        
        const bestBid = Math.max(...bids.map(b => parseFloat(b.price)));
        const bestAsk = Math.min(...asks.map(a => parseFloat(a.price)));
        
        return bestAsk - bestBid;
    }

    // Real midpoint prices
    async getRealMidpoint(marketId) {
        try {
            const response = await this.makeRequest(`${this.clobBaseURL}/midpoint?market=${marketId}`);
            
            return {
                yes: parseFloat(response.yes),
                no: parseFloat(response.no),
                timestamp: Date.now()
            };
            
        } catch (error) {
            this.logger.error(`Failed to get midpoint for ${marketId}:`, error);
            throw error;
        }
    }

    // Search and filtering
    async searchRealMarkets(query) {
        try {
            const allMarkets = await this.fetchReal15MinuteCryptoMarkets();
            const lowerQuery = query.toLowerCase();
            
            return allMarkets.filter(market => 
                market.question.toLowerCase().includes(lowerQuery) ||
                market.description?.toLowerCase().includes(lowerQuery) ||
                market.asset.toLowerCase().includes(lowerQuery)
            );
            
        } catch (error) {
            this.logger.error('Failed to search markets:', error);
            throw error;
        }
    }

    async getMarketsByAsset(asset) {
        try {
            const allMarkets = await this.fetchReal15MinuteCryptoMarkets();
            return allMarkets.filter(market => 
                market.asset.toUpperCase() === asset.toUpperCase()
            );
            
        } catch (error) {
            this.logger.error(`Failed to get markets for asset ${asset}:`, error);
            throw error;
        }
    }

    // Market status and metadata
    async getMarketDetails(marketId) {
        try {
            const response = await this.makeRequest(`${this.gammaBaseURL}/markets/${marketId}`);
            return this.transformMarketData(response);
            
        } catch (error) {
            this.logger.error(`Failed to get market details for ${marketId}:`, error);
            throw error;
        }
    }

    // Trading-related methods (placeholder for wallet integration)
    async placeRealOrder(orderData, walletSignature) {
        if (!this.config.FEATURES.ENABLE_TRADING) {
            throw new Error('Trading is disabled in current configuration');
        }
        
        if (!walletSignature) {
            throw new Error('Wallet signature required for real trading');
        }
        
        try {
            // This would integrate with wallet manager for real order placement
            const response = await this.makeRequest(`${this.clobBaseURL}/order`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${walletSignature}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ...orderData,
                    timestamp: Date.now()
                })
            });
            
            return response;
            
        } catch (error) {
            this.logger.error('Failed to place real order:', error);
            throw error;
        }
    }

    // Statistics and monitoring
    getAPIStatistics() {
        return {
            circuitBreakerStatus: {
                isOpen: this.circuitBreaker.isOpen,
                failures: this.circuitBreaker.failures,
                lastFailureTime: this.circuitBreaker.lastFailureTime
            },
            queueStatus: {
                pending: this.requestQueue.length,
                isProcessing: this.isProcessingQueue
            },
            rateLimiting: {
                delay: this.rateLimitDelay,
                lastRequestTime: this.lastRequestTime
            },
            configuration: {
                environment: Environment.isDevelopment() ? 'development' : 'production',
                testnetMode: this.config.FEATURES.TESTNET_MODE,
                tradingEnabled: this.config.FEATURES.ENABLE_TRADING
            }
        };
    }
}