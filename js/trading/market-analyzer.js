import { Logger } from '../utils/logger.js';
import { ProductionConfig } from '../config/production-config.js';

export class MarketAnalyzer {
    constructor(api, database) {
        this.api = api;
        this.db = database;
        this.logger = new Logger('MarketAnalyzer');
        this.cache = new Map();
        this.cacheTimeout = 60000; // 1 minute cache
    }

    async analyzeMarketOpportunities() {
        try {
            this.logger.info('🧠 Analyzing market opportunities...');
            
            const markets = await this.api.fetchRealCryptoMarkets();
            this.logger.info(`📊 Analyzing ${markets.length} markets`);
            
            const scoredMarkets = [];

            for (const market of markets) {
                try {
                    const score = await this.scoreMarket(market);
                    scoredMarkets.push({
                        ...market,
                        opportunityScore: score.total,
                        factors: score.breakdown,
                        recommendation: this.getRecommendation(score.total)
                    });
                } catch (error) {
                    this.logger.error(`Failed to score market ${market.id}:`, error);
                    // Include market with default score
                    scoredMarkets.push({
                        ...market,
                        opportunityScore: 50,
                        factors: { error: 'Scoring failed' },
                        recommendation: 'neutral'
                    });
                }
            }

            // Sort by opportunity score (highest first)
            const sortedMarkets = scoredMarkets.sort((a, b) => b.opportunityScore - a.opportunityScore);
            
            this.logger.info(`🎯 Top opportunity: ${sortedMarkets[0]?.question} (Score: ${sortedMarkets[0]?.opportunityScore})`);
            
            return sortedMarkets;

        } catch (error) {
            this.logger.error('Failed to analyze market opportunities:', error);
            throw error;
        }
    }

    async scoreMarket(market) {
        const cacheKey = `${market.id}_${Math.floor(Date.now() / this.cacheTimeout)}`;
        
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        const factors = {
            volume: this.scoreVolume(market.volume),
            liquidity: this.scoreLiquidity(market.liquidity),
            spread: await this.scoreSpread(market.id),
            timeRemaining: this.scoreTimeRemaining(market.endTime),
            volatility: this.scoreVolatility(market),
            momentum: await this.scoreMomentum(market),
            risk: this.scoreRisk(market)
        };

        const weights = {
            volume: 0.25,      // Higher volume = better liquidity
            liquidity: 0.20,   // Deeper liquidity = easier execution
            spread: 0.15,      // Tighter spread = better entry/exit
            timeRemaining: 0.10, // Time consideration for market resolution
            volatility: 0.15,  // Higher volatility = more opportunity
            momentum: 0.10,    // Price momentum direction
            risk: 0.05        // Risk assessment
        };

        const total = Object.keys(factors).reduce((sum, key) => {
            const factorScore = factors[key] || 0;
            return sum + (factorScore * weights[key]);
        }, 0);

        const result = {
            total: Math.min(100, Math.max(0, Math.round(total * 100))), // 0-100 score
            breakdown: factors,
            weights: weights
        };

        this.cache.set(cacheKey, result);
        return result;
    }

    scoreVolume(volume) {
        if (!volume || volume === 0) return 0.1;
        
        const vol = parseFloat(volume);
        
        if (vol > 5000000) return 1.0;      // $5M+ = excellent
        if (vol > 2000000) return 0.9;      // $2M+ = very good
        if (vol > 1000000) return 0.8;      // $1M+ = good
        if (vol > 500000) return 0.7;       // $500K+ = decent
        if (vol > 100000) return 0.6;       // $100K+ = fair
        if (vol > 50000) return 0.4;        // $50K+ = low
        if (vol > 10000) return 0.3;        // $10K+ = very low
        return 0.2;                         // <$10K = minimal
    }

    scoreLiquidity(liquidity) {
        if (!liquidity || liquidity === 0) return 0.2;
        
        const liq = parseFloat(liquidity);
        
        if (liq > 200000) return 1.0;       // $200K+ = excellent
        if (liq > 100000) return 0.8;       // $100K+ = good
        if (liq > 50000) return 0.7;        // $50K+ = decent
        if (liq > 25000) return 0.6;        // $25K+ = fair
        if (liq > 10000) return 0.5;        // $10K+ = low
        if (liq > 1000) return 0.3;         // $1K+ = very low
        return 0.2;                         // <$1K = minimal
    }

    async scoreSpread(marketId) {
        try {
            // For crypto price prediction markets, estimate spread from current prices
            const midpoint = await this.api.getRealMidpoint(marketId);
            if (midpoint && midpoint.yes && midpoint.no) {
                // Calculate implied spread
                const spread = Math.abs(midpoint.yes - midpoint.no);
                
                if (spread < 0.05) return 1.0;     // <5% spread = excellent
                if (spread < 0.10) return 0.8;     // <10% spread = good
                if (spread < 0.20) return 0.6;     // <20% spread = decent
                if (spread < 0.30) return 0.4;     // <30% spread = poor
                return 0.2;                        // >30% spread = very poor
            }
            return 0.5; // Default if no midpoint data
        } catch (error) {
            this.logger.debug(`Could not fetch spread for ${marketId}`);
            return 0.5; // Default score if can't fetch spread
        }
    }

    scoreTimeRemaining(endTime) {
        if (!endTime) return 0.5;
        
        const now = new Date();
        const end = new Date(endTime);
        const msRemaining = end - now;
        const daysRemaining = msRemaining / (1000 * 60 * 60 * 24);
        
        if (daysRemaining < 0) return 0.0;          // Market expired
        if (daysRemaining < 1) return 0.3;          // <1 day = risky
        if (daysRemaining < 7) return 0.6;          // <1 week = short term
        if (daysRemaining < 30) return 0.8;         // <1 month = good timing
        if (daysRemaining < 90) return 1.0;         // <3 months = optimal
        if (daysRemaining < 365) return 0.7;        // <1 year = long term
        return 0.5;                                 // >1 year = very long term
    }

    scoreVolatility(market) {
        // Estimate volatility based on market type and current prices
        const question = market.question?.toLowerCase() || '';
        
        // Bitcoin volatility scoring
        if (question.includes('bitcoin') || question.includes('btc')) {
            if (question.includes('1,000,000') || question.includes('1000000')) {
                return 0.9; // $1M Bitcoin = very volatile/speculative
            }
            if (question.includes('250,000') || question.includes('200,000')) {
                return 0.8; // High price targets = high volatility
            }
            if (question.includes('150,000') || question.includes('130,000')) {
                return 0.7; // Medium-high price targets
            }
            return 0.6; // Other Bitcoin markets
        }
        
        // Ethereum volatility scoring
        if (question.includes('ethereum') || question.includes('eth')) {
            if (question.includes('10,000') || question.includes('10000')) {
                return 0.8; // $10K ETH = high volatility
            }
            return 0.6; // Other ETH markets
        }
        
        // Stablecoin events (high volatility when they occur)
        if (question.includes('tether') || question.includes('usdt') || 
            question.includes('depeg') || question.includes('insolvent')) {
            return 0.9; // Stablecoin crisis events = very high volatility
        }
        
        // CEO/leadership changes
        if (question.includes('ceo') || question.includes('out as')) {
            return 0.7; // Leadership changes = moderate volatility
        }
        
        return 0.5; // Default volatility score
    }

    async scoreMomentum(market) {
        try {
            // For now, use current price positioning as momentum proxy
            const midpoint = await this.api.getRealMidpoint(market.id);
            if (midpoint && midpoint.yes !== undefined) {
                const yesPrice = parseFloat(midpoint.yes);
                
                // Score based on how far from 50/50 the market is
                const distanceFrom50 = Math.abs(yesPrice - 0.5);
                
                if (distanceFrom50 > 0.3) return 0.9;    // Strong directional bias
                if (distanceFrom50 > 0.2) return 0.7;    // Moderate bias
                if (distanceFrom50 > 0.1) return 0.6;    // Slight bias
                return 0.5;                              // Near 50/50
            }
            return 0.5; // Default if no price data
        } catch (error) {
            this.logger.debug(`Could not fetch momentum for ${market.id}`);
            return 0.5;
        }
    }

    scoreRisk(market) {
        const question = market.question?.toLowerCase() || '';
        
        // Lower risk = higher score
        if (question.includes('nuclear') || question.includes('war')) {
            return 0.2; // Very high risk topics
        }
        
        if (question.includes('recession') || question.includes('crisis')) {
            return 0.4; // High risk economic events
        }
        
        if (question.includes('bitcoin') || question.includes('ethereum')) {
            return 0.7; // Crypto markets = moderate risk
        }
        
        if (question.includes('fed') || question.includes('rate')) {
            return 0.8; // Fed policy = lower risk (more predictable)
        }
        
        return 0.6; // Default risk score
    }

    getRecommendation(score) {
        if (score >= 80) return 'strong_buy';
        if (score >= 65) return 'buy';
        if (score >= 50) return 'hold';
        if (score >= 35) return 'weak_hold';
        return 'avoid';
    }

    // Market categorization
    categorizeMarkets(markets) {
        const categories = {
            crypto_price: [],
            crypto_events: [],
            economic: [],
            geopolitical: [],
            corporate: [],
            other: []
        };

        markets.forEach(market => {
            const question = market.question?.toLowerCase() || '';
            
            if (question.includes('bitcoin') && (question.includes('reach') || question.includes('hit') || question.includes('dip'))) {
                categories.crypto_price.push(market);
            } else if (question.includes('ethereum') && question.includes('hit')) {
                categories.crypto_price.push(market);
            } else if (question.includes('tether') || question.includes('usdt') || question.includes('coinbase')) {
                categories.crypto_events.push(market);
            } else if (question.includes('fed') || question.includes('recession') || question.includes('rate')) {
                categories.economic.push(market);
            } else if (question.includes('putin') || question.includes('ukraine') || question.includes('nato')) {
                categories.geopolitical.push(market);
            } else if (question.includes('ceo') || question.includes('company')) {
                categories.corporate.push(market);
            } else {
                categories.other.push(market);
            }
        });

        return categories;
    }

    // Get top opportunities by category
    getTopOpportunitiesByCategory(scoredMarkets, limit = 3) {
        const categories = this.categorizeMarkets(scoredMarkets);
        const topByCategory = {};

        Object.keys(categories).forEach(category => {
            topByCategory[category] = categories[category]
                .sort((a, b) => b.opportunityScore - a.opportunityScore)
                .slice(0, limit);
        });

        return topByCategory;
    }

    // Performance metrics
    async getAnalyzerMetrics() {
        return {
            cacheSize: this.cache.size,
            cacheHitRate: this.getCacheHitRate(),
            averageAnalysisTime: this.getAverageAnalysisTime(),
            totalMarketsAnalyzed: this.getTotalMarketsAnalyzed()
        };
    }

    getCacheHitRate() {
        // This would be tracked in a real implementation
        return 0.75; // 75% cache hit rate
    }

    getAverageAnalysisTime() {
        // This would be measured in a real implementation
        return 150; // 150ms average analysis time per market
    }

    getTotalMarketsAnalyzed() {
        // This would be tracked in a real implementation
        return this.cache.size;
    }

    // Cleanup old cache entries
    cleanupCache() {
        const now = Date.now();
        for (const [key, value] of this.cache.entries()) {
            const cacheTime = parseInt(key.split('_').pop()) * this.cacheTimeout;
            if (now - cacheTime > this.cacheTimeout * 2) {
                this.cache.delete(key);
            }
        }
    }
}