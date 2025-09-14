import { Logger } from '../utils/logger.js';
import { EventEmitter } from '../utils/event-emitter.js';

export class OrderManager extends EventEmitter {
    constructor({ database, api, wallet }) {
        super();
        this.database = database;
        this.api = api;
        this.wallet = wallet;
        this.logger = new Logger('OrderManager');
        
        this.activeOrders = new Map();
        this.orderQueue = [];
        this.isProcessing = false;
        this.maxRetries = 3;
        this.retryDelay = 1000; // 1 second
        
        // Order monitoring
        this.monitoringInterval = null;
        this.monitoringFrequency = 10000; // 10 seconds
    }

    async initialize() {
        try {
            // Load existing orders from database
            await this.loadActiveOrders();
            
            // Start order monitoring
            this.startOrderMonitoring();
            
            this.logger.info('Order manager initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize order manager:', error);
            throw error;
        }
    }

    async loadActiveOrders() {
        try {
            const orders = await this.database.getOpenOrders();
            for (const order of orders) {
                this.activeOrders.set(order.orderId, order);
            }
            
            this.logger.info(`Loaded ${orders.length} active orders`);
        } catch (error) {
            this.logger.error('Failed to load active orders:', error);
            throw error;
        }
    }

    async placeOrder(orderData) {
        try {
            this.logger.info(`Placing order: ${orderData.side} ${orderData.quantity} at ${orderData.price}`);

            // Validate order data
            const validation = this.validateOrder(orderData);
            if (!validation.valid) {
                throw new Error(`Invalid order: ${validation.error}`);
            }

            // Generate order ID
            const orderId = this.generateOrderId();
            
            const order = {
                orderId,
                marketId: orderData.marketId,
                side: orderData.side, // 'buy' or 'sell'
                type: orderData.type || 'limit',
                price: orderData.price,
                quantity: orderData.quantity,
                strategyId: orderData.strategyId,
                timeInForce: orderData.timeInForce || 'GTC',
                status: 'pending',
                timestamp: Date.now(),
                retryCount: 0
            };

            // Add to queue for processing
            this.orderQueue.push(order);
            this.processOrderQueue();

            return order;

        } catch (error) {
            this.logger.error('Failed to place order:', error);
            throw error;
        }
    }

    async processOrderQueue() {
        if (this.isProcessing || this.orderQueue.length === 0) {
            return;
        }

        this.isProcessing = true;

        while (this.orderQueue.length > 0) {
            const order = this.orderQueue.shift();
            
            try {
                await this.executeOrder(order);
            } catch (error) {
                this.logger.error(`Failed to execute order ${order.orderId}:`, error);
                await this.handleOrderError(order, error);
            }
        }

        this.isProcessing = false;
    }

    async executeOrder(order) {
        try {
            // Ensure wallet is connected
            if (!this.wallet.isConnected()) {
                throw new Error('Wallet not connected');
            }

            // Get wallet signature for the order
            const signature = await this.getOrderSignature(order);

            // Convert order to Polymarket format
            const polymarketOrder = this.convertToPolymarketOrder(order);

            // Place order via API
            const response = await this.api.placeOrder(polymarketOrder, signature);

            // Update order with response data
            order.orderId = response.orderId || order.orderId;
            order.status = 'open';
            order.submittedAt = Date.now();

            // Store in database and active orders
            await this.database.saveOrder(order);
            this.activeOrders.set(order.orderId, order);

            this.logger.info(`Order placed successfully: ${order.orderId}`);
            this.emit('orderPlaced', order);

            return order;

        } catch (error) {
            this.logger.error(`Failed to execute order:`, error);
            throw error;
        }
    }

    async getOrderSignature(order) {
        try {
            // Create the order message for signing
            const orderMessage = {
                market: order.marketId,
                price: order.price.toString(),
                size: order.quantity.toString(),
                side: order.side,
                timestamp: order.timestamp,
                nonce: this.generateNonce()
            };

            // Get signature from wallet (EIP-712)
            const signature = await this.wallet.signOrder(orderMessage);
            return signature;

        } catch (error) {
            this.logger.error('Failed to get order signature:', error);
            throw error;
        }
    }

    convertToPolymarketOrder(order) {
        return {
            market: order.marketId,
            price: order.price.toString(),
            size: order.quantity.toString(),
            side: order.side,
            orderType: order.type,
            timeInForce: order.timeInForce,
            clientOrderId: order.orderId
        };
    }

    async cancelOrder(orderId) {
        try {
            const order = this.activeOrders.get(orderId);
            if (!order) {
                throw new Error(`Order not found: ${orderId}`);
            }

            this.logger.info(`Cancelling order: ${orderId}`);

            // Get wallet signature for cancellation
            const signature = await this.getCancellationSignature(order);

            // Cancel via API
            await this.api.cancelOrder(orderId, signature);

            // Update order status
            order.status = 'cancelled';
            order.cancelledAt = Date.now();

            // Remove from active orders and update database
            this.activeOrders.delete(orderId);
            await this.database.saveOrder(order);

            this.logger.info(`Order cancelled successfully: ${orderId}`);
            this.emit('orderCancelled', order);

            return order;

        } catch (error) {
            this.logger.error(`Failed to cancel order ${orderId}:`, error);
            throw error;
        }
    }

    async getCancellationSignature(order) {
        try {
            const cancellationMessage = {
                orderId: order.orderId,
                timestamp: Date.now(),
                nonce: this.generateNonce()
            };

            const signature = await this.wallet.signCancellation(cancellationMessage);
            return signature;

        } catch (error) {
            this.logger.error('Failed to get cancellation signature:', error);
            throw error;
        }
    }

    async cancelAllOrders() {
        const orderIds = Array.from(this.activeOrders.keys());
        const results = [];

        for (const orderId of orderIds) {
            try {
                await this.cancelOrder(orderId);
                results.push({ orderId, success: true });
            } catch (error) {
                this.logger.error(`Failed to cancel order ${orderId}:`, error);
                results.push({ orderId, success: false, error: error.message });
            }
        }

        return results;
    }

    startOrderMonitoring() {
        this.monitoringInterval = setInterval(async () => {
            try {
                await this.monitorOrders();
            } catch (error) {
                this.logger.error('Error monitoring orders:', error);
            }
        }, this.monitoringFrequency);
    }

    stopOrderMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
    }

    async monitorOrders() {
        if (this.activeOrders.size === 0) {
            return;
        }

        try {
            // Get current orders from API
            const address = this.wallet.getAccount();
            const signature = await this.wallet.signMessage('order_status_check');
            const apiOrders = await this.api.getOrders(address, signature);

            // Check for filled orders
            await this.checkForFills(apiOrders);

            // Check for expired orders
            await this.checkForExpiredOrders();

        } catch (error) {
            this.logger.error('Error in order monitoring:', error);
        }
    }

    async checkForFills(apiOrders) {
        for (const [orderId, localOrder] of this.activeOrders) {
            const apiOrder = apiOrders.find(o => o.orderId === orderId);
            
            if (!apiOrder) {
                // Order not found in API response, might be filled or cancelled
                await this.handleMissingOrder(localOrder);
                continue;
            }

            if (apiOrder.status === 'filled' && localOrder.status === 'open') {
                await this.handleOrderFill(localOrder, apiOrder);
            } else if (apiOrder.status === 'cancelled' && localOrder.status === 'open') {
                await this.handleOrderCancellation(localOrder);
            }
        }
    }

    async handleOrderFill(localOrder, apiOrder) {
        try {
            this.logger.info(`Order filled: ${localOrder.orderId}`);

            // Create trade record
            const trade = {
                tradeId: this.generateTradeId(),
                orderId: localOrder.orderId,
                marketId: localOrder.marketId,
                side: localOrder.side,
                price: parseFloat(apiOrder.fillPrice || localOrder.price),
                quantity: parseFloat(apiOrder.fillQuantity || localOrder.quantity),
                strategyId: localOrder.strategyId,
                timestamp: apiOrder.fillTime || Date.now(),
                fees: parseFloat(apiOrder.fees || '0'),
                profitLoss: 0 // Will be calculated based on position
            };

            // Update order status
            localOrder.status = 'filled';
            localOrder.filledAt = trade.timestamp;
            localOrder.fillPrice = trade.price;
            localOrder.fillQuantity = trade.quantity;

            // Remove from active orders
            this.activeOrders.delete(localOrder.orderId);

            // Save to database
            await Promise.all([
                this.database.saveOrder(localOrder),
                this.database.saveTrade(trade)
            ]);

            this.emit('orderFilled', trade);

        } catch (error) {
            this.logger.error(`Error handling order fill for ${localOrder.orderId}:`, error);
        }
    }

    async handleOrderCancellation(localOrder) {
        try {
            this.logger.info(`Order cancelled externally: ${localOrder.orderId}`);

            localOrder.status = 'cancelled';
            localOrder.cancelledAt = Date.now();

            this.activeOrders.delete(localOrder.orderId);
            await this.database.saveOrder(localOrder);

            this.emit('orderCancelled', localOrder);

        } catch (error) {
            this.logger.error(`Error handling order cancellation for ${localOrder.orderId}:`, error);
        }
    }

    async handleMissingOrder(localOrder) {
        // Order missing from API - could be filled, cancelled, or API issue
        this.logger.warn(`Order missing from API response: ${localOrder.orderId}`);
        
        // Try to get specific order details
        try {
            const address = this.wallet.getAccount();
            const signature = await this.wallet.signMessage('order_details_check');
            const trades = await this.api.getTrades(address, signature);
            
            // Check if order was filled
            const relatedTrade = trades.find(t => t.orderId === localOrder.orderId);
            if (relatedTrade) {
                await this.handleOrderFill(localOrder, relatedTrade);
            }
        } catch (error) {
            this.logger.debug(`Could not get details for missing order ${localOrder.orderId}:`, error);
        }
    }

    async checkForExpiredOrders() {
        const now = Date.now();
        const maxOrderAge = 24 * 60 * 60 * 1000; // 24 hours

        for (const [orderId, order] of this.activeOrders) {
            if (now - order.timestamp > maxOrderAge) {
                this.logger.info(`Order expired: ${orderId}`);
                try {
                    await this.cancelOrder(orderId);
                } catch (error) {
                    this.logger.error(`Failed to cancel expired order ${orderId}:`, error);
                }
            }
        }
    }

    async handleOrderError(order, error) {
        try {
            order.retryCount = (order.retryCount || 0) + 1;
            order.lastError = error.message;

            if (order.retryCount < this.maxRetries) {
                this.logger.warn(`Retrying order ${order.orderId} (attempt ${order.retryCount}/${this.maxRetries})`);
                
                // Add delay before retry
                setTimeout(() => {
                    this.orderQueue.push(order);
                    this.processOrderQueue();
                }, this.retryDelay * order.retryCount);
            } else {
                this.logger.error(`Order ${order.orderId} failed after ${this.maxRetries} attempts`);
                
                order.status = 'failed';
                order.failedAt = Date.now();
                
                await this.database.saveOrder(order);
                this.emit('orderFailed', { order, error });
            }

        } catch (saveError) {
            this.logger.error(`Failed to handle order error for ${order.orderId}:`, saveError);
        }
    }

    validateOrder(orderData) {
        try {
            // Required fields
            if (!orderData.marketId) {
                return { valid: false, error: 'Market ID is required' };
            }

            if (!orderData.side || !['buy', 'sell'].includes(orderData.side.toLowerCase())) {
                return { valid: false, error: 'Valid side (buy/sell) is required' };
            }

            if (!orderData.price || orderData.price <= 0) {
                return { valid: false, error: 'Valid price is required' };
            }

            if (!orderData.quantity || orderData.quantity <= 0) {
                return { valid: false, error: 'Valid quantity is required' };
            }

            // Price bounds for prediction markets (0-1)
            if (orderData.price < 0 || orderData.price > 1) {
                return { valid: false, error: 'Price must be between 0 and 1' };
            }

            // Minimum order size
            const minOrderValue = 0.01; // $0.01
            const orderValue = orderData.price * orderData.quantity;
            if (orderValue < minOrderValue) {
                return { valid: false, error: `Order value must be at least $${minOrderValue}` };
            }

            return { valid: true };

        } catch (error) {
            return { valid: false, error: `Validation error: ${error.message}` };
        }
    }

    generateOrderId() {
        return `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    generateTradeId() {
        return `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    generateNonce() {
        return Date.now().toString() + Math.random().toString(36).substring(2);
    }

    // Public API methods
    getActiveOrders() {
        return Array.from(this.activeOrders.values());
    }

    getOrder(orderId) {
        return this.activeOrders.get(orderId);
    }

    getOrderStatus() {
        return {
            activeOrders: this.activeOrders.size,
            queuedOrders: this.orderQueue.length,
            isProcessing: this.isProcessing
        };
    }

    async shutdown() {
        this.stopOrderMonitoring();
        
        // Process any remaining orders in queue
        if (this.orderQueue.length > 0) {
            this.logger.info(`Processing ${this.orderQueue.length} remaining orders...`);
            await this.processOrderQueue();
        }

        this.logger.info('Order manager shutdown complete');
    }
}