import { Logger } from '../utils/logger.js';
import { EventEmitter } from '../utils/event-emitter.js';
import { ProductionConfig } from '../config/production-config.js';

export class RealWebSocketManager extends EventEmitter {
    constructor() {
        super();
        this.logger = new Logger('RealWebSocketManager');
        
        this.ws = null;
        this.connected = false;
        this.authenticated = false;
        this.subscriptions = new Map();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = ProductionConfig.RATE_LIMITS.MAX_WEBSOCKET_RECONNECT_ATTEMPTS;
        this.reconnectDelay = ProductionConfig.RATE_LIMITS.WEBSOCKET_RECONNECT_DELAY;
        this.pingInterval = null;
        this.lastPong = Date.now();
        
        // Message queue for when disconnected
        this.messageQueue = [];
        this.isReconnecting = false;
        
        // Subscription management
        this.activeSubscriptions = {
            markets: new Set(),
            orderbooks: new Set(),
            trades: new Set(),
            midpoints: new Set()
        };
        
        // Rate limiting
        this.lastMessageTime = 0;
        this.messageRateLimit = 100; // ms between messages
    }

    async initialize() {
        try {
            this.logger.info('Initializing Real WebSocket Manager...');
            
            if (!ProductionConfig.POLYMARKET_APIS.WEBSOCKET) {
                throw new Error('WebSocket URL not configured');
            }
            
            await this.connect();
            this.setupHeartbeat();
            
            this.logger.info('Real WebSocket Manager initialized successfully');
            return true;
            
        } catch (error) {
            this.logger.error('Failed to initialize Real WebSocket Manager:', error);
            throw error;
        }
    }

    async connect() {
        if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
            this.logger.info('WebSocket already connecting or connected');
            return;
        }

        try {
            this.logger.info(`Connecting to WebSocket: ${ProductionConfig.POLYMARKET_APIS.WEBSOCKET}`);
            
            this.ws = new WebSocket(ProductionConfig.POLYMARKET_APIS.WEBSOCKET);
            
            this.ws.onopen = this.handleOpen.bind(this);
            this.ws.onmessage = this.handleMessage.bind(this);
            this.ws.onclose = this.handleClose.bind(this);
            this.ws.onerror = this.handleError.bind(this);
            
            // Wait for connection or timeout
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('WebSocket connection timeout'));
                }, 10000);
                
                this.once('connected', () => {
                    clearTimeout(timeout);
                    resolve();
                });
                
                this.once('error', (error) => {
                    clearTimeout(timeout);
                    reject(error);
                });
            });
            
        } catch (error) {
            this.logger.error('Failed to connect WebSocket:', error);
            throw error;
        }
    }

    handleOpen(event) {
        this.logger.info('WebSocket connected successfully');
        this.connected = true;
        this.reconnectAttempts = 0;
        this.isReconnecting = false;
        this.lastPong = Date.now();
        
        // Process queued messages
        this.processMessageQueue();
        
        // Resubscribe to previous subscriptions
        this.resubscribeAll();
        
        this.emit('connected');
    }

    handleMessage(event) {
        try {
            const data = JSON.parse(event.data);
            this.processMessage(data);
            
        } catch (error) {
            this.logger.error('Failed to parse WebSocket message:', error);
        }
    }

    processMessage(data) {
        switch (data.type) {
            case 'auth':
                this.handleAuthMessage(data);
                break;
                
            case 'pong':
                this.lastPong = Date.now();
                break;
                
            case 'market_data':
                this.handleMarketData(data);
                break;
                
            case 'orderbook':
                this.handleOrderBookData(data);
                break;
                
            case 'trade':
                this.handleTradeData(data);
                break;
                
            case 'midpoint':
                this.handleMidpointData(data);
                break;
                
            case 'error':
                this.handleErrorMessage(data);
                break;
                
            case 'subscription_success':
                this.handleSubscriptionSuccess(data);
                break;
                
            case 'subscription_error':
                this.handleSubscriptionError(data);
                break;
                
            default:
                this.logger.debug('Unknown message type:', data.type);
        }
    }

    handleAuthMessage(data) {
        if (data.success) {
            this.authenticated = true;
            this.logger.info('WebSocket authenticated successfully');
            this.emit('authenticated');
        } else {
            this.logger.error('WebSocket authentication failed:', data.error);
            this.emit('auth_error', data.error);
        }
    }

    handleMarketData(data) {
        if (data.market_id && this.activeSubscriptions.markets.has(data.market_id)) {
            this.emit('market_update', {
                marketId: data.market_id,
                data: data.data,
                timestamp: data.timestamp || Date.now()
            });
        }
    }

    handleOrderBookData(data) {
        if (data.market_id && this.activeSubscriptions.orderbooks.has(data.market_id)) {
            this.emit('orderbook_update', {
                marketId: data.market_id,
                bids: data.bids || [],
                asks: data.asks || [],
                timestamp: data.timestamp || Date.now()
            });
        }
    }

    handleTradeData(data) {
        if (data.market_id && this.activeSubscriptions.trades.has(data.market_id)) {
            this.emit('trade_update', {
                marketId: data.market_id,
                price: parseFloat(data.price),
                size: parseFloat(data.size),
                side: data.side,
                timestamp: data.timestamp || Date.now()
            });
        }
    }

    handleMidpointData(data) {
        if (data.market_id && this.activeSubscriptions.midpoints.has(data.market_id)) {
            this.emit('midpoint_update', {
                marketId: data.market_id,
                yes: parseFloat(data.yes),
                no: parseFloat(data.no),
                timestamp: data.timestamp || Date.now()
            });
        }
    }

    handleErrorMessage(data) {
        this.logger.error('WebSocket error message:', data.error);
        this.emit('ws_error', data.error);
    }

    handleSubscriptionSuccess(data) {
        this.logger.info(`Subscription successful: ${data.channel} for ${data.market_id || 'global'}`);
    }

    handleSubscriptionError(data) {
        this.logger.error(`Subscription failed: ${data.channel} for ${data.market_id || 'global'} - ${data.error}`);
    }

    handleClose(event) {
        this.logger.info(`WebSocket disconnected: ${event.code} - ${event.reason}`);
        this.connected = false;
        this.authenticated = false;
        
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
        
        this.emit('disconnected', { code: event.code, reason: event.reason });
        
        // Attempt reconnection if not manually closed
        if (event.code !== 1000 && !event.wasClean) {
            this.attemptReconnect();
        }
    }

    handleError(event) {
        this.logger.error('WebSocket error:', event);
        this.emit('error', event);
    }

    async attemptReconnect() {
        if (this.isReconnecting) return;
        
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.logger.error('Maximum reconnect attempts reached');
            this.emit('reconnect_failed');
            return;
        }
        
        this.isReconnecting = true;
        this.reconnectAttempts++;
        
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff
        
        this.logger.info(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        
        setTimeout(async () => {
            try {
                await this.connect();
            } catch (error) {
                this.logger.error('Reconnection attempt failed:', error);
                this.isReconnecting = false;
                this.attemptReconnect();
            }
        }, delay);
    }

    setupHeartbeat() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
        }
        
        this.pingInterval = setInterval(() => {
            if (this.connected && this.ws.readyState === WebSocket.OPEN) {
                // Check if we received a pong recently
                const timeSinceLastPong = Date.now() - this.lastPong;
                if (timeSinceLastPong > 30000) { // 30 seconds timeout
                    this.logger.warn('No pong received, connection may be stale');
                    this.ws.close(1006, 'Ping timeout');
                    return;
                }
                
                this.sendMessage({
                    type: 'ping',
                    timestamp: Date.now()
                });
            }
        }, 15000); // Ping every 15 seconds
    }

    // Subscription methods
    async subscribeToMarket(marketId) {
        if (this.activeSubscriptions.markets.has(marketId)) {
            this.logger.debug(`Already subscribed to market: ${marketId}`);
            return;
        }

        const success = await this.sendMessage({
            type: 'subscribe',
            channel: 'market_data',
            market_id: marketId
        });

        if (success) {
            this.activeSubscriptions.markets.add(marketId);
            this.logger.info(`Subscribed to market data: ${marketId}`);
        }
        
        return success;
    }

    async subscribeToOrderBook(marketId) {
        if (this.activeSubscriptions.orderbooks.has(marketId)) {
            this.logger.debug(`Already subscribed to orderbook: ${marketId}`);
            return;
        }

        const success = await this.sendMessage({
            type: 'subscribe',
            channel: 'orderbook',
            market_id: marketId
        });

        if (success) {
            this.activeSubscriptions.orderbooks.add(marketId);
            this.logger.info(`Subscribed to orderbook: ${marketId}`);
        }
        
        return success;
    }

    async subscribeToTrades(marketId) {
        if (this.activeSubscriptions.trades.has(marketId)) {
            this.logger.debug(`Already subscribed to trades: ${marketId}`);
            return;
        }

        const success = await this.sendMessage({
            type: 'subscribe',
            channel: 'trades',
            market_id: marketId
        });

        if (success) {
            this.activeSubscriptions.trades.add(marketId);
            this.logger.info(`Subscribed to trades: ${marketId}`);
        }
        
        return success;
    }

    async subscribeToMidpoints(marketId) {
        if (this.activeSubscriptions.midpoints.has(marketId)) {
            this.logger.debug(`Already subscribed to midpoints: ${marketId}`);
            return;
        }

        const success = await this.sendMessage({
            type: 'subscribe',
            channel: 'midpoint',
            market_id: marketId
        });

        if (success) {
            this.activeSubscriptions.midpoints.add(marketId);
            this.logger.info(`Subscribed to midpoints: ${marketId}`);
        }
        
        return success;
    }

    // Unsubscribe methods
    async unsubscribeFromMarket(marketId) {
        const success = await this.sendMessage({
            type: 'unsubscribe',
            channel: 'market_data',
            market_id: marketId
        });

        if (success) {
            this.activeSubscriptions.markets.delete(marketId);
            this.logger.info(`Unsubscribed from market data: ${marketId}`);
        }
        
        return success;
    }

    async unsubscribeFromOrderBook(marketId) {
        const success = await this.sendMessage({
            type: 'unsubscribe',
            channel: 'orderbook',
            market_id: marketId
        });

        if (success) {
            this.activeSubscriptions.orderbooks.delete(marketId);
            this.logger.info(`Unsubscribed from orderbook: ${marketId}`);
        }
        
        return success;
    }

    async unsubscribeFromTrades(marketId) {
        const success = await this.sendMessage({
            type: 'unsubscribe',
            channel: 'trades',
            market_id: marketId
        });

        if (success) {
            this.activeSubscriptions.trades.delete(marketId);
            this.logger.info(`Unsubscribed from trades: ${marketId}`);
        }
        
        return success;
    }

    async unsubscribeFromMidpoints(marketId) {
        const success = await this.sendMessage({
            type: 'unsubscribe',
            channel: 'midpoint',
            market_id: marketId
        });

        if (success) {
            this.activeSubscriptions.midpoints.delete(marketId);
            this.logger.info(`Unsubscribed from midpoints: ${marketId}`);
        }
        
        return success;
    }

    // Message sending with rate limiting
    async sendMessage(message) {
        const now = Date.now();
        const timeSinceLastMessage = now - this.lastMessageTime;
        
        if (timeSinceLastMessage < this.messageRateLimit) {
            await new Promise(resolve => 
                setTimeout(resolve, this.messageRateLimit - timeSinceLastMessage)
            );
        }

        if (!this.connected || this.ws.readyState !== WebSocket.OPEN) {
            this.messageQueue.push(message);
            this.logger.debug('Message queued (not connected):', message);
            return false;
        }

        try {
            const messageStr = JSON.stringify(message);
            this.ws.send(messageStr);
            this.lastMessageTime = Date.now();
            
            this.logger.debug('Message sent:', message);
            return true;
            
        } catch (error) {
            this.logger.error('Failed to send message:', error);
            return false;
        }
    }

    processMessageQueue() {
        if (this.messageQueue.length === 0) return;
        
        this.logger.info(`Processing ${this.messageQueue.length} queued messages`);
        
        const queue = [...this.messageQueue];
        this.messageQueue = [];
        
        queue.forEach(async (message) => {
            await this.sendMessage(message);
        });
    }

    async resubscribeAll() {
        this.logger.info('Resubscribing to all previous subscriptions');
        
        // Resubscribe to markets
        for (const marketId of this.activeSubscriptions.markets) {
            await this.subscribeToMarket(marketId);
        }
        
        // Resubscribe to orderbooks
        for (const marketId of this.activeSubscriptions.orderbooks) {
            await this.subscribeToOrderBook(marketId);
        }
        
        // Resubscribe to trades
        for (const marketId of this.activeSubscriptions.trades) {
            await this.subscribeToTrades(marketId);
        }
        
        // Resubscribe to midpoints
        for (const marketId of this.activeSubscriptions.midpoints) {
            await this.subscribeToMidpoints(marketId);
        }
    }

    // Utility methods
    isConnected() {
        return this.connected && this.ws.readyState === WebSocket.OPEN;
    }

    isAuthenticated() {
        return this.authenticated;
    }

    getConnectionStatus() {
        return {
            connected: this.connected,
            authenticated: this.authenticated,
            reconnectAttempts: this.reconnectAttempts,
            activeSubscriptions: {
                markets: this.activeSubscriptions.markets.size,
                orderbooks: this.activeSubscriptions.orderbooks.size,
                trades: this.activeSubscriptions.trades.size,
                midpoints: this.activeSubscriptions.midpoints.size
            },
            queuedMessages: this.messageQueue.length,
            lastPong: this.lastPong
        };
    }

    // Cleanup methods
    async disconnect() {
        this.logger.info('Manually disconnecting WebSocket');
        
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
        
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.close(1000, 'Manual disconnect');
        }
        
        this.connected = false;
        this.authenticated = false;
        this.activeSubscriptions.markets.clear();
        this.activeSubscriptions.orderbooks.clear();
        this.activeSubscriptions.trades.clear();
        this.activeSubscriptions.midpoints.clear();
        this.messageQueue = [];
    }

    destroy() {
        this.disconnect();
        this.removeAllListeners();
        this.logger.info('Real WebSocket Manager destroyed');
    }
}