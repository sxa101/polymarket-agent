import { Logger } from '../utils/logger.js';
import { EventEmitter } from '../utils/event-emitter.js';
import { RiskManager } from './risk-manager.js';
import { StrategyManager } from './strategy-manager.js';
import { OrderManager } from './order-manager.js';
import { ProductionConfig } from '../config/production-config.js';
import { RealPolymarketAPI } from '../core/real-polymarket-api.js';
import { RealWebSocketManager } from '../core/real-websocket-manager.js';

export class TradingEngine extends EventEmitter {
    constructor({ database, api, wallet, webSocket = null, demoMode = false }) {
        super();
        this.database = database;
        this.api = api;
        this.wallet = wallet;
        this.webSocket = webSocket;
        this.demoMode = demoMode || !ProductionConfig.FEATURES.ENABLE_TRADING;
        this.logger = new Logger('TradingEngine');
        
        this.isRunning = false;
        this.activeStrategies = new Map();
        this.activeOrders = new Map();
        this.positions = new Map();
        
        // Initialize sub-components with production configuration
        this.riskManager = new RiskManager({
            database: this.database,
            maxDailyLoss: ProductionConfig.TRADING_LIMITS.DAILY_LOSS_LIMIT,
            maxPositionSize: ProductionConfig.TRADING_LIMITS.POSITION_SIZE_LIMIT,
            maxOpenOrders: ProductionConfig.TRADING_LIMITS.MAX_OPEN_ORDERS,
            stopLossPercentage: ProductionConfig.TRADING_LIMITS.STOP_LOSS_THRESHOLD,
            minOrderSize: ProductionConfig.TRADING_LIMITS.MIN_ORDER_SIZE,
            maxSlippage: ProductionConfig.TRADING_LIMITS.MAX_SLIPPAGE
        });
        
        this.strategyManager = new StrategyManager({
            database: this.database,
            api: this.api
        });
        
        this.orderManager = new OrderManager({
            database: this.database,
            api: this.api,
            wallet: this.wallet,
            demoMode: this.demoMode
        });
        
        this.setupEventHandlers();
        
        // Performance tracking
        this.dailyPnL = 0;
        this.totalPnL = 0;
        this.tradesExecuted = 0;
        this.winningTrades = 0;
        
        // Execution loop with production rate limiting
        this.executionInterval = null;
        this.executionFrequency = ProductionConfig.RATE_LIMITS.MARKET_DATA_REFRESH_RATE;
        
        // Production mode validation
        this.productionSafety = {
            enabled: ProductionConfig.FEATURES.ENABLE_RISK_MANAGEMENT,
            tradingEnabled: ProductionConfig.FEATURES.ENABLE_TRADING,
            testnetMode: ProductionConfig.FEATURES.TESTNET_MODE
        };
        
        // WebSocket event setup
        if (this.webSocket) {
            this.setupWebSocketHandlers();
        }
        
        this.logger.info(`Trading engine initialized in ${this.demoMode ? 'DEMO' : 'PRODUCTION'} mode`);
    }

    setupEventHandlers() {
        // Strategy events
        this.strategyManager.on('signal', (signal) => {
            this.handleStrategySignal(signal);
        });

        // Order events
        this.orderManager.on('orderFilled', (trade) => {
            this.handleOrderFilled(trade);
        });

        this.orderManager.on('orderCancelled', (order) => {
            this.handleOrderCancelled(order);
        });

        this.orderManager.on('orderFailed', (error) => {
            this.handleOrderFailed(error);
        });

        // Risk management events
        this.riskManager.on('riskLimitExceeded', (risk) => {
            this.handleRiskLimitExceeded(risk);
        });

        this.riskManager.on('positionSizeAdjusted', (adjustment) => {
            this.logger.info(`Position size adjusted: ${adjustment.original} -> ${adjustment.adjusted}`);
        });
    }

    setupWebSocketHandlers() {
        if (!this.webSocket) return;

        this.webSocket.on('market_update', (data) => {
            this.handleMarketUpdate(data);
        });

        this.webSocket.on('orderbook_update', (data) => {
            this.handleOrderBookUpdate(data);
        });

        this.webSocket.on('trade_update', (data) => {
            this.handleTradeUpdate(data);
        });

        this.webSocket.on('midpoint_update', (data) => {
            this.handleMidpointUpdate(data);
        });

        this.webSocket.on('connected', () => {
            this.logger.info('WebSocket connected - subscribing to active markets');
            this.subscribeToActiveMarkets();
        });

        this.webSocket.on('disconnected', () => {
            this.logger.warn('WebSocket disconnected - trading may be impaired');
        });

        this.logger.info('WebSocket event handlers setup complete');
    }

    async subscribeToActiveMarkets() {
        try {
            if (!this.webSocket || !this.webSocket.isConnected()) return;

            // Subscribe to all markets we're actively trading
            for (const [marketId, position] of this.positions) {
                await this.webSocket.subscribeToMarket(marketId);
                await this.webSocket.subscribeToOrderBook(marketId);
                await this.webSocket.subscribeToMidpoints(marketId);
            }

            // Subscribe to markets with active orders
            for (const [orderId, order] of this.activeOrders) {
                const marketId = order.marketId;
                await this.webSocket.subscribeToMarket(marketId);
                await this.webSocket.subscribeToOrderBook(marketId);
            }

            this.logger.info('Subscribed to all active markets');

        } catch (error) {
            this.logger.error('Failed to subscribe to active markets:', error);
        }
    }

    handleMarketUpdate(data) {
        this.emit('market_update', data);
        
        // Update internal price tracking
        if (this.positions.has(data.marketId)) {
            this.updatePositionPnL(data.marketId, data.data);
        }
    }

    handleOrderBookUpdate(data) {
        this.emit('orderbook_update', data);
        
        // Trigger strategy evaluation if we have active orders
        if (this.hasActiveOrdersForMarket(data.marketId)) {
            this.evaluateOrderBookStrategies(data);
        }
    }

    handleTradeUpdate(data) {
        this.emit('trade_update', data);
        
        // Update volume and price history for strategies
        this.updateMarketMetrics(data.marketId, data);
    }

    handleMidpointUpdate(data) {
        this.emit('midpoint_update', data);
        
        // Primary price data for strategy calculations
        this.updatePriceData(data.marketId, data);
    }

    async start() {
        if (this.isRunning) {
            this.logger.warn('Trading engine is already running');
            return;
        }

        try {
            this.logger.info(`Starting trading engine in ${this.demoMode ? 'DEMO' : 'PRODUCTION'} mode...`);

            // Production safety checks
            if (!this.demoMode && !ProductionConfig.FEATURES.ENABLE_TRADING) {
                throw new Error('Trading is disabled in production configuration');
            }

            if (!this.demoMode && !this.productionSafety.tradingEnabled) {
                throw new Error('Production trading is not enabled');
            }

            // Validate wallet connection for real trading
            if (!this.demoMode && !this.wallet.isConnected()) {
                throw new Error('Wallet must be connected to start real trading');
            }

            // Prepare wallet for trading if not in demo mode
            if (!this.demoMode) {
                this.logger.info('Preparing wallet for trading...');
                const walletInfo = await this.wallet.prepareForTrading();
                this.logger.info(`Wallet prepared: ${walletInfo.account} (${walletInfo.network})`);
                
                if (walletInfo.usdcBalance < ProductionConfig.TRADING_LIMITS.MIN_ORDER_SIZE) {
                    throw new Error(`Insufficient USDC balance: ${walletInfo.usdcBalance}`);
                }
            }

            // Load active strategies
            await this.loadActiveStrategies();

            // Load existing positions and orders
            await this.loadPositionsAndOrders();

            // Initialize daily P&L tracking
            await this.initializeDailyTracking();

            // Start execution loop
            this.startExecutionLoop();

            this.isRunning = true;
            this.logger.info('Trading engine started successfully');
            this.emit('started');

        } catch (error) {
            this.logger.error('Failed to start trading engine:', error);
            throw error;
        }
    }

    async stop() {
        if (!this.isRunning) {
            return;
        }

        this.logger.info('Stopping trading engine...');

        try {
            // Stop execution loop
            this.stopExecutionLoop();

            // Cancel all pending orders (optional - could be configurable)
            // await this.cancelAllOrders();

            // Save final state
            await this.saveCurrentState();

            this.isRunning = false;
            this.logger.info('Trading engine stopped');
            this.emit('stopped');

        } catch (error) {
            this.logger.error('Error stopping trading engine:', error);
            throw error;
        }
    }

    async loadActiveStrategies() {
        try {
            const strategies = await this.database.getActiveStrategies();
            
            for (const strategyData of strategies) {
                const strategy = await this.strategyManager.createStrategy(strategyData);
                this.activeStrategies.set(strategy.id, strategy);
                this.logger.info(`Loaded strategy: ${strategy.name} (${strategy.id})`);
            }

            this.logger.info(`Loaded ${strategies.length} active strategies`);
        } catch (error) {
            this.logger.error('Failed to load active strategies:', error);
            throw error;
        }
    }

    async loadPositionsAndOrders() {
        try {
            // Load open orders
            const orders = await this.database.getOpenOrders();
            for (const order of orders) {
                this.activeOrders.set(order.orderId, order);
            }

            // Calculate current positions from trade history
            await this.calculateCurrentPositions();

            this.logger.info(`Loaded ${orders.length} open orders and calculated positions`);
        } catch (error) {
            this.logger.error('Failed to load positions and orders:', error);
            throw error;
        }
    }

    async calculateCurrentPositions() {
        const recentTrades = await this.database.getRecentTrades(1000);
        const positionMap = new Map();

        for (const trade of recentTrades) {
            const key = `${trade.marketId}-${trade.side}`;
            if (!positionMap.has(key)) {
                positionMap.set(key, {
                    marketId: trade.marketId,
                    side: trade.side,
                    quantity: 0,
                    averagePrice: 0,
                    totalCost: 0,
                    unrealizedPnL: 0
                });
            }

            const position = positionMap.get(key);
            position.quantity += trade.quantity;
            position.totalCost += trade.quantity * trade.price;
            position.averagePrice = position.totalCost / position.quantity;
        }

        this.positions = positionMap;
    }

    async initializeDailyTracking() {
        const today = new Date().toISOString().split('T')[0];
        const stats = await this.database.getPerformanceStats(null, 1);
        
        this.dailyPnL = 0; // Reset for new day
        this.totalPnL = stats.totalPnL || 0;
        this.tradesExecuted = stats.totalTrades || 0;
        this.winningTrades = stats.winningTrades || 0;
    }

    startExecutionLoop() {
        this.executionInterval = setInterval(async () => {
            try {
                await this.executionCycle();
            } catch (error) {
                this.logger.error('Error in execution cycle:', error);
            }
        }, this.executionFrequency);
    }

    stopExecutionLoop() {
        if (this.executionInterval) {
            clearInterval(this.executionInterval);
            this.executionInterval = null;
        }
    }

    async executionCycle() {
        if (!this.isRunning) return;

        try {
            // 1. Update market data and positions
            await this.updatePositionValues();

            // 2. Check risk limits
            const riskCheck = await this.riskManager.checkGlobalRisk({
                dailyPnL: this.dailyPnL,
                totalPnL: this.totalPnL,
                openOrders: this.activeOrders.size,
                positions: this.positions
            });

            if (!riskCheck.approved) {
                this.logger.warn('Risk limits exceeded, skipping execution cycle');
                return;
            }

            // 3. Process strategy signals
            for (const [strategyId, strategy] of this.activeStrategies) {
                try {
                    await this.processStrategy(strategy);
                } catch (error) {
                    this.logger.error(`Error processing strategy ${strategyId}:`, error);
                }
            }

            // 4. Manage existing orders (cancel stale orders, etc.)
            await this.manageExistingOrders();

        } catch (error) {
            this.logger.error('Error in execution cycle:', error);
        }
    }

    async processStrategy(strategy) {
        try {
            // Get market data for strategy
            const marketData = await this.getStrategyMarketData(strategy);
            if (!marketData || marketData.length === 0) {
                return;
            }

            // Run strategy analysis
            const signals = await strategy.analyze(marketData);
            
            for (const signal of signals) {
                if (signal.signal === 'HOLD' || signal.confidence < 0.6) {
                    continue;
                }

                // Validate signal with risk management
                const riskValidation = await this.riskManager.validateTrade(signal, {
                    currentPortfolio: this.positions,
                    activeOrders: this.activeOrders
                });

                if (riskValidation.approved) {
                    await this.executeSignal(signal, strategy);
                } else {
                    this.logger.info(`Signal rejected by risk management: ${riskValidation.reasoning}`);
                }
            }

        } catch (error) {
            this.logger.error(`Error processing strategy ${strategy.id}:`, error);
        }
    }

    async getStrategyMarketData(strategy) {
        const markets = await this.database.getActiveMarkets(strategy.asset);
        const marketData = [];

        for (const market of markets) {
            try {
                // Get recent price data
                const priceHistory = await this.database.getPriceHistory(
                    market.asset, 
                    Date.now() - (24 * 60 * 60 * 1000), // 24 hours
                    Date.now()
                );

                // Get current order book
                const orderBook = await this.api.getOrderBook(market.marketId);

                marketData.push({
                    market,
                    priceHistory,
                    orderBook,
                    timestamp: Date.now()
                });

            } catch (error) {
                this.logger.error(`Failed to get data for market ${market.marketId}:`, error);
            }
        }

        return marketData;
    }

    async executeSignal(signal, strategy) {
        try {
            this.logger.info(`Executing signal: ${signal.signal} for ${signal.marketId} (confidence: ${signal.confidence})`);

            const order = {
                marketId: signal.marketId,
                side: signal.signal.toLowerCase(), // 'buy' or 'sell'
                type: signal.orderType || 'limit',
                price: signal.price,
                quantity: signal.quantity,
                strategyId: strategy.id,
                timeInForce: 'GTC',
                timestamp: Date.now()
            };

            // Place order through order manager
            const placedOrder = await this.orderManager.placeOrder(order);
            this.activeOrders.set(placedOrder.orderId, placedOrder);

            this.emit('orderPlaced', placedOrder);

        } catch (error) {
            this.logger.error('Failed to execute signal:', error);
            this.emit('error', error);
        }
    }

    async handleStrategySignal(signal) {
        // This is called when strategies emit signals outside the main execution loop
        try {
            const strategy = this.activeStrategies.get(signal.strategyId);
            if (!strategy) {
                this.logger.warn(`Unknown strategy ID: ${signal.strategyId}`);
                return;
            }

            await this.executeSignal(signal, strategy);
        } catch (error) {
            this.logger.error('Failed to handle strategy signal:', error);
        }
    }

    async handleOrderFilled(trade) {
        try {
            this.logger.info(`Order filled: ${trade.orderId} - ${trade.side} ${trade.quantity} at ${trade.price}`);

            // Remove from active orders
            this.activeOrders.delete(trade.orderId);

            // Update positions
            await this.updatePositionFromTrade(trade);

            // Update P&L
            this.updatePnLFromTrade(trade);

            // Save trade to database
            await this.database.saveTrade(trade);

            // Update performance stats
            this.tradesExecuted++;
            if (trade.profitLoss > 0) {
                this.winningTrades++;
            }

            this.emit('orderFilled', trade);

        } catch (error) {
            this.logger.error('Failed to handle filled order:', error);
        }
    }

    async handleOrderCancelled(order) {
        this.logger.info(`Order cancelled: ${order.orderId}`);
        this.activeOrders.delete(order.orderId);
        
        // Update order status in database
        order.status = 'cancelled';
        await this.database.saveOrder(order);
    }

    async handleOrderFailed(error) {
        this.logger.error('Order failed:', error);
        this.emit('orderFailed', error);
    }

    async handleRiskLimitExceeded(risk) {
        this.logger.warn('Risk limit exceeded:', risk.type, risk.message);
        
        if (risk.severity === 'critical') {
            // Emergency stop
            await this.emergencyStop();
        } else {
            // Reduce position sizes or cancel orders
            await this.reduceRiskExposure();
        }
    }

    async updatePositionFromTrade(trade) {
        const key = `${trade.marketId}-${trade.side}`;
        
        if (!this.positions.has(key)) {
            this.positions.set(key, {
                marketId: trade.marketId,
                side: trade.side,
                quantity: 0,
                averagePrice: 0,
                totalCost: 0,
                unrealizedPnL: 0
            });
        }

        const position = this.positions.get(key);
        const newQuantity = position.quantity + trade.quantity;
        const newTotalCost = position.totalCost + (trade.quantity * trade.price);
        
        position.quantity = newQuantity;
        position.totalCost = newTotalCost;
        position.averagePrice = newQuantity > 0 ? newTotalCost / newQuantity : 0;
    }

    updatePnLFromTrade(trade) {
        this.dailyPnL += trade.profitLoss || 0;
        this.totalPnL += trade.profitLoss || 0;
    }

    async updatePositionValues() {
        for (const [key, position] of this.positions) {
            try {
                const currentPrice = await this.api.getMidpoint(position.marketId);
                const marketValue = position.quantity * (position.side === 'yes' ? currentPrice.yes : currentPrice.no);
                position.unrealizedPnL = marketValue - position.totalCost;
            } catch (error) {
                this.logger.debug(`Failed to update position value for ${key}:`, error);
            }
        }
    }

    async manageExistingOrders() {
        const now = Date.now();
        const maxOrderAge = 5 * 60 * 1000; // 5 minutes

        for (const [orderId, order] of this.activeOrders) {
            if (now - order.timestamp > maxOrderAge) {
                try {
                    await this.orderManager.cancelOrder(orderId);
                    this.logger.info(`Cancelled stale order: ${orderId}`);
                } catch (error) {
                    this.logger.error(`Failed to cancel stale order ${orderId}:`, error);
                }
            }
        }
    }

    async emergencyStop() {
        this.logger.warn('Emergency stop triggered!');
        
        try {
            await this.stop();
            // Cancel all orders
            await this.cancelAllOrders();
            
            this.emit('emergencyStop');
        } catch (error) {
            this.logger.error('Error during emergency stop:', error);
        }
    }

    async cancelAllOrders() {
        const cancelPromises = Array.from(this.activeOrders.keys()).map(orderId =>
            this.orderManager.cancelOrder(orderId).catch(error =>
                this.logger.error(`Failed to cancel order ${orderId}:`, error)
            )
        );

        await Promise.allSettled(cancelPromises);
        this.activeOrders.clear();
    }

    async reduceRiskExposure() {
        // Implement risk reduction logic
        // Could cancel some orders, reduce position sizes, etc.
        this.logger.info('Reducing risk exposure...');
        
        // Cancel orders with lowest confidence
        // This would require tracking confidence scores
    }

    async saveCurrentState() {
        try {
            // Save performance data
            const today = new Date().toISOString().split('T')[0];
            const performanceData = {
                date: today,
                strategy: 'ALL',
                totalPnL: this.totalPnL,
                dailyPnL: this.dailyPnL,
                tradesExecuted: this.tradesExecuted,
                winningTrades: this.winningTrades,
                winRate: this.tradesExecuted > 0 ? this.winningTrades / this.tradesExecuted : 0
            };

            await this.database.put('performance', performanceData);
            this.logger.info('Current state saved successfully');

        } catch (error) {
            this.logger.error('Failed to save current state:', error);
        }
    }

    // Public API methods
    getStatus() {
        return {
            isRunning: this.isRunning,
            activeStrategies: this.activeStrategies.size,
            activeOrders: this.activeOrders.size,
            positions: this.positions.size,
            dailyPnL: this.dailyPnL,
            totalPnL: this.totalPnL,
            tradesExecuted: this.tradesExecuted,
            winRate: this.tradesExecuted > 0 ? this.winningTrades / this.tradesExecuted : 0
        };
    }

    getPositions() {
        return Array.from(this.positions.values());
    }

    getActiveOrders() {
        return Array.from(this.activeOrders.values());
    }

    async addStrategy(strategyConfig) {
        const strategy = await this.strategyManager.createStrategy(strategyConfig);
        this.activeStrategies.set(strategy.id, strategy);
        await this.database.saveStrategy(strategyConfig);
        return strategy;
    }

    async removeStrategy(strategyId) {
        this.activeStrategies.delete(strategyId);
        const strategyData = await this.database.get('strategies', strategyId);
        if (strategyData) {
            strategyData.active = false;
            await this.database.saveStrategy(strategyData);
        }
    }
}