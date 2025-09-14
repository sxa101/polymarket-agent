export class DemoDataProvider {
    constructor() {
        this.isDemo = true;
        this.currentPrices = new Map();
        this.priceUpdateInterval = null;
        this.simulatedMarkets = this.generateDemoMarkets();
        
        // Start price simulation
        this.startPriceSimulation();
    }

    generateDemoMarkets() {
        const assets = ['BTC', 'ETH', 'SOL', 'ADA', 'MATIC'];
        const markets = [];
        
        for (let i = 0; i < 10; i++) {
            const asset = assets[Math.floor(Math.random() * assets.length)];
            const basePrice = 0.45 + (Math.random() * 0.1); // 0.45-0.55 range
            
            const market = {
                id: `demo-market-${i + 1}`,
                marketId: `demo-market-${i + 1}`,
                asset: asset,
                question: `Will ${asset} be higher in 15 minutes?`,
                description: `Prediction market for ${asset} price movement over 15-minute window`,
                startTime: Date.now() - (Math.random() * 300000), // Started 0-5 min ago
                endTime: Date.now() + (900000 - (Math.random() * 300000)), // Ends in 10-15 min
                status: 'active',
                currentPrice: basePrice,
                yesShares: { 
                    price: basePrice,
                    volume: 1000 + Math.random() * 5000 
                },
                noShares: { 
                    price: 1 - basePrice,
                    volume: 1000 + Math.random() * 5000 
                },
                chainlinkReference: `${asset}/USD`,
                volume: 5000 + Math.random() * 20000,
                liquidity: 2000 + Math.random() * 8000,
                metadata: {
                    category: 'crypto',
                    subCategory: '15min',
                    image: `https://example.com/${asset.toLowerCase()}.png`,
                    tags: ['crypto', '15min', asset.toLowerCase()]
                },
                updatedAt: Date.now()
            };
            
            markets.push(market);
            this.currentPrices.set(market.id, basePrice);
        }
        
        return markets;
    }

    startPriceSimulation() {
        this.priceUpdateInterval = setInterval(() => {
            this.updatePrices();
        }, 2000); // Update every 2 seconds
    }

    updatePrices() {
        for (const market of this.simulatedMarkets) {
            const currentPrice = this.currentPrices.get(market.id);
            
            // Random walk with slight mean reversion
            const change = (Math.random() - 0.5) * 0.02; // +/- 1% change
            const meanReversion = (0.5 - currentPrice) * 0.01; // Pull toward 0.5
            
            let newPrice = currentPrice + change + meanReversion;
            newPrice = Math.max(0.1, Math.min(0.9, newPrice)); // Keep in bounds
            
            this.currentPrices.set(market.id, newPrice);
            
            // Update market data
            market.currentPrice = newPrice;
            market.yesShares.price = newPrice;
            market.noShares.price = 1 - newPrice;
            market.updatedAt = Date.now();
        }
    }

    // Mock API Methods
    async getActiveMarkets() {
        // Simulate API delay
        await this.delay(100 + Math.random() * 200);
        
        return this.simulatedMarkets.filter(m => 
            m.status === 'active' && m.endTime > Date.now()
        );
    }

    async getMarket(marketId) {
        await this.delay(50 + Math.random() * 100);
        
        const market = this.simulatedMarkets.find(m => m.id === marketId);
        if (!market) {
            throw new Error(`Market not found: ${marketId}`);
        }
        
        return { ...market }; // Return copy
    }

    async getOrderBook(marketId) {
        await this.delay(50 + Math.random() * 100);
        
        const market = this.simulatedMarkets.find(m => m.id === marketId);
        if (!market) {
            throw new Error(`Market not found: ${marketId}`);
        }
        
        const midPrice = market.currentPrice;
        
        // Generate realistic order book
        return {
            bids: this.generateOrderBookSide(midPrice, -0.001, 10),
            asks: this.generateOrderBookSide(midPrice, 0.001, 10),
            spread: 0.002,
            timestamp: Date.now()
        };
    }

    generateOrderBookSide(basePrice, direction, count) {
        const orders = [];
        
        for (let i = 0; i < count; i++) {
            const price = basePrice + (direction * (i + 1) * 0.0005);
            const size = 100 + Math.random() * 500;
            
            orders.push({
                price: Math.max(0.001, Math.min(0.999, price)),
                size: size,
                timestamp: Date.now()
            });
        }
        
        return orders;
    }

    async getMidpoint(marketId) {
        await this.delay(30);
        
        const market = this.simulatedMarkets.find(m => m.id === marketId);
        if (!market) {
            throw new Error(`Market not found: ${marketId}`);
        }
        
        return {
            yes: market.currentPrice,
            no: 1 - market.currentPrice,
            timestamp: Date.now()
        };
    }

    async getLastTradePrice(marketId) {
        await this.delay(30);
        
        const market = this.simulatedMarkets.find(m => m.id === marketId);
        if (!market) {
            throw new Error(`Market not found: ${marketId}`);
        }
        
        return {
            price: market.currentPrice + (Math.random() - 0.5) * 0.001,
            side: Math.random() > 0.5 ? 'yes' : 'no',
            timestamp: Date.now() - Math.random() * 30000
        };
    }

    // Generate historical price data for backtesting
    generatePriceHistory(marketId, hours = 24) {
        const market = this.simulatedMarkets.find(m => m.id === marketId);
        if (!market) return [];
        
        const history = [];
        const pointCount = hours * 60; // One point per minute
        const endTime = Date.now();
        let currentPrice = market.currentPrice;
        
        for (let i = pointCount; i >= 0; i--) {
            const timestamp = endTime - (i * 60000); // 1 minute intervals
            
            // Random walk for historical data
            const change = (Math.random() - 0.5) * 0.01;
            currentPrice = Math.max(0.1, Math.min(0.9, currentPrice + change));
            
            history.push({
                marketId: marketId,
                asset: market.asset,
                timestamp: timestamp,
                yesPrice: currentPrice,
                noPrice: 1 - currentPrice,
                volume: 10 + Math.random() * 50,
                spread: 0.001 + Math.random() * 0.002
            });
        }
        
        return history;
    }

    // WebSocket simulation
    createMockWebSocket() {
        const mockWS = {
            readyState: 1, // OPEN
            send: () => {},
            close: () => {},
            onopen: null,
            onmessage: null,
            onclose: null,
            onerror: null
        };

        // Simulate connection after delay
        setTimeout(() => {
            if (mockWS.onopen) mockWS.onopen();
            
            // Send periodic market updates
            setInterval(() => {
                if (mockWS.onmessage) {
                    const market = this.simulatedMarkets[Math.floor(Math.random() * this.simulatedMarkets.length)];
                    const message = {
                        data: JSON.stringify({
                            type: 'market_update',
                            marketId: market.id,
                            asset: market.asset,
                            yesPrice: market.currentPrice,
                            noPrice: 1 - market.currentPrice,
                            volume: market.volume,
                            timestamp: Date.now()
                        })
                    };
                    mockWS.onmessage(message);
                }
            }, 3000);
        }, 500);

        return mockWS;
    }

    // Utility
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    destroy() {
        if (this.priceUpdateInterval) {
            clearInterval(this.priceUpdateInterval);
            this.priceUpdateInterval = null;
        }
    }
}