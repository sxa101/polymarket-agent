import { Logger } from '../utils/logger.js';
import { EventEmitter } from '../utils/event-emitter.js';

export class StrategyManager extends EventEmitter {
    constructor({ database, api }) {
        super();
        this.database = database;
        this.api = api;
        this.logger = new Logger('StrategyManager');
        
        this.strategies = new Map();
        this.strategyTypes = new Map();
        
        // Register built-in strategy types
        this.registerBuiltInStrategies();
    }

    registerBuiltInStrategies() {
        this.strategyTypes.set('MovingAverageCrossover', MovingAverageCrossoverStrategy);
        this.strategyTypes.set('RSIDivergence', RSIDivergenceStrategy);
        this.strategyTypes.set('BollingerBands', BollingerBandsStrategy);
        this.strategyTypes.set('OrderBookImbalance', OrderBookImbalanceStrategy);
        this.strategyTypes.set('SentimentBased', SentimentBasedStrategy);
        this.strategyTypes.set('ArbitrageDetection', ArbitrageDetectionStrategy);
    }

    async createStrategy(config) {
        try {
            const StrategyClass = this.strategyTypes.get(config.type);
            if (!StrategyClass) {
                throw new Error(`Unknown strategy type: ${config.type}`);
            }

            const strategy = new StrategyClass(config);
            strategy.initialize(this.api, this.database);
            
            this.strategies.set(strategy.id, strategy);
            this.logger.info(`Created strategy: ${strategy.name} (${strategy.id})`);
            
            return strategy;
        } catch (error) {
            this.logger.error('Failed to create strategy:', error);
            throw error;
        }
    }

    async removeStrategy(strategyId) {
        const strategy = this.strategies.get(strategyId);
        if (strategy) {
            strategy.destroy();
            this.strategies.delete(strategyId);
            this.logger.info(`Removed strategy: ${strategyId}`);
        }
    }

    getStrategy(strategyId) {
        return this.strategies.get(strategyId);
    }

    getAllStrategies() {
        return Array.from(this.strategies.values());
    }

    getAvailableStrategyTypes() {
        return Array.from(this.strategyTypes.keys());
    }
}

// Base Strategy Class
class BaseStrategy {
    constructor(config) {
        this.id = config.strategyId || this.generateId();
        this.name = config.name;
        this.type = config.type;
        this.asset = config.asset;
        this.active = config.active !== false;
        this.config = config;
        
        this.api = null;
        this.database = null;
        this.logger = new Logger(`Strategy-${this.name}`);
        
        this.lastAnalysis = 0;
        this.analysisInterval = config.analysisInterval || 30000; // 30 seconds
        this.minConfidence = config.minConfidence || 0.6;
    }

    generateId() {
        return `strategy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    initialize(api, database) {
        this.api = api;
        this.database = database;
    }

    destroy() {
        // Cleanup resources
    }

    async analyze(marketData) {
        if (!this.shouldAnalyze()) {
            return [];
        }

        try {
            const signals = await this.runAnalysis(marketData);
            this.lastAnalysis = Date.now();
            return signals.filter(signal => signal.confidence >= this.minConfidence);
        } catch (error) {
            this.logger.error('Analysis failed:', error);
            return [];
        }
    }

    shouldAnalyze() {
        const now = Date.now();
        return now - this.lastAnalysis >= this.analysisInterval;
    }

    async runAnalysis(marketData) {
        // To be implemented by subclasses
        throw new Error('runAnalysis must be implemented by subclasses');
    }

    async backtest(historicalData) {
        // To be implemented by subclasses
        return {
            totalTrades: 0,
            winRate: 0,
            totalReturn: 0,
            maxDrawdown: 0,
            sharpeRatio: 0
        };
    }

    createSignal(marketId, signal, confidence, reasoning, additionalData = {}) {
        return {
            strategyId: this.id,
            marketId,
            signal, // 'BUY', 'SELL', 'HOLD'
            confidence,
            reasoning,
            timestamp: Date.now(),
            ...additionalData
        };
    }

    // Technical analysis helpers
    calculateMA(prices, period) {
        if (prices.length < period) return null;
        const sum = prices.slice(-period).reduce((acc, price) => acc + price, 0);
        return sum / period;
    }

    calculateEMA(prices, period, prevEMA = null) {
        if (prices.length === 0) return null;
        
        const k = 2 / (period + 1);
        const price = prices[prices.length - 1];
        
        if (prevEMA === null) {
            return price;
        }
        
        return price * k + prevEMA * (1 - k);
    }

    calculateRSI(prices, period = 14) {
        if (prices.length < period + 1) return null;
        
        const gains = [];
        const losses = [];
        
        for (let i = 1; i < prices.length; i++) {
            const change = prices[i] - prices[i - 1];
            gains.push(change > 0 ? change : 0);
            losses.push(change < 0 ? Math.abs(change) : 0);
        }
        
        const avgGain = gains.slice(-period).reduce((acc, gain) => acc + gain, 0) / period;
        const avgLoss = losses.slice(-period).reduce((acc, loss) => acc + loss, 0) / period;
        
        if (avgLoss === 0) return 100;
        
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }

    calculateBollingerBands(prices, period = 20, stdDev = 2) {
        if (prices.length < period) return null;
        
        const sma = this.calculateMA(prices, period);
        const squared_diffs = prices.slice(-period).map(price => Math.pow(price - sma, 2));
        const variance = squared_diffs.reduce((acc, diff) => acc + diff, 0) / period;
        const stdDeviation = Math.sqrt(variance);
        
        return {
            upper: sma + (stdDeviation * stdDev),
            middle: sma,
            lower: sma - (stdDeviation * stdDev)
        };
    }
}

// Moving Average Crossover Strategy
class MovingAverageCrossoverStrategy extends BaseStrategy {
    constructor(config) {
        super(config);
        this.fastPeriod = config.fastPeriod || 10;
        this.slowPeriod = config.slowPeriod || 20;
        this.positionSize = config.positionSize || 0.05; // 5%
    }

    async runAnalysis(marketData) {
        const signals = [];

        for (const data of marketData) {
            const { market, priceHistory } = data;
            
            if (priceHistory.length < this.slowPeriod) continue;
            
            const prices = priceHistory.map(p => (p.yesPrice + p.noPrice) / 2);
            
            const fastMA = this.calculateMA(prices, this.fastPeriod);
            const slowMA = this.calculateMA(prices, this.slowPeriod);
            const prevFastMA = this.calculateMA(prices.slice(0, -1), this.fastPeriod);
            const prevSlowMA = this.calculateMA(prices.slice(0, -1), this.slowPeriod);
            
            if (!fastMA || !slowMA || !prevFastMA || !prevSlowMA) continue;
            
            let signal = 'HOLD';
            let confidence = 0;
            let reasoning = '';
            
            // Bullish crossover
            if (prevFastMA <= prevSlowMA && fastMA > slowMA) {
                signal = 'BUY';
                confidence = 0.75;
                reasoning = `Fast MA (${fastMA.toFixed(4)}) crossed above slow MA (${slowMA.toFixed(4)})`;
            }
            // Bearish crossover
            else if (prevFastMA >= prevSlowMA && fastMA < slowMA) {
                signal = 'SELL';
                confidence = 0.75;
                reasoning = `Fast MA (${fastMA.toFixed(4)}) crossed below slow MA (${slowMA.toFixed(4)})`;
            }
            
            if (signal !== 'HOLD') {
                const currentPrice = prices[prices.length - 1];
                signals.push(this.createSignal(market.marketId, signal, confidence, reasoning, {
                    price: currentPrice,
                    quantity: this.calculatePositionSize(currentPrice),
                    orderType: 'limit'
                }));
            }
        }

        return signals;
    }

    calculatePositionSize(price) {
        // Simple position sizing based on percentage of capital
        // This would be replaced with proper position sizing logic
        return Math.floor(this.positionSize * 100 / price);
    }
}

// RSI Divergence Strategy
class RSIDivergenceStrategy extends BaseStrategy {
    constructor(config) {
        super(config);
        this.rsiPeriod = config.rsiPeriod || 14;
        this.overbought = config.overbought || 70;
        this.oversold = config.oversold || 30;
        this.positionSize = config.positionSize || 0.05;
    }

    async runAnalysis(marketData) {
        const signals = [];

        for (const data of marketData) {
            const { market, priceHistory } = data;
            
            if (priceHistory.length < this.rsiPeriod + 10) continue;
            
            const prices = priceHistory.map(p => (p.yesPrice + p.noPrice) / 2);
            const rsi = this.calculateRSI(prices, this.rsiPeriod);
            
            if (rsi === null) continue;
            
            let signal = 'HOLD';
            let confidence = 0;
            let reasoning = '';
            
            if (rsi < this.oversold) {
                signal = 'BUY';
                confidence = Math.min(0.9, (this.oversold - rsi) / this.oversold);
                reasoning = `RSI oversold at ${rsi.toFixed(2)}`;
            } else if (rsi > this.overbought) {
                signal = 'SELL';
                confidence = Math.min(0.9, (rsi - this.overbought) / (100 - this.overbought));
                reasoning = `RSI overbought at ${rsi.toFixed(2)}`;
            }
            
            if (signal !== 'HOLD') {
                const currentPrice = prices[prices.length - 1];
                signals.push(this.createSignal(market.marketId, signal, confidence, reasoning, {
                    price: currentPrice,
                    quantity: this.calculatePositionSize(currentPrice),
                    orderType: 'limit'
                }));
            }
        }

        return signals;
    }

    calculatePositionSize(price) {
        return Math.floor(this.positionSize * 100 / price);
    }
}

// Bollinger Bands Strategy
class BollingerBandsStrategy extends BaseStrategy {
    constructor(config) {
        super(config);
        this.period = config.period || 20;
        this.stdDev = config.stdDev || 2;
        this.positionSize = config.positionSize || 0.05;
    }

    async runAnalysis(marketData) {
        const signals = [];

        for (const data of marketData) {
            const { market, priceHistory } = data;
            
            if (priceHistory.length < this.period) continue;
            
            const prices = priceHistory.map(p => (p.yesPrice + p.noPrice) / 2);
            const bands = this.calculateBollingerBands(prices, this.period, this.stdDev);
            
            if (!bands) continue;
            
            const currentPrice = prices[prices.length - 1];
            let signal = 'HOLD';
            let confidence = 0;
            let reasoning = '';
            
            if (currentPrice <= bands.lower) {
                signal = 'BUY';
                confidence = Math.min(0.85, (bands.lower - currentPrice) / (bands.middle - bands.lower));
                reasoning = `Price (${currentPrice.toFixed(4)}) hit lower Bollinger Band (${bands.lower.toFixed(4)})`;
            } else if (currentPrice >= bands.upper) {
                signal = 'SELL';
                confidence = Math.min(0.85, (currentPrice - bands.upper) / (bands.upper - bands.middle));
                reasoning = `Price (${currentPrice.toFixed(4)}) hit upper Bollinger Band (${bands.upper.toFixed(4)})`;
            }
            
            if (signal !== 'HOLD') {
                signals.push(this.createSignal(market.marketId, signal, confidence, reasoning, {
                    price: currentPrice,
                    quantity: this.calculatePositionSize(currentPrice),
                    orderType: 'limit'
                }));
            }
        }

        return signals;
    }

    calculatePositionSize(price) {
        return Math.floor(this.positionSize * 100 / price);
    }
}

// Order Book Imbalance Strategy
class OrderBookImbalanceStrategy extends BaseStrategy {
    constructor(config) {
        super(config);
        this.imbalanceThreshold = config.imbalanceThreshold || 0.7;
        this.minSpread = config.minSpread || 0.001;
        this.positionSize = config.positionSize || 0.03;
    }

    async runAnalysis(marketData) {
        const signals = [];

        for (const data of marketData) {
            const { market, orderBook } = data;
            
            if (!orderBook || orderBook.bids.length === 0 || orderBook.asks.length === 0) continue;
            
            const totalBidVolume = orderBook.bids.reduce((sum, bid) => sum + bid.size, 0);
            const totalAskVolume = orderBook.asks.reduce((sum, ask) => sum + ask.size, 0);
            const totalVolume = totalBidVolume + totalAskVolume;
            
            if (totalVolume === 0) continue;
            
            const bidImbalance = totalBidVolume / totalVolume;
            const spread = orderBook.spread;
            
            if (spread < this.minSpread) continue;
            
            let signal = 'HOLD';
            let confidence = 0;
            let reasoning = '';
            
            if (bidImbalance > this.imbalanceThreshold) {
                signal = 'BUY';
                confidence = Math.min(0.8, bidImbalance);
                reasoning = `Strong bid imbalance: ${(bidImbalance * 100).toFixed(1)}% bids`;
            } else if (bidImbalance < (1 - this.imbalanceThreshold)) {
                signal = 'SELL';
                confidence = Math.min(0.8, 1 - bidImbalance);
                reasoning = `Strong ask imbalance: ${((1 - bidImbalance) * 100).toFixed(1)}% asks`;
            }
            
            if (signal !== 'HOLD') {
                const bestBid = Math.max(...orderBook.bids.map(b => b.price));
                const bestAsk = Math.min(...orderBook.asks.map(a => a.price));
                const midPrice = (bestBid + bestAsk) / 2;
                
                signals.push(this.createSignal(market.marketId, signal, confidence, reasoning, {
                    price: signal === 'BUY' ? bestBid : bestAsk,
                    quantity: this.calculatePositionSize(midPrice),
                    orderType: 'limit'
                }));
            }
        }

        return signals;
    }

    calculatePositionSize(price) {
        return Math.floor(this.positionSize * 100 / price);
    }
}

// Placeholder strategies (to be fully implemented)
class SentimentBasedStrategy extends BaseStrategy {
    async runAnalysis(marketData) {
        // Implement sentiment analysis
        return [];
    }
}

class ArbitrageDetectionStrategy extends BaseStrategy {
    async runAnalysis(marketData) {
        // Implement arbitrage detection
        return [];
    }
}