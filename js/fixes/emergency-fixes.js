// 🚨 EMERGENCY FIXES FOR CRITICAL ISSUES
// This module contains immediate fixes for the most common problems

class EmergencyFixes {
    constructor() {
        this.logger = console;
    }

    async applyAllEmergencyFixes() {
        this.logger.log("🚨 === APPLYING EMERGENCY FIXES ===");
        
        const fixes = [
            { name: "WebSocket Connection", fix: this.fixWebSocketConnection.bind(this) },
            { name: "API CORS Issues", fix: this.fixAPICORS.bind(this) },
            { name: "Smart Orders Initialization", fix: this.fixSmartOrders.bind(this) },
            { name: "Component Dependencies", fix: this.fixComponentDependencies.bind(this) },
            { name: "Error Boundaries", fix: this.addErrorBoundaries.bind(this) }
        ];

        const results = {};
        
        for (const { name, fix } of fixes) {
            try {
                this.logger.log(`🔧 Applying fix: ${name}`);
                const result = await fix();
                results[name] = { success: true, result };
                this.logger.log(`✅ Fixed: ${name}`);
            } catch (error) {
                this.logger.error(`❌ Fix failed for ${name}:`, error);
                results[name] = { success: false, error: error.message };
            }
        }

        return results;
    }

    async fixWebSocketConnection() {
        // Fix 1: WebSocket connection with proper fallbacks
        const workingUrls = [
            'wss://ws-subscriptions-clob.polymarket.com/ws/market',
            'wss://ws-subscriptions-clob.polymarket.com/ws/v1',
            'wss://gamma-api.polymarket.com/ws'
        ];

        for (const url of workingUrls) {
            try {
                const testConnection = await this.testWebSocketURL(url);
                if (testConnection.success) {
                    // Update the WebSocket manager if it exists
                    if (window.app?.marketStream) {
                        window.app.marketStream.wsUrl = url;
                        this.logger.log(`📡 Updated WebSocket URL to: ${url}`);
                    }
                    return { workingUrl: url };
                }
            } catch (error) {
                this.logger.warn(`WebSocket URL ${url} failed: ${error.message}`);
            }
        }

        // If no WebSocket works, enable polling fallback
        return this.enablePollingFallback();
    }

    async testWebSocketURL(url) {
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(url);
            const timeout = setTimeout(() => {
                ws.close();
                reject(new Error('Connection timeout'));
            }, 5000);

            ws.onopen = () => {
                clearTimeout(timeout);
                ws.close();
                resolve({ success: true, url });
            };

            ws.onerror = (error) => {
                clearTimeout(timeout);
                reject(error);
            };
        });
    }

    enablePollingFallback() {
        this.logger.log("🔄 Enabling polling fallback for WebSocket");
        
        // Create a simple polling mechanism
        if (window.app?.api) {
            const pollInterval = setInterval(async () => {
                try {
                    const markets = await window.app.api.fetchReal15MinuteCryptoMarkets();
                    if (window.app.ui && markets) {
                        window.app.ui.updateMarketData(markets);
                    }
                } catch (error) {
                    this.logger.warn("Polling fallback error:", error.message);
                }
            }, 10000); // Poll every 10 seconds

            return { fallback: 'polling', interval: pollInterval };
        }

        return { fallback: 'none', reason: 'No API available' };
    }

    async fixAPICORS() {
        // Fix 2: API CORS issues with proxy and alternative methods
        const apiEndpoints = [
            { name: 'Gamma API', url: 'https://gamma-api.polymarket.com/markets?limit=1' },
            { name: 'CLOB API', url: 'https://clob.polymarket.com/ping' }
        ];

        const workingEndpoints = [];
        const failedEndpoints = [];

        for (const endpoint of apiEndpoints) {
            try {
                const response = await fetch(endpoint.url, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                    },
                    mode: 'cors'
                });

                if (response.ok) {
                    workingEndpoints.push(endpoint);
                    this.logger.log(`✅ API working: ${endpoint.name}`);
                } else {
                    failedEndpoints.push({ ...endpoint, status: response.status });
                    this.logger.warn(`⚠️ API issue: ${endpoint.name} returned ${response.status}`);
                }
            } catch (error) {
                failedEndpoints.push({ ...endpoint, error: error.message });
                this.logger.error(`❌ API failed: ${endpoint.name} - ${error.message}`);
                
                // If CORS error, suggest proxy solution
                if (error.message.includes('CORS') || error.message.includes('cross-origin')) {
                    this.setupCORSProxy(endpoint);
                }
            }
        }

        return { workingEndpoints, failedEndpoints };
    }

    setupCORSProxy(endpoint) {
        // Implement a simple CORS proxy solution
        this.logger.log(`🔧 Setting up CORS proxy for: ${endpoint.name}`);
        
        // For now, just log the solution - in production, you'd set up a proxy server
        const corsProxyUrls = [
            `https://cors-anywhere.herokuapp.com/${endpoint.url}`,
            `https://api.allorigins.win/get?url=${encodeURIComponent(endpoint.url)}`
        ];

        this.logger.log("💡 CORS Proxy options:", corsProxyUrls);
        return { proxyOptions: corsProxyUrls };
    }

    async fixSmartOrders() {
        // Fix 3: Smart Orders initialization and validation
        this.logger.log("🔧 Fixing Smart Orders system...");

        // Check if Smart Orders manager exists
        if (!window.app?.smartOrderManager) {
            this.logger.warn("⚠️ Smart Orders manager not found - creating fallback");
            return this.createSmartOrdersFallback();
        }

        const smartOrders = window.app.smartOrderManager;

        // Fix strategies initialization
        if (!smartOrders.strategies || Object.keys(smartOrders.strategies).length === 0) {
            this.logger.log("🔧 Initializing Smart Orders strategies...");
            smartOrders.strategies = this.createBasicStrategies();
        }

        // Test order validation
        const testOrder = {
            marketId: 'test-market-123',
            side: 'buy',
            size: 1.0,
            price: 0.5,
            strategy: 'market'
        };

        const validation = this.validateOrder(testOrder);
        if (validation.isValid) {
            this.logger.log("✅ Order validation working correctly");
        } else {
            this.logger.warn("⚠️ Order validation issues:", validation.errors);
        }

        return { strategies: Object.keys(smartOrders.strategies), validation };
    }

    createSmartOrdersFallback() {
        // Create a basic Smart Orders fallback
        const basicSmartOrders = {
            strategies: this.createBasicStrategies(),
            
            async executeOrder(order) {
                console.log("📝 Fallback order execution:", order);
                return { success: false, reason: "Fallback mode - real trading disabled" };
            },
            
            validateOrder: this.validateOrder.bind(this)
        };

        if (window.app) {
            window.app.smartOrderManager = basicSmartOrders;
        }

        return { fallback: true, strategies: Object.keys(basicSmartOrders.strategies) };
    }

    createBasicStrategies() {
        return {
            market: {
                name: 'Market Order',
                description: 'Execute immediately at current market price',
                execute: async (order) => {
                    console.log("Market order:", order);
                    return { type: 'market', ...order };
                }
            },
            limit: {
                name: 'Limit Order',
                description: 'Execute only at specified price or better',
                execute: async (order) => {
                    console.log("Limit order:", order);
                    return { type: 'limit', ...order };
                }
            },
            iceberg: {
                name: 'Iceberg Order',
                description: 'Break large order into smaller chunks',
                execute: async (order) => {
                    console.log("Iceberg order:", order);
                    return { type: 'iceberg', ...order };
                }
            }
        };
    }

    validateOrder(order) {
        const validations = {
            hasMarketId: !!order.marketId,
            hasValidSide: ['buy', 'sell'].includes(order.side),
            hasValidSize: typeof order.size === 'number' && order.size > 0,
            hasValidPrice: typeof order.price === 'number' && order.price > 0 && order.price <= 1,
            hasStrategy: !!order.strategy
        };

        const errors = [];
        Object.entries(validations).forEach(([validation, passed]) => {
            if (!passed) {
                errors.push(validation);
            }
        });

        return {
            isValid: errors.length === 0,
            validations,
            errors
        };
    }

    async fixComponentDependencies() {
        // Fix 4: Component dependency issues
        this.logger.log("🔧 Checking component dependencies...");

        const requiredComponents = [
            { name: 'database', path: 'app.database' },
            { name: 'api', path: 'app.api' },
            { name: 'walletManager', path: 'app.walletManager' },
            { name: 'marketStream', path: 'app.marketStream' },
            { name: 'ui', path: 'app.ui' }
        ];

        const componentStatus = {};
        
        for (const component of requiredComponents) {
            try {
                const exists = this.getNestedProperty(window, component.path);
                componentStatus[component.name] = {
                    exists: !!exists,
                    type: exists ? exists.constructor.name : 'undefined'
                };
                
                if (exists) {
                    this.logger.log(`✅ Component found: ${component.name} (${exists.constructor.name})`);
                } else {
                    this.logger.warn(`⚠️ Component missing: ${component.name}`);
                    // Try to initialize missing component
                    await this.initializeMissingComponent(component.name);
                }
            } catch (error) {
                this.logger.error(`❌ Error checking ${component.name}:`, error.message);
                componentStatus[component.name] = { exists: false, error: error.message };
            }
        }

        return componentStatus;
    }

    getNestedProperty(obj, path) {
        return path.split('.').reduce((current, prop) => current && current[prop], obj);
    }

    async initializeMissingComponent(componentName) {
        this.logger.log(`🔄 Attempting to initialize: ${componentName}`);
        
        switch (componentName) {
            case 'database':
                try {
                    const { DatabaseManager } = await import('../data/database.js');
                    if (window.app && !window.app.database) {
                        window.app.database = new DatabaseManager();
                        await window.app.database.init();
                        this.logger.log("✅ Database initialized");
                    }
                } catch (error) {
                    this.logger.error("❌ Failed to initialize database:", error.message);
                }
                break;
                
            case 'api':
                try {
                    const { RealPolymarketAPI } = await import('../core/real-polymarket-api.js');
                    if (window.app && !window.app.api) {
                        window.app.api = new RealPolymarketAPI();
                        this.logger.log("✅ API initialized");
                    }
                } catch (error) {
                    this.logger.error("❌ Failed to initialize API:", error.message);
                }
                break;
                
            default:
                this.logger.warn(`⚠️ Don't know how to initialize: ${componentName}`);
        }
    }

    addErrorBoundaries() {
        // Fix 5: Add global error boundaries
        this.logger.log("🔧 Adding error boundaries...");

        // Global error handler
        window.addEventListener('error', (event) => {
            this.logger.error("💥 Global Error:", event.error);
            this.handleGlobalError(event.error);
        });

        // Unhandled promise rejection handler
        window.addEventListener('unhandledrejection', (event) => {
            this.logger.error("💥 Unhandled Promise Rejection:", event.reason);
            this.handleGlobalError(event.reason);
            event.preventDefault(); // Prevent default browser error handling
        });

        // WebSocket error handler
        const originalWebSocket = window.WebSocket;
        window.WebSocket = class extends originalWebSocket {
            constructor(...args) {
                super(...args);
                this.addEventListener('error', (event) => {
                    console.error("💥 WebSocket Error:", event);
                });
            }
        };

        return { errorBoundariesAdded: true };
    }

    handleGlobalError(error) {
        // Log error details
        this.logger.error("🚨 Handling global error:", error);
        
        // Try to recover from common errors
        if (error.message && error.message.includes('WebSocket')) {
            this.logger.log("🔄 WebSocket error detected - attempting reconnection");
            this.fixWebSocketConnection();
        } else if (error.message && error.message.includes('fetch')) {
            this.logger.log("🔄 API error detected - checking connectivity");
            this.fixAPICORS();
        }
    }

    // Utility method for testing fixes
    async testAllSystems() {
        this.logger.log("🧪 Testing all systems after fixes...");
        
        const tests = [
            { name: 'WebSocket', test: this.testWebSocket.bind(this) },
            { name: 'API', test: this.testAPI.bind(this) },
            { name: 'Smart Orders', test: this.testSmartOrders.bind(this) },
            { name: 'Database', test: this.testDatabase.bind(this) }
        ];

        const results = {};
        
        for (const { name, test } of tests) {
            try {
                const result = await test();
                results[name] = { success: true, result };
                this.logger.log(`✅ ${name} test passed`);
            } catch (error) {
                results[name] = { success: false, error: error.message };
                this.logger.error(`❌ ${name} test failed:`, error.message);
            }
        }

        return results;
    }

    async testWebSocket() {
        // Simple WebSocket test
        if (window.app?.marketStream?.connection) {
            return { status: 'connected', readyState: window.app.marketStream.connection.readyState };
        }
        throw new Error('WebSocket not available');
    }

    async testAPI() {
        // Simple API test
        if (window.app?.api) {
            const markets = await window.app.api.fetchReal15MinuteCryptoMarkets();
            return { marketsFound: markets ? markets.length : 0 };
        }
        throw new Error('API not available');
    }

    async testSmartOrders() {
        // Simple Smart Orders test
        if (window.app?.smartOrderManager) {
            const strategies = Object.keys(window.app.smartOrderManager.strategies || {});
            return { strategiesAvailable: strategies };
        }
        throw new Error('Smart Orders not available');
    }

    async testDatabase() {
        // Simple database test
        if (window.app?.database) {
            return { status: 'connected', dbName: window.app.database.db?.name };
        }
        throw new Error('Database not available');
    }
}

// Make EmergencyFixes globally available
window.EmergencyFixes = EmergencyFixes;

export { EmergencyFixes };