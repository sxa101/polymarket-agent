import { Logger } from '../utils/logger.js';
import { ProductionConfig } from '../config/production-config.js';

export class SmartOrderManager {
    constructor(api, riskManager, wallet) {
        this.api = api;
        this.riskManager = riskManager;
        this.wallet = wallet;
        this.logger = new Logger('SmartOrderManager');
        
        this.activeOrders = new Map();
        this.executionHistory = [];
        
        // Execution parameters
        this.defaultParams = {
            maxSlippage: ProductionConfig.TRADING_LIMITS.MAX_SLIPPAGE,
            maxRetries: 3,
            retryDelay: 2000,
            minOrderSize: ProductionConfig.TRADING_LIMITS.MIN_ORDER_SIZE
        };
    }

    async executeSmartOrder(orderParams) {
        try {
            this.logger.info(`🎯 Executing smart order: ${orderParams.strategy || 'market'}`);
            
            // Validate order parameters
            const validation = await this.validateOrder(orderParams);
            if (!validation.valid) {
                throw new Error(`Order validation failed: ${validation.reason}`);
            }

            // Risk check
            const riskCheck = await this.riskManager.checkOrderRisk(orderParams);
            if (!riskCheck.approved) {
                throw new Error(`Risk check failed: ${riskCheck.reason}`);
            }

            const strategy = orderParams.strategy || 'market';
            let result;

            switch (strategy) {
                case 'iceberg':
                    result = await this.executeIcebergOrder(orderParams);
                    break;
                case 'twap':
                    result = await this.executeTWAPOrder(orderParams);
                    break;
                case 'adaptive':
                    result = await this.executeAdaptiveOrder(orderParams);
                    break;
                case 'sniper':
                    result = await this.executeSniperOrder(orderParams);
                    break;
                case 'bracket':
                    result = await this.executeBracketOrder(orderParams);
                    break;
                case 'trailing_stop':
                    result = await this.executeTrailingStopOrder(orderParams);
                    break;
                default:
                    result = await this.executeMarketOrder(orderParams);
            }

            // Log execution
            this.logExecution(orderParams, result);
            
            return result;

        } catch (error) {
            this.logger.error('Smart order execution failed:', error);
            throw error;
        }
    }

    async validateOrder(params) {
        const errors = [];

        // Check required fields
        if (!params.marketId) errors.push('Market ID is required');
        if (!params.side || !['buy', 'sell'].includes(params.side)) {
            errors.push('Valid side (buy/sell) is required');
        }
        if (!params.size || params.size <= 0) errors.push('Valid size is required');

        // Check size limits
        if (params.size < this.defaultParams.minOrderSize) {
            errors.push(`Order size below minimum: ${this.defaultParams.minOrderSize}`);
        }
        
        if (params.size > ProductionConfig.TRADING_LIMITS.MAX_POSITION_SIZE) {
            errors.push(`Order size exceeds maximum: ${ProductionConfig.TRADING_LIMITS.MAX_POSITION_SIZE}`);
        }

        // Check wallet connection for real trading
        if (!ProductionConfig.FEATURES.DEMO_MODE && !this.wallet.isConnected()) {
            errors.push('Wallet must be connected for real trading');
        }

        return {
            valid: errors.length === 0,
            reason: errors.join(', ')
        };
    }

    async executeMarketOrder(params) {
        this.logger.info(`📈 Executing market order: ${params.side} ${params.size}`);
        
        try {
            // Get current market data
            const midpoint = await this.api.getRealMidpoint(params.marketId);
            const targetPrice = params.side === 'buy' ? midpoint.yes : midpoint.no;

            if (ProductionConfig.FEATURES.DEMO_MODE) {
                // Simulate execution in demo mode
                return this.simulateOrder(params, targetPrice);
            } else {
                // Real order execution
                const signature = await this.wallet.signOrder({
                    market: params.marketId,
                    price: targetPrice.toString(),
                    size: params.size.toString(),
                    side: params.side,
                    timestamp: Date.now(),
                    nonce: this.generateNonce()
                });

                return await this.api.placeRealOrder(params, signature);
            }

        } catch (error) {
            this.logger.error('Market order execution failed:', error);
            throw error;
        }
    }

    async executeIcebergOrder(params) {
        this.logger.info(`🧊 Executing iceberg order: ${params.totalSize} in chunks of ${params.chunkSize}`);
        
        const { totalSize, chunkSize } = params;
        const chunks = Math.ceil(totalSize / chunkSize);
        const results = [];
        let remainingSize = totalSize;

        for (let i = 0; i < chunks; i++) {
            const size = Math.min(chunkSize, remainingSize);
            
            try {
                const chunkOrder = {
                    ...params,
                    size: size,
                    strategy: 'market' // Execute chunks as market orders
                };

                const result = await this.executeMarketOrder(chunkOrder);
                results.push(result);
                remainingSize -= size;

                if (remainingSize <= 0) break;

                // Wait between chunks to avoid detection and market impact
                const delay = this.calculateIcebergDelay(params, i);
                await this.sleep(delay);

            } catch (error) {
                this.logger.error(`Iceberg chunk ${i + 1} failed:`, error);
                // Continue with remaining chunks or abort based on strategy
                if (params.continueOnError) {
                    continue;
                } else {
                    throw error;
                }
            }
        }

        return {
            strategy: 'iceberg',
            totalChunks: chunks,
            successfulChunks: results.length,
            results: results,
            totalFilled: results.reduce((sum, r) => sum + (r.filled || 0), 0),
            averagePrice: this.calculateAveragePrice(results)
        };
    }

    async executeTWAPOrder(params) {
        this.logger.info(`⏰ Executing TWAP order: ${params.totalSize} over ${params.duration}ms`);
        
        const { totalSize, duration } = params;
        const intervals = Math.min(params.maxIntervals || 10, duration / 5000); // Min 5s per interval
        const sizePerInterval = totalSize / intervals;
        const timePerInterval = duration / intervals;

        const results = [];
        const startTime = Date.now();

        for (let i = 0; i < intervals; i++) {
            try {
                // Check if we should continue (market conditions, risk limits, etc.)
                if (!await this.shouldContinueTWAP(params, results)) {
                    this.logger.info('TWAP execution stopped due to conditions');
                    break;
                }

                const intervalOrder = {
                    ...params,
                    size: sizePerInterval,
                    strategy: 'market'
                };

                const result = await this.executeMarketOrder(intervalOrder);
                results.push({
                    ...result,
                    interval: i + 1,
                    timestamp: Date.now()
                });

                // Wait for next interval (unless it's the last one)
                if (i < intervals - 1) {
                    await this.sleep(timePerInterval);
                }

            } catch (error) {
                this.logger.error(`TWAP interval ${i + 1} failed:`, error);
                if (!params.continueOnError) {
                    break;
                }
            }
        }

        return {
            strategy: 'twap',
            totalIntervals: intervals,
            completedIntervals: results.length,
            results: results,
            totalFilled: results.reduce((sum, r) => sum + (r.filled || 0), 0),
            averagePrice: this.calculateAveragePrice(results),
            executionTime: Date.now() - startTime
        };
    }

    async executeAdaptiveOrder(params) {
        this.logger.info(`🤖 Executing adaptive order: ${params.size}`);
        
        try {
            // Analyze market conditions
            const conditions = await this.analyzeMarketConditions(params.marketId);
            
            // Select optimal strategy based on conditions
            let selectedStrategy = this.selectAdaptiveStrategy(conditions, params);
            
            this.logger.info(`🔄 Adaptive strategy selected: ${selectedStrategy}`);

            // Execute with selected strategy
            return await this.executeSmartOrder({
                ...params,
                strategy: selectedStrategy,
                adaptiveReason: conditions
            });

        } catch (error) {
            this.logger.error('Adaptive order execution failed:', error);
            throw error;
        }
    }

    async executeSniperOrder(params) {
        this.logger.info(`🎯 Executing sniper order: waiting for optimal entry`);
        
        const targetSpread = params.maxSpread || this.defaultParams.maxSlippage;
        const maxWaitTime = params.maxWait || 300000; // 5 minutes default
        const startTime = Date.now();

        let bestOpportunity = null;
        let attempts = 0;
        const maxAttempts = 300; // Max checks

        while (Date.now() - startTime < maxWaitTime && attempts < maxAttempts) {
            try {
                const midpoint = await this.api.getRealMidpoint(params.marketId);
                const currentSpread = Math.abs(midpoint.yes - midpoint.no);
                
                // Check if this is a good opportunity
                const opportunity = {
                    timestamp: Date.now(),
                    spread: currentSpread,
                    yesPrice: midpoint.yes,
                    noPrice: midpoint.no,
                    score: this.scoreSniperOpportunity(midpoint, params)
                };

                if (!bestOpportunity || opportunity.score > bestOpportunity.score) {
                    bestOpportunity = opportunity;
                }

                // Execute if conditions are met
                if (currentSpread <= targetSpread || opportunity.score >= 0.8) {
                    this.logger.info(`🎯 Sniper opportunity found! Spread: ${currentSpread.toFixed(4)}`);
                    
                    const targetPrice = params.side === 'buy' 
                        ? midpoint.yes + 0.001 // Slightly above current yes price
                        : midpoint.no - 0.001; // Slightly below current no price

                    return await this.executeMarketOrder({
                        ...params,
                        targetPrice: targetPrice,
                        sniperData: opportunity
                    });
                }

                attempts++;
                await this.sleep(1000); // Check every second

            } catch (error) {
                this.logger.error('Error during sniper execution:', error);
                attempts++;
                await this.sleep(2000);
            }
        }

        // Timeout or max attempts reached
        if (Date.now() - startTime >= maxWaitTime) {
            this.logger.warn('Sniper order timeout - executing market order');
        } else {
            this.logger.warn('Max sniper attempts reached - executing market order');
        }

        // Execute market order as fallback
        return await this.executeMarketOrder({
            ...params,
            sniperData: {
                timedOut: true,
                bestOpportunity: bestOpportunity,
                attempts: attempts
            }
        });
    }

    async executeBracketOrder(params) {
        this.logger.info(`📊 Executing bracket order with stop loss and take profit`);
        
        try {
            // Execute main order first
            const mainOrder = await this.executeMarketOrder(params);
            
            if (!mainOrder.success || !mainOrder.filled) {
                throw new Error('Main order failed to fill');
            }

            // Set up stop loss and take profit orders
            const bracketOrders = [];
            
            if (params.stopLoss) {
                const stopLossOrder = this.createStopLossOrder(params, mainOrder);
                bracketOrders.push(stopLossOrder);
            }

            if (params.takeProfit) {
                const takeProfitOrder = this.createTakeProfitOrder(params, mainOrder);
                bracketOrders.push(takeProfitOrder);
            }

            // Track bracket orders
            const bracketId = this.generateBracketId();
            this.activeOrders.set(bracketId, {
                type: 'bracket',
                mainOrder: mainOrder,
                bracketOrders: bracketOrders,
                created: Date.now()
            });

            return {
                strategy: 'bracket',
                bracketId: bracketId,
                mainOrder: mainOrder,
                bracketOrders: bracketOrders
            };

        } catch (error) {
            this.logger.error('Bracket order execution failed:', error);
            throw error;
        }
    }

    async executeTrailingStopOrder(params) {
        this.logger.info(`📈 Executing trailing stop order`);
        
        try {
            // Execute initial order
            const initialOrder = await this.executeMarketOrder(params);
            
            if (!initialOrder.success) {
                throw new Error('Initial order failed');
            }

            // Set up trailing stop
            const trailingStopId = this.generateTrailingStopId();
            const trailingStop = {
                orderId: trailingStopId,
                marketId: params.marketId,
                side: params.side === 'buy' ? 'sell' : 'buy', // Opposite side for exit
                size: initialOrder.filled || params.size,
                trailAmount: params.trailAmount || 0.05, // 5% default trail
                highWaterMark: initialOrder.price,
                lowWaterMark: initialOrder.price,
                active: true,
                created: Date.now()
            };

            this.activeOrders.set(trailingStopId, trailingStop);
            
            // Start monitoring for trailing stop
            this.monitorTrailingStop(trailingStopId);

            return {
                strategy: 'trailing_stop',
                initialOrder: initialOrder,
                trailingStopId: trailingStopId,
                trailAmount: trailingStop.trailAmount
            };

        } catch (error) {
            this.logger.error('Trailing stop order execution failed:', error);
            throw error;
        }
    }

    // Helper methods

    async analyzeMarketConditions(marketId) {
        try {
            const midpoint = await this.api.getRealMidpoint(marketId);
            
            return {
                spread: Math.abs(midpoint.yes - midpoint.no),
                volatility: this.estimateVolatility(midpoint),
                trend: this.detectTrend(midpoint),
                liquidity: 'unknown', // Would require order book data
                timestamp: Date.now()
            };
        } catch (error) {
            this.logger.error('Failed to analyze market conditions:', error);
            return {
                spread: 0.1,
                volatility: 'medium',
                trend: 'neutral',
                liquidity: 'unknown',
                timestamp: Date.now()
            };
        }
    }

    selectAdaptiveStrategy(conditions, params) {
        // Simple strategy selection logic
        if (conditions.spread > 0.15) {
            return 'sniper'; // Wait for better prices
        } else if (params.size > ProductionConfig.TRADING_LIMITS.MAX_POSITION_SIZE * 0.5) {
            return 'iceberg'; // Break up large orders
        } else if (conditions.volatility === 'high') {
            return 'twap'; // Smooth out volatile periods
        } else {
            return 'market'; // Normal market conditions
        }
    }

    scoreSniperOpportunity(midpoint, params) {
        // Score from 0 to 1 based on various factors
        let score = 0;

        // Spread factor
        const spread = Math.abs(midpoint.yes - midpoint.no);
        if (spread < 0.05) score += 0.4;
        else if (spread < 0.10) score += 0.3;
        else if (spread < 0.15) score += 0.2;

        // Price position factor
        const targetPrice = params.side === 'buy' ? midpoint.yes : midpoint.no;
        if (targetPrice < 0.3 || targetPrice > 0.7) score += 0.3; // Extreme prices
        else if (targetPrice < 0.4 || targetPrice > 0.6) score += 0.2; // Moderate bias

        // Time factor (prefer quicker execution)
        score += 0.3;

        return Math.min(1.0, score);
    }

    calculateIcebergDelay(params, chunkIndex) {
        const baseDelay = params.baseDelay || 3000; // 3 seconds base
        const randomFactor = 0.5 + Math.random(); // 50-150% of base delay
        return Math.floor(baseDelay * randomFactor);
    }

    async shouldContinueTWAP(params, results) {
        // Check various conditions to determine if TWAP should continue
        
        // Check risk limits
        const totalFilled = results.reduce((sum, r) => sum + (r.filled || 0), 0);
        if (totalFilled >= ProductionConfig.TRADING_LIMITS.MAX_POSITION_SIZE) {
            return false;
        }

        // Check if market is still active
        try {
            const midpoint = await this.api.getRealMidpoint(params.marketId);
            return midpoint && midpoint.yes !== null && midpoint.no !== null;
        } catch (error) {
            return false;
        }
    }

    calculateAveragePrice(results) {
        if (!results.length) return 0;

        let totalValue = 0;
        let totalSize = 0;

        results.forEach(result => {
            if (result.price && result.filled) {
                totalValue += result.price * result.filled;
                totalSize += result.filled;
            }
        });

        return totalSize > 0 ? totalValue / totalSize : 0;
    }

    simulateOrder(params, price) {
        // Simulate order execution for demo mode
        const slippage = (Math.random() - 0.5) * 0.02; // ±1% random slippage
        const executionPrice = price * (1 + slippage);
        const filled = params.size * (0.95 + Math.random() * 0.1); // 95-100% fill rate

        return {
            success: true,
            orderId: `demo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            filled: filled,
            price: executionPrice,
            slippage: slippage,
            timestamp: Date.now(),
            demo: true
        };
    }

    createStopLossOrder(params, mainOrder) {
        const stopPrice = params.side === 'buy' 
            ? mainOrder.price * (1 - params.stopLoss) 
            : mainOrder.price * (1 + params.stopLoss);

        return {
            type: 'stop_loss',
            marketId: params.marketId,
            side: params.side === 'buy' ? 'sell' : 'buy',
            size: mainOrder.filled || params.size,
            stopPrice: stopPrice,
            created: Date.now()
        };
    }

    createTakeProfitOrder(params, mainOrder) {
        const profitPrice = params.side === 'buy' 
            ? mainOrder.price * (1 + params.takeProfit) 
            : mainOrder.price * (1 - params.takeProfit);

        return {
            type: 'take_profit',
            marketId: params.marketId,
            side: params.side === 'buy' ? 'sell' : 'buy',
            size: mainOrder.filled || params.size,
            profitPrice: profitPrice,
            created: Date.now()
        };
    }

    generateNonce() {
        return Date.now().toString() + Math.random().toString(36).substr(2, 9);
    }

    generateBracketId() {
        return `bracket_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    generateTrailingStopId() {
        return `trailing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    estimateVolatility(midpoint) {
        // Simple volatility estimation based on price distance from 0.5
        const distance = Math.abs(midpoint.yes - 0.5);
        if (distance < 0.1) return 'low';
        if (distance < 0.2) return 'medium';
        return 'high';
    }

    detectTrend(midpoint) {
        // Simple trend detection (would need historical data for real implementation)
        if (midpoint.yes > 0.6) return 'bullish';
        if (midpoint.yes < 0.4) return 'bearish';
        return 'neutral';
    }

    async monitorTrailingStop(trailingStopId) {
        // This would run in a background process in a real implementation
        // For now, just log that monitoring has started
        this.logger.info(`📊 Started monitoring trailing stop: ${trailingStopId}`);
    }

    logExecution(params, result) {
        this.executionHistory.push({
            timestamp: Date.now(),
            strategy: params.strategy || 'market',
            params: params,
            result: result
        });

        // Keep only recent history
        if (this.executionHistory.length > 1000) {
            this.executionHistory = this.executionHistory.slice(-500);
        }
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Public API for getting order status and metrics
    getActiveOrders() {
        return Array.from(this.activeOrders.values());
    }

    getExecutionHistory(limit = 50) {
        return this.executionHistory.slice(-limit);
    }

    getOrderMetrics() {
        return {
            activeOrders: this.activeOrders.size,
            totalExecutions: this.executionHistory.length,
            successRate: this.calculateSuccessRate(),
            averageSlippage: this.calculateAverageSlippage()
        };
    }

    calculateSuccessRate() {
        if (!this.executionHistory.length) return 0;
        
        const successful = this.executionHistory.filter(h => h.result.success).length;
        return (successful / this.executionHistory.length) * 100;
    }

    calculateAverageSlippage() {
        const slippageData = this.executionHistory
            .filter(h => h.result.slippage !== undefined)
            .map(h => Math.abs(h.result.slippage));
            
        if (!slippageData.length) return 0;
        
        return slippageData.reduce((sum, s) => sum + s, 0) / slippageData.length;
    }
}