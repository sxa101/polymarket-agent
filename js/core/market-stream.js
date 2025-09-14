import { Logger } from '../utils/logger.js';
import { EventEmitter } from '../utils/event-emitter.js';

export class MarketDataStream extends EventEmitter {
    constructor() {
        super();
        this.wsUrl = 'wss://ws-subscriptions.polymarket.com';
        this.ws = null;
        this.logger = new Logger('MarketDataStream');
        
        this.subscriptions = new Set();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectDelay = 1000;
        this.isConnecting = false;
        this.isConnected = false;
        
        this.heartbeatInterval = null;
        this.heartbeatTimeout = 30000; // 30 seconds
        
        this.messageQueue = [];
        this.messageId = 1;
        this.pendingMessages = new Map();
    }

    async connect() {
        if (this.isConnecting || this.isConnected) {
            return;
        }

        this.isConnecting = true;
        this.logger.info('Connecting to Polymarket WebSocket...');

        try {
            this.ws = new WebSocket(this.wsUrl);
            this.setupWebSocketHandlers();
            
            // Wait for connection
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Connection timeout'));
                }, 10000);

                this.ws.onopen = () => {
                    clearTimeout(timeout);
                    resolve();
                };

                this.ws.onerror = (error) => {
                    clearTimeout(timeout);
                    reject(error);
                };
            });

        } catch (error) {
            this.isConnecting = false;
            this.logger.error('Failed to connect to WebSocket:', error);
            throw error;
        }
    }

    setupWebSocketHandlers() {
        this.ws.onopen = () => {
            this.logger.info('WebSocket connected successfully');
            this.isConnected = true;
            this.isConnecting = false;
            this.reconnectAttempts = 0;
            
            this.startHeartbeat();
            this.processMessageQueue();
            this.resubscribeAll();
            
            this.emit('connected');
        };

        this.ws.onclose = (event) => {
            this.logger.warn(`WebSocket disconnected: ${event.code} - ${event.reason}`);
            this.isConnected = false;
            this.isConnecting = false;
            
            this.stopHeartbeat();
            this.emit('disconnected', event);
            
            // Auto-reconnect unless it was a clean close
            if (event.code !== 1000) {
                this.scheduleReconnect();
            }
        };

        this.ws.onerror = (error) => {
            this.logger.error('WebSocket error:', error);
            this.emit('error', error);
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
            } catch (error) {
                this.logger.error('Failed to parse WebSocket message:', error);
            }
        };
    }

    handleMessage(data) {
        // Handle different message types
        switch (data.type) {
            case 'pong':
                this.handlePong(data);
                break;
            
            case 'market_update':
                this.handleMarketUpdate(data);
                break;
            
            case 'order_book_update':
                this.handleOrderBookUpdate(data);
                break;
            
            case 'trade':
                this.handleTrade(data);
                break;
            
            case 'price_update':
                this.handlePriceUpdate(data);
                break;
            
            case 'subscription_success':
                this.handleSubscriptionSuccess(data);
                break;
            
            case 'subscription_error':
                this.handleSubscriptionError(data);
                break;
            
            case 'error':
                this.handleError(data);
                break;
            
            default:
                this.logger.debug('Unknown message type:', data.type);
        }
    }

    handleMarketUpdate(data) {
        this.logger.debug('Market update received:', data.marketId);
        
        const marketData = {
            marketId: data.marketId,
            asset: data.asset,
            yesPrice: parseFloat(data.yesPrice || '0'),
            noPrice: parseFloat(data.noPrice || '0'),
            volume: parseFloat(data.volume || '0'),
            timestamp: data.timestamp || Date.now(),
            spread: data.spread,
            liquidity: data.liquidity
        };

        this.emit('marketUpdate', marketData);
    }

    handleOrderBookUpdate(data) {
        this.logger.debug('Order book update received:', data.marketId);
        
        const orderBookData = {
            marketId: data.marketId,
            bids: data.bids?.map(bid => ({
                price: parseFloat(bid[0]),
                size: parseFloat(bid[1])
            })) || [],
            asks: data.asks?.map(ask => ({
                price: parseFloat(ask[0]),
                size: parseFloat(ask[1])
            })) || [],
            timestamp: data.timestamp || Date.now()
        };

        this.emit('orderBookUpdate', orderBookData);
    }

    handleTrade(data) {
        this.logger.debug('Trade received:', data.marketId);
        
        const tradeData = {
            marketId: data.marketId,
            price: parseFloat(data.price),
            size: parseFloat(data.size),
            side: data.side,
            timestamp: data.timestamp || Date.now(),
            tradeId: data.tradeId
        };

        this.emit('trade', tradeData);
    }

    handlePriceUpdate(data) {
        this.logger.debug('Price update received:', data.marketId);
        
        const priceData = {
            marketId: data.marketId,
            asset: data.asset,
            yesPrice: parseFloat(data.yesPrice || '0'),
            noPrice: parseFloat(data.noPrice || '0'),
            lastTradePrice: parseFloat(data.lastTradePrice || '0'),
            volume24h: parseFloat(data.volume24h || '0'),
            timestamp: data.timestamp || Date.now()
        };

        this.emit('priceUpdate', priceData);
    }

    handleSubscriptionSuccess(data) {
        this.logger.info(`Subscription successful: ${data.channel} - ${data.marketId}`);
        
        if (data.messageId) {
            const pending = this.pendingMessages.get(data.messageId);
            if (pending) {
                pending.resolve(data);
                this.pendingMessages.delete(data.messageId);
            }
        }
    }

    handleSubscriptionError(data) {
        this.logger.error(`Subscription error: ${data.channel} - ${data.error}`);
        
        if (data.messageId) {
            const pending = this.pendingMessages.get(data.messageId);
            if (pending) {
                pending.reject(new Error(data.error));
                this.pendingMessages.delete(data.messageId);
            }
        }
    }

    handleError(data) {
        this.logger.error('WebSocket error message:', data.error);
        this.emit('error', new Error(data.error));
    }

    handlePong(data) {
        // Heartbeat response received
        this.logger.debug('Pong received');
    }

    async sendMessage(message) {
        if (!this.isConnected) {
            this.messageQueue.push(message);
            return;
        }

        try {
            this.ws.send(JSON.stringify(message));
        } catch (error) {
            this.logger.error('Failed to send message:', error);
            throw error;
        }
    }

    async sendMessageWithResponse(message, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const messageId = this.messageId++;
            message.messageId = messageId;
            
            this.pendingMessages.set(messageId, { resolve, reject });
            
            const timeoutId = setTimeout(() => {
                this.pendingMessages.delete(messageId);
                reject(new Error('Message timeout'));
            }, timeout);
            
            this.pendingMessages.get(messageId).timeoutId = timeoutId;
            
            this.sendMessage(message).catch(reject);
        });
    }

    processMessageQueue() {
        while (this.messageQueue.length > 0 && this.isConnected) {
            const message = this.messageQueue.shift();
            this.sendMessage(message).catch(error => {
                this.logger.error('Failed to send queued message:', error);
            });
        }
    }

    async subscribeToMarket(marketId) {
        try {
            const message = {
                type: 'subscribe',
                channel: 'market',
                marketId: marketId
            };

            await this.sendMessageWithResponse(message);
            this.subscriptions.add(`market:${marketId}`);
            this.logger.info(`Subscribed to market: ${marketId}`);
            
        } catch (error) {
            this.logger.error(`Failed to subscribe to market ${marketId}:`, error);
            throw error;
        }
    }

    async subscribeToOrderBook(marketId) {
        try {
            const message = {
                type: 'subscribe',
                channel: 'orderbook',
                marketId: marketId
            };

            await this.sendMessageWithResponse(message);
            this.subscriptions.add(`orderbook:${marketId}`);
            this.logger.info(`Subscribed to order book: ${marketId}`);
            
        } catch (error) {
            this.logger.error(`Failed to subscribe to order book ${marketId}:`, error);
            throw error;
        }
    }

    async subscribeToTrades(marketId) {
        try {
            const message = {
                type: 'subscribe',
                channel: 'trades',
                marketId: marketId
            };

            await this.sendMessageWithResponse(message);
            this.subscriptions.add(`trades:${marketId}`);
            this.logger.info(`Subscribed to trades: ${marketId}`);
            
        } catch (error) {
            this.logger.error(`Failed to subscribe to trades ${marketId}:`, error);
            throw error;
        }
    }

    async subscribeToUserUpdates(address) {
        try {
            const message = {
                type: 'subscribe',
                channel: 'user',
                address: address
            };

            await this.sendMessageWithResponse(message);
            this.subscriptions.add(`user:${address}`);
            this.logger.info(`Subscribed to user updates: ${address}`);
            
        } catch (error) {
            this.logger.error(`Failed to subscribe to user updates ${address}:`, error);
            throw error;
        }
    }

    async unsubscribeFromMarket(marketId) {
        try {
            const message = {
                type: 'unsubscribe',
                channel: 'market',
                marketId: marketId
            };

            await this.sendMessageWithResponse(message);
            this.subscriptions.delete(`market:${marketId}`);
            this.logger.info(`Unsubscribed from market: ${marketId}`);
            
        } catch (error) {
            this.logger.error(`Failed to unsubscribe from market ${marketId}:`, error);
            throw error;
        }
    }

    async unsubscribeFromOrderBook(marketId) {
        try {
            const message = {
                type: 'unsubscribe',
                channel: 'orderbook',
                marketId: marketId
            };

            await this.sendMessageWithResponse(message);
            this.subscriptions.delete(`orderbook:${marketId}`);
            this.logger.info(`Unsubscribed from order book: ${marketId}`);
            
        } catch (error) {
            this.logger.error(`Failed to unsubscribe from order book ${marketId}:`, error);
            throw error;
        }
    }

    async unsubscribeAll() {
        const subscriptionList = Array.from(this.subscriptions);
        
        for (const subscription of subscriptionList) {
            const [channel, id] = subscription.split(':');
            try {
                const message = {
                    type: 'unsubscribe',
                    channel: channel,
                    [channel === 'user' ? 'address' : 'marketId']: id
                };

                await this.sendMessage(message);
                this.subscriptions.delete(subscription);
            } catch (error) {
                this.logger.error(`Failed to unsubscribe from ${subscription}:`, error);
            }
        }
    }

    async resubscribeAll() {
        const subscriptionList = Array.from(this.subscriptions);
        
        for (const subscription of subscriptionList) {
            const [channel, id] = subscription.split(':');
            try {
                const message = {
                    type: 'subscribe',
                    channel: channel,
                    [channel === 'user' ? 'address' : 'marketId']: id
                };

                await this.sendMessage(message);
            } catch (error) {
                this.logger.error(`Failed to resubscribe to ${subscription}:`, error);
            }
        }
    }

    startHeartbeat() {
        this.stopHeartbeat();
        
        this.heartbeatInterval = setInterval(() => {
            if (this.isConnected) {
                this.sendMessage({ type: 'ping' }).catch(error => {
                    this.logger.error('Failed to send heartbeat:', error);
                });
            }
        }, this.heartbeatTimeout);
    }

    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.logger.error('Max reconnect attempts reached, giving up');
            return;
        }

        const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts), 30000);
        this.reconnectAttempts++;

        this.logger.info(`Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

        setTimeout(() => {
            this.connect().catch(error => {
                this.logger.error('Reconnect attempt failed:', error);
                this.scheduleReconnect();
            });
        }, delay);
    }

    disconnect() {
        this.logger.info('Disconnecting WebSocket...');
        
        this.stopHeartbeat();
        
        if (this.ws) {
            this.ws.close(1000, 'Client disconnect');
            this.ws = null;
        }
        
        this.isConnected = false;
        this.isConnecting = false;
        this.subscriptions.clear();
        this.messageQueue.length = 0;
        
        // Clear pending messages
        for (const [messageId, pending] of this.pendingMessages) {
            if (pending.timeoutId) {
                clearTimeout(pending.timeoutId);
            }
            pending.reject(new Error('Connection closed'));
        }
        this.pendingMessages.clear();
    }

    isConnected() {
        return this.isConnected;
    }

    getSubscriptions() {
        return Array.from(this.subscriptions);
    }

    getConnectionInfo() {
        return {
            connected: this.isConnected,
            connecting: this.isConnecting,
            reconnectAttempts: this.reconnectAttempts,
            subscriptions: this.getSubscriptions().length,
            messageQueueLength: this.messageQueue.length
        };
    }
}