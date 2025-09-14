import { Logger } from '../utils/logger.js';
import { EventEmitter } from '../utils/event-emitter.js';

export class RiskManager extends EventEmitter {
    constructor(config = {}) {
        super();
        this.logger = new Logger('RiskManager');
        
        // Risk parameters
        this.maxDailyLoss = config.maxDailyLoss || 0.05;          // 5% max daily loss
        this.maxPositionSize = config.maxPositionSize || 0.10;    // 10% max position size
        this.maxOpenOrders = config.maxOpenOrders || 20;          // Max concurrent orders
        this.stopLossPercentage = config.stopLossPercentage || 0.02; // 2% stop loss
        this.maxDrawdown = config.maxDrawdown || 0.15;            // 15% max drawdown
        this.maxLeverage = config.maxLeverage || 1.0;             // No leverage by default
        this.maxCorrelation = config.maxCorrelation || 0.7;       // Max correlation between positions
        
        // Portfolio limits
        this.maxPortfolioRisk = config.maxPortfolioRisk || 0.20;  // 20% max portfolio at risk
        this.maxSingleAssetExposure = config.maxSingleAssetExposure || 0.25; // 25% max in single asset
        
        // Time-based limits
        this.maxOrdersPerHour = config.maxOrdersPerHour || 50;
        this.maxTradesPerDay = config.maxTradesPerDay || 100;
        
        // Risk state tracking
        this.currentPortfolioValue = 0;
        this.dailyStartValue = 0;
        this.allTimeHigh = 0;
        this.recentOrders = [];
        this.recentTrades = [];
    }

    async checkGlobalRisk(state) {
        const riskChecks = {
            approved: true,
            checks: [],
            severity: 'low',
            recommendations: []
        };

        try {
            // Daily loss check
            const dailyLossCheck = this.checkDailyLoss(state.dailyPnL, state.totalPnL);
            riskChecks.checks.push(dailyLossCheck);

            // Drawdown check
            const drawdownCheck = this.checkMaxDrawdown(state.totalPnL);
            riskChecks.checks.push(drawdownCheck);

            // Open orders check
            const ordersCheck = this.checkOpenOrders(state.openOrders);
            riskChecks.checks.push(ordersCheck);

            // Portfolio concentration check
            const concentrationCheck = this.checkPortfolioConcentration(state.positions);
            riskChecks.checks.push(concentrationCheck);

            // Rate limiting check
            const rateLimitCheck = this.checkRateLimits();
            riskChecks.checks.push(rateLimitCheck);

            // Determine overall approval and severity
            const failedChecks = riskChecks.checks.filter(check => !check.passed);
            const criticalFailures = failedChecks.filter(check => check.severity === 'critical');
            const highFailures = failedChecks.filter(check => check.severity === 'high');

            if (criticalFailures.length > 0) {
                riskChecks.approved = false;
                riskChecks.severity = 'critical';
                this.emit('riskLimitExceeded', {
                    type: 'critical',
                    checks: criticalFailures,
                    message: 'Critical risk limits exceeded'
                });
            } else if (highFailures.length > 0) {
                riskChecks.approved = false;
                riskChecks.severity = 'high';
                this.emit('riskLimitExceeded', {
                    type: 'high',
                    checks: highFailures,
                    message: 'High risk limits exceeded'
                });
            }

            return riskChecks;

        } catch (error) {
            this.logger.error('Error checking global risk:', error);
            return {
                approved: false,
                checks: [],
                severity: 'critical',
                error: error.message
            };
        }
    }

    async validateTrade(signal, context) {
        try {
            const validation = {
                approved: false,
                originalSize: signal.quantity,
                adjustedSize: signal.quantity,
                reasoning: '',
                riskScore: 0,
                checks: []
            };

            // Position size check
            const positionSizeCheck = this.checkPositionSize(signal, context.currentPortfolio);
            validation.checks.push(positionSizeCheck);

            // Asset concentration check
            const assetCheck = this.checkAssetConcentration(signal, context.currentPortfolio);
            validation.checks.push(assetCheck);

            // Correlation check
            const correlationCheck = this.checkPositionCorrelation(signal, context.currentPortfolio);
            validation.checks.push(correlationCheck);

            // Liquidity check
            const liquidityCheck = await this.checkMarketLiquidity(signal);
            validation.checks.push(liquidityCheck);

            // Risk-reward ratio check
            const riskRewardCheck = this.checkRiskRewardRatio(signal);
            validation.checks.push(riskRewardCheck);

            // Calculate overall risk score
            validation.riskScore = this.calculateTradeRiskScore(validation.checks);

            // Determine if trade is approved
            const failedChecks = validation.checks.filter(check => !check.passed);
            const criticalFailures = failedChecks.filter(check => check.severity === 'critical');

            if (criticalFailures.length === 0 && validation.riskScore < 0.8) {
                validation.approved = true;
                validation.reasoning = 'All risk checks passed';
                
                // Apply position size adjustments if needed
                const sizeAdjustments = validation.checks
                    .filter(check => check.positionAdjustment)
                    .map(check => check.positionAdjustment);

                if (sizeAdjustments.length > 0) {
                    validation.adjustedSize = Math.min(...sizeAdjustments, signal.quantity);
                    
                    if (validation.adjustedSize !== validation.originalSize) {
                        this.emit('positionSizeAdjusted', {
                            original: validation.originalSize,
                            adjusted: validation.adjustedSize,
                            reasoning: 'Risk management position sizing'
                        });
                    }
                }
            } else {
                validation.approved = false;
                validation.reasoning = `Trade rejected: ${failedChecks.map(c => c.message).join('; ')}`;
            }

            return validation;

        } catch (error) {
            this.logger.error('Error validating trade:', error);
            return {
                approved: false,
                reasoning: `Validation error: ${error.message}`,
                riskScore: 1.0
            };
        }
    }

    checkDailyLoss(dailyPnL, totalPnL) {
        const dailyLossPercentage = Math.abs(dailyPnL) / Math.max(Math.abs(totalPnL), 1000); // Avoid division by zero
        
        return {
            name: 'Daily Loss Check',
            passed: dailyPnL >= -(this.maxDailyLoss * Math.abs(totalPnL)),
            severity: dailyLossPercentage > this.maxDailyLoss ? 'critical' : 'low',
            message: `Daily P&L: ${dailyPnL.toFixed(2)} (${(dailyLossPercentage * 100).toFixed(2)}% of portfolio)`,
            currentValue: dailyLossPercentage,
            limit: this.maxDailyLoss
        };
    }

    checkMaxDrawdown(totalPnL) {
        if (totalPnL > this.allTimeHigh) {
            this.allTimeHigh = totalPnL;
        }
        
        const currentDrawdown = (this.allTimeHigh - totalPnL) / Math.max(this.allTimeHigh, 1000);
        
        return {
            name: 'Max Drawdown Check',
            passed: currentDrawdown <= this.maxDrawdown,
            severity: currentDrawdown > this.maxDrawdown ? 'high' : 'low',
            message: `Current drawdown: ${(currentDrawdown * 100).toFixed(2)}%`,
            currentValue: currentDrawdown,
            limit: this.maxDrawdown
        };
    }

    checkOpenOrders(openOrdersCount) {
        return {
            name: 'Open Orders Check',
            passed: openOrdersCount <= this.maxOpenOrders,
            severity: openOrdersCount > this.maxOpenOrders ? 'medium' : 'low',
            message: `Open orders: ${openOrdersCount}/${this.maxOpenOrders}`,
            currentValue: openOrdersCount,
            limit: this.maxOpenOrders
        };
    }

    checkPortfolioConcentration(positions) {
        const positionsByAsset = new Map();
        let totalPortfolioValue = 0;
        
        // Group positions by asset
        for (const position of positions.values()) {
            const asset = position.marketId.split('-')[0]; // Extract asset from market ID
            const value = Math.abs(position.quantity * position.averagePrice);
            totalPortfolioValue += value;
            
            if (!positionsByAsset.has(asset)) {
                positionsByAsset.set(asset, 0);
            }
            positionsByAsset.set(asset, positionsByAsset.get(asset) + value);
        }
        
        let maxConcentration = 0;
        let maxAsset = '';
        
        for (const [asset, value] of positionsByAsset) {
            const concentration = totalPortfolioValue > 0 ? value / totalPortfolioValue : 0;
            if (concentration > maxConcentration) {
                maxConcentration = concentration;
                maxAsset = asset;
            }
        }
        
        return {
            name: 'Portfolio Concentration Check',
            passed: maxConcentration <= this.maxSingleAssetExposure,
            severity: maxConcentration > this.maxSingleAssetExposure ? 'medium' : 'low',
            message: `Max asset concentration: ${maxAsset} ${(maxConcentration * 100).toFixed(2)}%`,
            currentValue: maxConcentration,
            limit: this.maxSingleAssetExposure
        };
    }

    checkPositionSize(signal, currentPortfolio) {
        const portfolioValue = this.calculatePortfolioValue(currentPortfolio);
        const proposedPositionValue = signal.quantity * signal.price;
        const positionSizePercentage = proposedPositionValue / Math.max(portfolioValue, 1000);
        
        const maxAllowedSize = this.maxPositionSize * Math.max(portfolioValue, 1000) / signal.price;
        
        return {
            name: 'Position Size Check',
            passed: positionSizePercentage <= this.maxPositionSize,
            severity: positionSizePercentage > this.maxPositionSize ? 'high' : 'low',
            message: `Position size: ${(positionSizePercentage * 100).toFixed(2)}% of portfolio`,
            currentValue: positionSizePercentage,
            limit: this.maxPositionSize,
            positionAdjustment: Math.min(signal.quantity, maxAllowedSize)
        };
    }

    checkAssetConcentration(signal, currentPortfolio) {
        const asset = signal.marketId.split('-')[0];
        let currentAssetExposure = 0;
        let totalPortfolioValue = 0;
        
        for (const position of currentPortfolio.values()) {
            const positionAsset = position.marketId.split('-')[0];
            const value = Math.abs(position.quantity * position.averagePrice);
            totalPortfolioValue += value;
            
            if (positionAsset === asset) {
                currentAssetExposure += value;
            }
        }
        
        const proposedValue = signal.quantity * signal.price;
        const newAssetExposure = (currentAssetExposure + proposedValue) / Math.max(totalPortfolioValue + proposedValue, 1000);
        
        return {
            name: 'Asset Concentration Check',
            passed: newAssetExposure <= this.maxSingleAssetExposure,
            severity: newAssetExposure > this.maxSingleAssetExposure ? 'medium' : 'low',
            message: `${asset} concentration would be ${(newAssetExposure * 100).toFixed(2)}%`,
            currentValue: newAssetExposure,
            limit: this.maxSingleAssetExposure
        };
    }

    checkPositionCorrelation(signal, currentPortfolio) {
        // Simplified correlation check - in reality, you'd need historical correlation data
        const asset = signal.marketId.split('-')[0];
        const correlatedAssets = this.getCorrelatedAssets(asset);
        
        let correlatedExposure = 0;
        let totalValue = 0;
        
        for (const position of currentPortfolio.values()) {
            const positionAsset = position.marketId.split('-')[0];
            const value = Math.abs(position.quantity * position.averagePrice);
            totalValue += value;
            
            if (correlatedAssets.includes(positionAsset)) {
                correlatedExposure += value;
            }
        }
        
        const correlatedPercentage = totalValue > 0 ? correlatedExposure / totalValue : 0;
        
        return {
            name: 'Position Correlation Check',
            passed: correlatedPercentage <= this.maxCorrelation,
            severity: correlatedPercentage > this.maxCorrelation ? 'medium' : 'low',
            message: `Correlated exposure: ${(correlatedPercentage * 100).toFixed(2)}%`,
            currentValue: correlatedPercentage,
            limit: this.maxCorrelation
        };
    }

    async checkMarketLiquidity(signal) {
        try {
            // This would ideally check actual market liquidity
            // For now, we'll use a simplified check
            const minLiquidityValue = 1000; // Minimum $1000 liquidity
            
            return {
                name: 'Market Liquidity Check',
                passed: true, // Simplified - assume liquidity is adequate
                severity: 'low',
                message: 'Market liquidity appears adequate',
                currentValue: minLiquidityValue,
                limit: minLiquidityValue
            };
        } catch (error) {
            return {
                name: 'Market Liquidity Check',
                passed: false,
                severity: 'high',
                message: 'Unable to verify market liquidity',
                error: error.message
            };
        }
    }

    checkRiskRewardRatio(signal) {
        // Simple risk-reward check based on confidence
        const minRiskReward = 2.0; // 2:1 risk-reward ratio
        const estimatedRiskReward = signal.confidence * 3; // Simplified calculation
        
        return {
            name: 'Risk-Reward Ratio Check',
            passed: estimatedRiskReward >= minRiskReward,
            severity: estimatedRiskReward < minRiskReward ? 'low' : 'low',
            message: `Estimated risk-reward: ${estimatedRiskReward.toFixed(2)}:1`,
            currentValue: estimatedRiskReward,
            limit: minRiskReward
        };
    }

    checkRateLimits() {
        const now = Date.now();
        const oneHour = 60 * 60 * 1000;
        const oneDay = 24 * oneHour;
        
        // Clean old entries
        this.recentOrders = this.recentOrders.filter(order => now - order.timestamp < oneHour);
        this.recentTrades = this.recentTrades.filter(trade => now - trade.timestamp < oneDay);
        
        const hourlyOrders = this.recentOrders.length;
        const dailyTrades = this.recentTrades.length;
        
        const hourlyCheck = hourlyOrders <= this.maxOrdersPerHour;
        const dailyCheck = dailyTrades <= this.maxTradesPerDay;
        
        return {
            name: 'Rate Limits Check',
            passed: hourlyCheck && dailyCheck,
            severity: (!hourlyCheck || !dailyCheck) ? 'medium' : 'low',
            message: `Orders: ${hourlyOrders}/${this.maxOrdersPerHour}/hr, Trades: ${dailyTrades}/${this.maxTradesPerDay}/day`,
            currentValue: { hourlyOrders, dailyTrades },
            limit: { maxOrdersPerHour: this.maxOrdersPerHour, maxTradesPerDay: this.maxTradesPerDay }
        };
    }

    calculateTradeRiskScore(checks) {
        const failedChecks = checks.filter(check => !check.passed);
        const severityWeights = { low: 0.1, medium: 0.3, high: 0.6, critical: 1.0 };
        
        let riskScore = 0;
        for (const check of failedChecks) {
            riskScore += severityWeights[check.severity] || 0.5;
        }
        
        return Math.min(riskScore, 1.0);
    }

    calculatePortfolioValue(positions) {
        let totalValue = 0;
        for (const position of positions.values()) {
            totalValue += Math.abs(position.quantity * position.averagePrice);
        }
        return totalValue;
    }

    getCorrelatedAssets(asset) {
        // Simplified correlation mapping - in practice, use statistical correlation
        const correlationMap = {
            'BTC': ['ETH', 'SOL'],
            'ETH': ['BTC', 'MATIC'],
            'SOL': ['BTC', 'AVAX'],
            'MATIC': ['ETH', 'DOT'],
            'ADA': ['DOT', 'AVAX'],
            'DOT': ['ADA', 'MATIC'],
            'AVAX': ['SOL', 'ADA']
        };
        
        return correlationMap[asset] || [];
    }

    recordOrder(order) {
        this.recentOrders.push({
            orderId: order.orderId,
            timestamp: Date.now()
        });
    }

    recordTrade(trade) {
        this.recentTrades.push({
            tradeId: trade.tradeId,
            timestamp: Date.now()
        });
    }

    updatePortfolioValue(value) {
        this.currentPortfolioValue = value;
        if (this.dailyStartValue === 0) {
            this.dailyStartValue = value;
        }
    }

    resetDailyTracking() {
        this.dailyStartValue = this.currentPortfolioValue;
    }

    getRiskMetrics() {
        return {
            maxDailyLoss: this.maxDailyLoss,
            maxPositionSize: this.maxPositionSize,
            maxOpenOrders: this.maxOpenOrders,
            stopLossPercentage: this.stopLossPercentage,
            maxDrawdown: this.maxDrawdown,
            maxSingleAssetExposure: this.maxSingleAssetExposure,
            currentPortfolioValue: this.currentPortfolioValue,
            allTimeHigh: this.allTimeHigh,
            recentOrdersCount: this.recentOrders.length,
            recentTradesCount: this.recentTrades.length
        };
    }

    updateRiskParameters(newParams) {
        Object.assign(this, newParams);
        this.logger.info('Risk parameters updated:', newParams);
    }
}