import { Logger } from '../utils/logger.js';

export class DatabaseManager {
    constructor() {
        this.db = null;
        this.dbName = 'PolymarketTradingAgent';
        this.dbVersion = 1;
        this.logger = new Logger('DatabaseManager');
        
        this.stores = {
            markets: 'markets',
            priceHistory: 'priceHistory', 
            strategies: 'strategies',
            orders: 'orders',
            trades: 'trades',
            performance: 'performance',
            userConfig: 'userConfig',
            alertRules: 'alertRules',
            alertHistory: 'alertHistory'
        };
    }

    async initialize() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onerror = () => {
                this.logger.error('Database failed to open:', request.error);
                reject(request.error);
            };
            
            request.onsuccess = () => {
                this.db = request.result;
                this.logger.info('Database opened successfully');
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                this.db = event.target.result;
                this.logger.info('Database upgrade needed, creating object stores');
                this.createObjectStores();
            };
        });
    }

    createObjectStores() {
        // Markets store
        if (!this.db.objectStoreNames.contains(this.stores.markets)) {
            const marketsStore = this.db.createObjectStore(this.stores.markets, { keyPath: 'marketId' });
            marketsStore.createIndex('asset', 'asset', { unique: false });
            marketsStore.createIndex('startTime', 'startTime', { unique: false });
            marketsStore.createIndex('status', 'status', { unique: false });
            marketsStore.createIndex('endTime', 'endTime', { unique: false });
            marketsStore.createIndex('assetStatus', ['asset', 'status'], { unique: false });
        }

        // Price History store
        if (!this.db.objectStoreNames.contains(this.stores.priceHistory)) {
            const priceHistoryStore = this.db.createObjectStore(this.stores.priceHistory, { keyPath: ['marketId', 'timestamp'] });
            priceHistoryStore.createIndex('asset', 'asset', { unique: false });
            priceHistoryStore.createIndex('timestamp', 'timestamp', { unique: false });
            priceHistoryStore.createIndex('marketId', 'marketId', { unique: false });
            priceHistoryStore.createIndex('assetTime', ['asset', 'timestamp'], { unique: false });
        }

        // Strategies store
        if (!this.db.objectStoreNames.contains(this.stores.strategies)) {
            const strategiesStore = this.db.createObjectStore(this.stores.strategies, { keyPath: 'strategyId' });
            strategiesStore.createIndex('name', 'name', { unique: false });
            strategiesStore.createIndex('active', 'active', { unique: false });
            strategiesStore.createIndex('asset', 'asset', { unique: false });
            strategiesStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // Orders store
        if (!this.db.objectStoreNames.contains(this.stores.orders)) {
            const ordersStore = this.db.createObjectStore(this.stores.orders, { keyPath: 'orderId' });
            ordersStore.createIndex('marketId', 'marketId', { unique: false });
            ordersStore.createIndex('status', 'status', { unique: false });
            ordersStore.createIndex('timestamp', 'timestamp', { unique: false });
            ordersStore.createIndex('strategy', 'strategy', { unique: false });
            ordersStore.createIndex('statusTime', ['status', 'timestamp'], { unique: false });
        }

        // Trades store
        if (!this.db.objectStoreNames.contains(this.stores.trades)) {
            const tradesStore = this.db.createObjectStore(this.stores.trades, { keyPath: 'tradeId' });
            tradesStore.createIndex('marketId', 'marketId', { unique: false });
            tradesStore.createIndex('timestamp', 'timestamp', { unique: false });
            tradesStore.createIndex('profitLoss', 'profitLoss', { unique: false });
            tradesStore.createIndex('strategy', 'strategy', { unique: false });
            tradesStore.createIndex('strategyTime', ['strategy', 'timestamp'], { unique: false });
        }

        // Performance store
        if (!this.db.objectStoreNames.contains(this.stores.performance)) {
            const performanceStore = this.db.createObjectStore(this.stores.performance, { keyPath: ['date', 'strategy'] });
            performanceStore.createIndex('strategy', 'strategy', { unique: false });
            performanceStore.createIndex('date', 'date', { unique: false });
            performanceStore.createIndex('totalPnL', 'totalPnL', { unique: false });
        }

        // User Config store
        if (!this.db.objectStoreNames.contains(this.stores.userConfig)) {
            this.db.createObjectStore(this.stores.userConfig, { keyPath: 'configKey' });
        }

        // Alert Rules store
        if (!this.db.objectStoreNames.contains(this.stores.alertRules)) {
            const alertRulesStore = this.db.createObjectStore(this.stores.alertRules, { keyPath: 'id' });
            alertRulesStore.createIndex('type', 'type', { unique: false });
            alertRulesStore.createIndex('priority', 'priority', { unique: false });
            alertRulesStore.createIndex('enabled', 'enabled', { unique: false });
            alertRulesStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // Alert History store
        if (!this.db.objectStoreNames.contains(this.stores.alertHistory)) {
            const alertHistoryStore = this.db.createObjectStore(this.stores.alertHistory, { keyPath: 'id' });
            alertHistoryStore.createIndex('ruleId', 'ruleId', { unique: false });
            alertHistoryStore.createIndex('type', 'type', { unique: false });
            alertHistoryStore.createIndex('priority', 'priority', { unique: false });
            alertHistoryStore.createIndex('timestamp', 'timestamp', { unique: false });
            alertHistoryStore.createIndex('acknowledged', 'acknowledged', { unique: false });
        }
    }

    // Generic CRUD operations
    async add(storeName, data) {
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        
        return new Promise((resolve, reject) => {
            const request = store.add(data);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async put(storeName, data) {
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        
        return new Promise((resolve, reject) => {
            const request = store.put(data);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async get(storeName, key) {
        const transaction = this.db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        
        return new Promise((resolve, reject) => {
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAll(storeName, query = null, count = null) {
        const transaction = this.db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        
        return new Promise((resolve, reject) => {
            const request = store.getAll(query, count);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async delete(storeName, key) {
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        
        return new Promise((resolve, reject) => {
            const request = store.delete(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async clear(storeName) {
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        
        return new Promise((resolve, reject) => {
            const request = store.clear();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getByIndex(storeName, indexName, value) {
        const transaction = this.db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const index = store.index(indexName);
        
        return new Promise((resolve, reject) => {
            const request = index.get(value);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAllByIndex(storeName, indexName, value) {
        const transaction = this.db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const index = store.index(indexName);
        
        return new Promise((resolve, reject) => {
            const request = index.getAll(value);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Market-specific operations
    async saveMarket(market) {
        try {
            await this.put(this.stores.markets, {
                marketId: market.id,
                asset: market.asset,
                startTime: market.startTime,
                endTime: market.endTime,
                currentPrice: market.currentPrice,
                yesShares: market.yesShares,
                noShares: market.noShares,
                chainlinkReference: market.chainlinkReference,
                status: market.status,
                metadata: market.metadata,
                updatedAt: Date.now()
            });
            this.logger.debug(`Market saved: ${market.id}`);
        } catch (error) {
            this.logger.error('Failed to save market:', error);
            throw error;
        }
    }

    async getActiveMarkets(asset = null) {
        try {
            if (asset) {
                return await this.getAllByIndex(this.stores.markets, 'assetStatus', [asset, 'active']);
            } else {
                return await this.getAllByIndex(this.stores.markets, 'status', 'active');
            }
        } catch (error) {
            this.logger.error('Failed to get active markets:', error);
            throw error;
        }
    }

    // Price history operations
    async savePriceData(marketId, asset, timestamp, priceData) {
        try {
            await this.put(this.stores.priceHistory, {
                marketId,
                asset,
                timestamp,
                yesPrice: priceData.yesPrice,
                noPrice: priceData.noPrice,
                volume: priceData.volume,
                spread: priceData.spread
            });
        } catch (error) {
            this.logger.error('Failed to save price data:', error);
            throw error;
        }
    }

    async getPriceHistory(asset, startTime, endTime) {
        const transaction = this.db.transaction([this.stores.priceHistory], 'readonly');
        const store = transaction.objectStore(storeName);
        const index = store.index('assetTime');
        
        return new Promise((resolve, reject) => {
            const results = [];
            const range = IDBKeyRange.bound([asset, startTime], [asset, endTime]);
            const request = index.openCursor(range);
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    results.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };
            
            request.onerror = () => reject(request.error);
        });
    }

    // Strategy operations
    async saveStrategy(strategy) {
        try {
            await this.put(this.stores.strategies, {
                ...strategy,
                updatedAt: Date.now()
            });
            this.logger.debug(`Strategy saved: ${strategy.strategyId}`);
        } catch (error) {
            this.logger.error('Failed to save strategy:', error);
            throw error;
        }
    }

    async getActiveStrategies() {
        try {
            return await this.getAllByIndex(this.stores.strategies, 'active', true);
        } catch (error) {
            this.logger.error('Failed to get active strategies:', error);
            throw error;
        }
    }

    // Order operations
    async saveOrder(order) {
        try {
            await this.put(this.stores.orders, {
                ...order,
                updatedAt: Date.now()
            });
            this.logger.debug(`Order saved: ${order.orderId}`);
        } catch (error) {
            this.logger.error('Failed to save order:', error);
            throw error;
        }
    }

    async getOpenOrders() {
        try {
            return await this.getAllByIndex(this.stores.orders, 'status', 'open');
        } catch (error) {
            this.logger.error('Failed to get open orders:', error);
            throw error;
        }
    }

    // Trade operations
    async saveTrade(trade) {
        try {
            await this.put(this.stores.trades, {
                ...trade,
                createdAt: Date.now()
            });
            this.logger.debug(`Trade saved: ${trade.tradeId}`);
        } catch (error) {
            this.logger.error('Failed to save trade:', error);
            throw error;
        }
    }

    async getRecentTrades(limit = 50) {
        const transaction = this.db.transaction([this.stores.trades], 'readonly');
        const store = transaction.objectStore(this.stores.trades);
        const index = store.index('timestamp');
        
        return new Promise((resolve, reject) => {
            const results = [];
            const request = index.openCursor(null, 'prev'); // Reverse order
            let count = 0;
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor && count < limit) {
                    results.push(cursor.value);
                    count++;
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };
            
            request.onerror = () => reject(request.error);
        });
    }

    // Configuration operations
    async saveConfig(key, value) {
        try {
            await this.put(this.stores.userConfig, {
                configKey: key,
                value: value,
                updatedAt: Date.now()
            });
        } catch (error) {
            this.logger.error('Failed to save config:', error);
            throw error;
        }
    }

    async getConfig(key, defaultValue = null) {
        try {
            const result = await this.get(this.stores.userConfig, key);
            return result ? result.value : defaultValue;
        } catch (error) {
            this.logger.error('Failed to get config:', error);
            return defaultValue;
        }
    }

    // Cleanup operations
    async cleanupOldData(daysToKeep = 30) {
        const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
        
        try {
            // Clean old price history
            const transaction = this.db.transaction([this.stores.priceHistory], 'readwrite');
            const store = transaction.objectStore(this.stores.priceHistory);
            const index = store.index('timestamp');
            const range = IDBKeyRange.upperBound(cutoffTime);
            
            await new Promise((resolve, reject) => {
                const request = index.openCursor(range);
                request.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        cursor.delete();
                        cursor.continue();
                    } else {
                        resolve();
                    }
                };
                request.onerror = () => reject(request.error);
            });
            
            this.logger.info(`Cleaned up old data older than ${daysToKeep} days`);
        } catch (error) {
            this.logger.error('Failed to cleanup old data:', error);
        }
    }

    async close() {
        if (this.db) {
            this.db.close();
            this.db = null;
            this.logger.info('Database connection closed');
        }
    }

    // Statistics and analytics
    async getPerformanceStats(strategyId = null, days = 30) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        
        try {
            const transaction = this.db.transaction([this.stores.trades], 'readonly');
            const store = transaction.objectStore(this.stores.trades);
            const index = strategyId ? store.index('strategyTime') : store.index('timestamp');
            
            return new Promise((resolve, reject) => {
                const stats = {
                    totalTrades: 0,
                    winningTrades: 0,
                    losingTrades: 0,
                    totalPnL: 0,
                    maxDrawdown: 0,
                    averageReturn: 0
                };
                
                const range = strategyId 
                    ? IDBKeyRange.bound([strategyId, startDate.getTime()], [strategyId, Date.now()])
                    : IDBKeyRange.lowerBound(startDate.getTime());
                    
                const request = index.openCursor(range);
                
                request.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        const trade = cursor.value;
                        stats.totalTrades++;
                        stats.totalPnL += trade.profitLoss;
                        
                        if (trade.profitLoss > 0) {
                            stats.winningTrades++;
                        } else {
                            stats.losingTrades++;
                        }
                        
                        cursor.continue();
                    } else {
                        stats.winRate = stats.totalTrades > 0 ? stats.winningTrades / stats.totalTrades : 0;
                        stats.averageReturn = stats.totalTrades > 0 ? stats.totalPnL / stats.totalTrades : 0;
                        resolve(stats);
                    }
                };
                
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            this.logger.error('Failed to get performance stats:', error);
            throw error;
        }
    }

    // Alert Rules Management
    async getAlertRules() {
        try {
            return await this.getAll(this.stores.alertRules);
        } catch (error) {
            this.logger.error('Failed to get alert rules:', error);
            return [];
        }
    }

    async saveAlertRule(rule) {
        try {
            return await this.put(this.stores.alertRules, rule);
        } catch (error) {
            this.logger.error('Failed to save alert rule:', error);
            throw error;
        }
    }

    async deleteAlertRule(ruleId) {
        try {
            return await this.delete(this.stores.alertRules, ruleId);
        } catch (error) {
            this.logger.error('Failed to delete alert rule:', error);
            throw error;
        }
    }

    async getAlertRule(ruleId) {
        try {
            return await this.get(this.stores.alertRules, ruleId);
        } catch (error) {
            this.logger.error('Failed to get alert rule:', error);
            return null;
        }
    }

    // Alert History Management
    async saveAlertHistory(alert) {
        try {
            return await this.put(this.stores.alertHistory, alert);
        } catch (error) {
            this.logger.error('Failed to save alert to history:', error);
            throw error;
        }
    }

    async getAlertHistory(limit = 100) {
        try {
            const transaction = this.db.transaction([this.stores.alertHistory], 'readonly');
            const store = transaction.objectStore(this.stores.alertHistory);
            const index = store.index('timestamp');
            
            return new Promise((resolve, reject) => {
                const alerts = [];
                const request = index.openCursor(null, 'prev'); // Reverse order (newest first)
                
                request.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor && alerts.length < limit) {
                        alerts.push(cursor.value);
                        cursor.continue();
                    } else {
                        resolve(alerts);
                    }
                };
                
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            this.logger.error('Failed to get alert history:', error);
            return [];
        }
    }

    async getAlertHistoryByRule(ruleId) {
        try {
            const transaction = this.db.transaction([this.stores.alertHistory], 'readonly');
            const store = transaction.objectStore(this.stores.alertHistory);
            const index = store.index('ruleId');
            
            return new Promise((resolve, reject) => {
                const alerts = [];
                const request = index.openCursor(IDBKeyRange.only(ruleId));
                
                request.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        alerts.push(cursor.value);
                        cursor.continue();
                    } else {
                        resolve(alerts);
                    }
                };
                
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            this.logger.error('Failed to get alert history by rule:', error);
            return [];
        }
    }

    async cleanupOldAlerts(cutoffTime) {
        try {
            const transaction = this.db.transaction([this.stores.alertHistory], 'readwrite');
            const store = transaction.objectStore(this.stores.alertHistory);
            const index = store.index('timestamp');
            
            return new Promise((resolve, reject) => {
                let deletedCount = 0;
                const request = index.openCursor(IDBKeyRange.upperBound(cutoffTime));
                
                request.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        cursor.delete();
                        deletedCount++;
                        cursor.continue();
                    } else {
                        this.logger.info(`Cleaned up ${deletedCount} old alerts`);
                        resolve(deletedCount);
                    }
                };
                
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            this.logger.error('Failed to cleanup old alerts:', error);
            throw error;
        }
    }

    // Enhanced methods for alert system
    async getAllTrades() {
        try {
            return await this.getAll(this.stores.trades);
        } catch (error) {
            this.logger.error('Failed to get all trades:', error);
            return [];
        }
    }
}