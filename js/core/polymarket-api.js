import { Logger } from '../utils/logger.js';

export class PolymarketAPI {
    constructor() {
        this.baseUrl = 'https://clob.polymarket.com';
        this.gammaUrl = 'https://gamma-api.polymarket.com';
        this.logger = new Logger('PolymarketAPI');
        
        this.headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
        
        this.rateLimitDelay = 100; // ms between requests
        this.lastRequestTime = 0;
        this.requestQueue = [];
        this.isProcessingQueue = false;
    }

    async makeRequest(url, options = {}) {
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
                    throw new Error(`HTTP error! status: ${response.status}, statusText: ${response.statusText}`);
                }

                const data = await response.json();
                resolve(data);

            } catch (error) {
                this.logger.error(`Request failed for ${url}:`, error);
                reject(error);
            }
        }

        this.isProcessingQueue = false;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Market Discovery
    async getMarkets(limit = 100, offset = 0) {
        try {
            const url = `${this.gammaUrl}/markets?limit=${limit}&offset=${offset}&active=true`;
            const response = await this.makeRequest(url);
            
            // Filter for 15-minute crypto markets
            const cryptoMarkets = response.filter(market => 
                this.isCrypto15MinMarket(market)
            );

            return cryptoMarkets.map(market => this.transformMarketData(market));
        } catch (error) {
            this.logger.error('Failed to fetch markets:', error);
            throw error;
        }
    }

    async getMarket(marketId) {
        try {
            const url = `${this.gammaUrl}/markets/${marketId}`;
            const response = await this.makeRequest(url);
            return this.transformMarketData(response);
        } catch (error) {
            this.logger.error(`Failed to fetch market ${marketId}:`, error);
            throw error;
        }
    }

    async getEvents() {
        try {
            const url = `${this.gammaUrl}/events?active=true`;
            const response = await this.makeRequest(url);
            return response.filter(event => 
                event.title && event.title.toLowerCase().includes('crypto')
            );
        } catch (error) {
            this.logger.error('Failed to fetch events:', error);
            throw error;
        }
    }

    // Market Data
    async getOrderBook(marketId) {
        try {
            const url = `${this.baseUrl}/book?market=${marketId}`;
            const response = await this.makeRequest(url);
            return this.transformOrderBookData(response);
        } catch (error) {
            this.logger.error(`Failed to fetch order book for ${marketId}:`, error);
            throw error;
        }
    }

    async getMidpoint(marketId) {
        try {
            const url = `${this.baseUrl}/midpoint?market=${marketId}`;
            const response = await this.makeRequest(url);
            return {
                yes: parseFloat(response.yes),
                no: parseFloat(response.no),
                timestamp: Date.now()
            };
        } catch (error) {
            this.logger.error(`Failed to fetch midpoint for ${marketId}:`, error);
            throw error;
        }
    }

    async getLastTradePrice(marketId) {
        try {
            const url = `${this.baseUrl}/last-trade-price?market=${marketId}`;
            const response = await this.makeRequest(url);
            return {
                price: parseFloat(response.price),
                side: response.side,
                timestamp: response.timestamp
            };
        } catch (error) {
            this.logger.error(`Failed to fetch last trade price for ${marketId}:`, error);
            throw error;
        }
    }

    // Trading Operations (require authentication)
    async placeOrder(order, signature) {
        try {
            const url = `${this.baseUrl}/order`;
            const response = await this.makeRequest(url, {
                method: 'POST',
                headers: {
                    'POLY_SIGNATURE': signature,
                    'POLY_TIMESTAMP': Date.now().toString(),
                    'POLY_NONCE': this.generateNonce()
                },
                body: JSON.stringify(order)
            });
            return response;
        } catch (error) {
            this.logger.error('Failed to place order:', error);
            throw error;
        }
    }

    async cancelOrder(orderId, signature) {
        try {
            const url = `${this.baseUrl}/order/${orderId}`;
            const response = await this.makeRequest(url, {
                method: 'DELETE',
                headers: {
                    'POLY_SIGNATURE': signature,
                    'POLY_TIMESTAMP': Date.now().toString(),
                    'POLY_NONCE': this.generateNonce()
                }
            });
            return response;
        } catch (error) {
            this.logger.error(`Failed to cancel order ${orderId}:`, error);
            throw error;
        }
    }

    async getOrders(address, signature) {
        try {
            const url = `${this.baseUrl}/orders?owner=${address}`;
            const response = await this.makeRequest(url, {
                headers: {
                    'POLY_SIGNATURE': signature,
                    'POLY_TIMESTAMP': Date.now().toString(),
                    'POLY_NONCE': this.generateNonce()
                }
            });
            return response;
        } catch (error) {
            this.logger.error('Failed to fetch orders:', error);
            throw error;
        }
    }

    async getTrades(address, signature) {
        try {
            const url = `${this.baseUrl}/trades?maker=${address}`;
            const response = await this.makeRequest(url, {
                headers: {
                    'POLY_SIGNATURE': signature,
                    'POLY_TIMESTAMP': Date.now().toString(),
                    'POLY_NONCE': this.generateNonce()
                }
            });
            return response;
        } catch (error) {
            this.logger.error('Failed to fetch trades:', error);
            throw error;
        }
    }

    // Helper methods
    isCrypto15MinMarket(market) {
        const title = market.question?.toLowerCase() || '';
        const description = market.description?.toLowerCase() || '';
        
        // Check for crypto keywords
        const cryptoKeywords = ['btc', 'bitcoin', 'eth', 'ethereum', 'sol', 'solana', 'crypto', 'cryptocurrency'];
        const hasCryptoKeyword = cryptoKeywords.some(keyword => 
            title.includes(keyword) || description.includes(keyword)
        );

        // Check for 15-minute timeframe
        const timeKeywords = ['15 min', '15-min', '15 minute', 'fifteen minute'];
        const hasTimeKeyword = timeKeywords.some(keyword => 
            title.includes(keyword) || description.includes(keyword)
        );

        // Check for up/down prediction
        const predictionKeywords = ['higher', 'lower', 'up', 'down', 'above', 'below'];
        const hasPredictionKeyword = predictionKeywords.some(keyword => 
            title.includes(keyword) || description.includes(keyword)
        );

        return hasCryptoKeyword && hasTimeKeyword && hasPredictionKeyword;
    }

    transformMarketData(rawMarket) {
        try {
            return {
                id: rawMarket.id,
                marketId: rawMarket.id,
                asset: this.extractAssetFromMarket(rawMarket),
                question: rawMarket.question,
                description: rawMarket.description,
                startTime: new Date(rawMarket.startDate || rawMarket.createdAt).getTime(),
                endTime: new Date(rawMarket.endDate || rawMarket.resolutionDate).getTime(),
                status: rawMarket.closed ? 'closed' : 'active',
                outcomes: rawMarket.outcomes || ['Yes', 'No'],
                tokens: rawMarket.tokens || [],
                volume: parseFloat(rawMarket.volume || '0'),
                liquidity: parseFloat(rawMarket.liquidity || '0'),
                metadata: {
                    category: rawMarket.category,
                    subCategory: rawMarket.subCategory,
                    image: rawMarket.image,
                    tags: rawMarket.tags || []
                },
                chainlinkReference: rawMarket.oracleData?.reference,
                updatedAt: Date.now()
            };
        } catch (error) {
            this.logger.error('Failed to transform market data:', error);
            return null;
        }
    }

    extractAssetFromMarket(market) {
        const text = (market.question + ' ' + market.description).toLowerCase();
        
        // Common crypto assets
        const assets = {
            'btc': 'BTC',
            'bitcoin': 'BTC',
            'eth': 'ETH', 
            'ethereum': 'ETH',
            'sol': 'SOL',
            'solana': 'SOL',
            'ada': 'ADA',
            'cardano': 'ADA',
            'dot': 'DOT',
            'polkadot': 'DOT',
            'matic': 'MATIC',
            'polygon': 'MATIC',
            'avax': 'AVAX',
            'avalanche': 'AVAX'
        };

        for (const [keyword, symbol] of Object.entries(assets)) {
            if (text.includes(keyword)) {
                return symbol;
            }
        }

        return 'UNKNOWN';
    }

    transformOrderBookData(rawOrderBook) {
        try {
            return {
                bids: rawOrderBook.bids?.map(bid => ({
                    price: parseFloat(bid.price),
                    size: parseFloat(bid.size),
                    timestamp: bid.timestamp
                })) || [],
                asks: rawOrderBook.asks?.map(ask => ({
                    price: parseFloat(ask.price),
                    size: parseFloat(ask.size),
                    timestamp: ask.timestamp
                })) || [],
                spread: this.calculateSpread(rawOrderBook.bids, rawOrderBook.asks),
                timestamp: Date.now()
            };
        } catch (error) {
            this.logger.error('Failed to transform order book data:', error);
            return { bids: [], asks: [], spread: 0, timestamp: Date.now() };
        }
    }

    calculateSpread(bids, asks) {
        if (!bids?.length || !asks?.length) return 0;
        
        const bestBid = Math.max(...bids.map(b => parseFloat(b.price)));
        const bestAsk = Math.min(...asks.map(a => parseFloat(a.price)));
        
        return bestAsk - bestBid;
    }

    generateNonce() {
        return Date.now().toString() + Math.random().toString(36).substring(2);
    }

    // Market filtering and search
    async searchMarkets(query) {
        try {
            const markets = await this.getMarkets(200);
            const lowerQuery = query.toLowerCase();
            
            return markets.filter(market => 
                market.question.toLowerCase().includes(lowerQuery) ||
                market.description.toLowerCase().includes(lowerQuery) ||
                market.asset.toLowerCase().includes(lowerQuery)
            );
        } catch (error) {
            this.logger.error('Failed to search markets:', error);
            throw error;
        }
    }

    async getMarketsByAsset(asset) {
        try {
            const markets = await this.getMarkets(200);
            return markets.filter(market => 
                market.asset.toUpperCase() === asset.toUpperCase()
            );
        } catch (error) {
            this.logger.error(`Failed to get markets for asset ${asset}:`, error);
            throw error;
        }
    }

    async getActiveMarkets() {
        try {
            const markets = await this.getMarkets(200);
            const now = Date.now();
            
            return markets.filter(market => 
                market.status === 'active' &&
                market.startTime <= now &&
                market.endTime > now
            );
        } catch (error) {
            this.logger.error('Failed to get active markets:', error);
            throw error;
        }
    }

    async getUpcomingMarkets(hoursAhead = 24) {
        try {
            const markets = await this.getMarkets(200);
            const now = Date.now();
            const futureTime = now + (hoursAhead * 60 * 60 * 1000);
            
            return markets.filter(market => 
                market.startTime > now &&
                market.startTime <= futureTime
            ).sort((a, b) => a.startTime - b.startTime);
        } catch (error) {
            this.logger.error('Failed to get upcoming markets:', error);
            throw error;
        }
    }

    // Batch operations for efficiency
    async batchGetMarketData(marketIds) {
        const promises = marketIds.map(id => this.getMarket(id));
        try {
            const results = await Promise.allSettled(promises);
            return results.map((result, index) => ({
                marketId: marketIds[index],
                success: result.status === 'fulfilled',
                data: result.status === 'fulfilled' ? result.value : null,
                error: result.status === 'rejected' ? result.reason : null
            }));
        } catch (error) {
            this.logger.error('Failed to batch get market data:', error);
            throw error;
        }
    }

    async batchGetOrderBooks(marketIds) {
        const promises = marketIds.map(id => this.getOrderBook(id));
        try {
            const results = await Promise.allSettled(promises);
            return results.map((result, index) => ({
                marketId: marketIds[index],
                success: result.status === 'fulfilled',
                data: result.status === 'fulfilled' ? result.value : null,
                error: result.status === 'rejected' ? result.reason : null
            }));
        } catch (error) {
            this.logger.error('Failed to batch get order books:', error);
            throw error;
        }
    }

    // Health check
    async checkApiHealth() {
        try {
            const startTime = Date.now();
            await this.makeRequest(`${this.gammaUrl}/markets?limit=1`);
            const responseTime = Date.now() - startTime;
            
            return {
                healthy: true,
                responseTime,
                timestamp: Date.now()
            };
        } catch (error) {
            this.logger.error('API health check failed:', error);
            return {
                healthy: false,
                error: error.message,
                timestamp: Date.now()
            };
        }
    }
}