// 🔧 WEBSOCKET CONNECTION FIXES
// This module provides robust WebSocket fixes with fallbacks

class WebSocketFixes {
    constructor() {
        this.logger = console;
        this.workingUrl = null;
        this.connection = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.pollingInterval = null;
        this.fallbackMode = false;
        
        // Multiple WebSocket URLs to try
        this.wsUrls = [
            'wss://ws-subscriptions-clob.polymarket.com/ws/market',
            'wss://ws-subscriptions-clob.polymarket.com/ws/v1',
            'wss://ws-subscriptions-clob.polymarket.com/ws',
            'wss://gamma-api.polymarket.com/ws',
            'wss://api.polymarket.com/ws'
        ];
    }

    async findWorkingWebSocketURL() {
        this.logger.log("🔍 Testing WebSocket URLs...");
        
        for (const url of this.wsUrls) {
            try {
                this.logger.log(`  Testing: ${url}`);
                const isWorking = await this.testWebSocketURL(url);
                
                if (isWorking) {
                    this.workingUrl = url;
                    this.logger.log(`  ✅ Working WebSocket found: ${url}`);
                    return url;
                }
                
            } catch (error) {
                this.logger.log(`  ❌ Failed: ${url} - ${error.message}`);
            }
        }
        
        this.logger.warn("⚠️ No working WebSocket URL found");
        return null;
    }

    async testWebSocketURL(url, timeout = 5000) {
        return new Promise((resolve, reject) => {
            let ws;
            const timer = setTimeout(() => {
                if (ws) ws.close();
                reject(new Error('Connection timeout'));
            }, timeout);

            try {
                ws = new WebSocket(url);
                
                ws.onopen = () => {
                    clearTimeout(timer);
                    ws.close();
                    resolve(true);
                };

                ws.onerror = (error) => {
                    clearTimeout(timer);
                    reject(error);
                };

                ws.onclose = (event) => {
                    if (event.code !== 1000) { // Not a normal close
                        clearTimeout(timer);
                        reject(new Error(`WebSocket closed with code: ${event.code}`));
                    }
                };

            } catch (error) {
                clearTimeout(timer);
                reject(error);
            }
        });
    }

    async establishConnection() {
        if (!this.workingUrl) {
            await this.findWorkingWebSocketURL();
        }

        if (!this.workingUrl) {
            this.logger.warn("⚠️ No working WebSocket URL - enabling polling fallback");
            return this.enablePollingFallback();
        }

        try {
            this.connection = new WebSocket(this.workingUrl);
            this.setupConnectionHandlers();
            
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('WebSocket connection timeout'));
                }, 10000);

                this.connection.onopen = () => {
                    clearTimeout(timeout);
                    this.logger.log("✅ WebSocket connected successfully");
                    this.reconnectAttempts = 0;
                    resolve({ status: 'connected', url: this.workingUrl });
                };

                this.connection.onerror = (error) => {
                    clearTimeout(timeout);
                    this.logger.error("❌ WebSocket connection failed:", error);
                    reject(error);
                };
            });

        } catch (error) {
            this.logger.error("❌ Failed to establish WebSocket connection:", error);
            return this.enablePollingFallback();
        }
    }

    setupConnectionHandlers() {
        if (!this.connection) return;

        this.connection.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleWebSocketMessage(data);
            } catch (error) {
                this.logger.warn("⚠️ Failed to parse WebSocket message:", error);
            }
        };

        this.connection.onclose = (event) => {
            this.logger.warn(`⚠️ WebSocket closed: ${event.code} - ${event.reason}`);
            
            if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
                this.scheduleReconnect();
            } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                this.logger.warn("❌ Max reconnection attempts reached - switching to polling");
                this.enablePollingFallback();
            }
        };

        this.connection.onerror = (error) => {
            this.logger.error("❌ WebSocket error:", error);
            this.scheduleReconnect();
        };
    }

    scheduleReconnect() {
        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts); // Exponential backoff
        
        this.logger.log(`🔄 Scheduling reconnection attempt ${this.reconnectAttempts} in ${delay}ms`);
        
        setTimeout(() => {
            this.establishConnection();
        }, delay);
    }

    handleWebSocketMessage(data) {
        // Forward message to main app if available
        if (window.app?.marketStream?.handleMessage) {
            window.app.marketStream.handleMessage(data);
        } else if (window.app?.ui?.updateMarketData) {
            window.app.ui.updateMarketData(data);
        } else {
            this.logger.log("📨 WebSocket message received:", data);
        }
    }

    enablePollingFallback() {
        this.logger.log("🔄 Enabling polling fallback for market data");
        this.fallbackMode = true;

        // Clear any existing polling
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
        }

        // Start polling every 10 seconds
        this.pollingInterval = setInterval(async () => {
            try {
                await this.pollMarketData();
            } catch (error) {
                this.logger.warn("⚠️ Polling failed:", error.message);
            }
        }, 10000);

        return { status: 'fallback', mode: 'polling', interval: 10000 };
    }

    async pollMarketData() {
        if (window.app?.api?.fetchReal15MinuteCryptoMarkets) {
            try {
                const markets = await window.app.api.fetchReal15MinuteCryptoMarkets();
                
                if (markets && markets.length > 0) {
                    // Simulate WebSocket message format
                    const simulatedMessage = {
                        type: 'market_update',
                        data: markets,
                        timestamp: Date.now(),
                        source: 'polling'
                    };
                    
                    this.handleWebSocketMessage(simulatedMessage);
                }
            } catch (error) {
                this.logger.warn("⚠️ Market data polling failed:", error.message);
            }
        }
    }

    disconnect() {
        if (this.connection) {
            this.connection.close(1000, 'Manual disconnect');
            this.connection = null;
        }

        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }

        this.workingUrl = null;
        this.reconnectAttempts = 0;
        this.fallbackMode = false;
    }

    getStatus() {
        if (this.connection && this.connection.readyState === WebSocket.OPEN) {
            return {
                status: 'connected',
                url: this.workingUrl,
                readyState: this.connection.readyState,
                fallbackMode: false
            };
        } else if (this.fallbackMode) {
            return {
                status: 'polling',
                fallbackMode: true,
                pollingInterval: 10000
            };
        } else {
            return {
                status: 'disconnected',
                reconnectAttempts: this.reconnectAttempts,
                fallbackMode: this.fallbackMode
            };
        }
    }
}

// Enhanced WebSocket Manager with fixes
class FixedWebSocketManager {
    constructor() {
        this.fixes = new WebSocketFixes();
        this.logger = console;
        this.subscriptions = new Set();
        this.messageHandlers = new Map();
    }

    async initialize() {
        this.logger.log("🔧 Initializing Fixed WebSocket Manager...");
        
        try {
            const result = await this.fixes.establishConnection();
            this.logger.log("✅ WebSocket Manager initialized:", result);
            return result;
        } catch (error) {
            this.logger.error("❌ WebSocket Manager initialization failed:", error);
            // Still return success if fallback is enabled
            return this.fixes.enablePollingFallback();
        }
    }

    subscribe(channel, callback) {
        this.subscriptions.add(channel);
        this.messageHandlers.set(channel, callback);
        
        if (this.fixes.connection && this.fixes.connection.readyState === WebSocket.OPEN) {
            const subscribeMessage = {
                type: 'subscribe',
                channel: channel,
                timestamp: Date.now()
            };
            
            this.fixes.connection.send(JSON.stringify(subscribeMessage));
            this.logger.log(`📡 Subscribed to channel: ${channel}`);
        } else if (this.fixes.fallbackMode) {
            this.logger.log(`📡 Subscription registered for polling: ${channel}`);
        }
    }

    unsubscribe(channel) {
        this.subscriptions.delete(channel);
        this.messageHandlers.delete(channel);
        
        if (this.fixes.connection && this.fixes.connection.readyState === WebSocket.OPEN) {
            const unsubscribeMessage = {
                type: 'unsubscribe',
                channel: channel,
                timestamp: Date.now()
            };
            
            this.fixes.connection.send(JSON.stringify(unsubscribeMessage));
            this.logger.log(`📡 Unsubscribed from channel: ${channel}`);
        }
    }

    handleMessage(message) {
        // Route message to appropriate handlers
        if (message.channel && this.messageHandlers.has(message.channel)) {
            const handler = this.messageHandlers.get(message.channel);
            handler(message.data);
        } else {
            // Broadcast to all handlers if no specific channel
            for (const handler of this.messageHandlers.values()) {
                try {
                    handler(message);
                } catch (error) {
                    this.logger.warn("⚠️ Message handler error:", error);
                }
            }
        }
    }

    getStatus() {
        return this.fixes.getStatus();
    }

    disconnect() {
        this.fixes.disconnect();
        this.subscriptions.clear();
        this.messageHandlers.clear();
    }
}

// Global installation function
function installWebSocketFixes() {
    console.log("🔧 Installing WebSocket fixes...");
    
    window.WebSocketFixes = WebSocketFixes;
    window.FixedWebSocketManager = FixedWebSocketManager;
    
    // Replace the WebSocket manager in the main app if it exists
    if (window.app && window.app.marketStream) {
        const fixedManager = new FixedWebSocketManager();
        
        fixedManager.initialize().then(result => {
            console.log("✅ WebSocket fixes installed:", result);
            
            // Copy over existing subscriptions if any
            if (window.app.marketStream.subscriptions) {
                for (const subscription of window.app.marketStream.subscriptions) {
                    fixedManager.subscribe(subscription.channel, subscription.callback);
                }
            }
            
            // Replace the manager
            window.app.marketStream = fixedManager;
            
        }).catch(error => {
            console.error("❌ Failed to initialize fixed WebSocket manager:", error);
        });
    }
    
    return { installed: true };
}

// Auto-install if in browser environment
if (typeof window !== 'undefined') {
    window.installWebSocketFixes = installWebSocketFixes;
    console.log("🔧 WebSocket fixes loaded. Run installWebSocketFixes() to apply.");
}

export { WebSocketFixes, FixedWebSocketManager, installWebSocketFixes };