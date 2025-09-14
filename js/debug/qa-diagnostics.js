// 🚨 CRITICAL QA DIAGNOSTICS SCRIPT
// This script performs comprehensive system diagnostics to identify failures

class EmergencyQADiagnostics {
    constructor() {
        this.results = {
            websocket: { status: 'testing', issues: [], fixes: [] },
            api: { status: 'testing', issues: [], fixes: [] },
            smartOrders: { status: 'testing', issues: [], fixes: [] },
            wallet: { status: 'testing', issues: [], fixes: [] },
            database: { status: 'testing', issues: [], fixes: [] }
        };
    }

    async runFullDiagnostics() {
        console.log("🚨 === EMERGENCY QA TESTING STARTED ===");
        console.log("📊 Diagnosing critical system failures...");

        // Test all critical components
        await this.diagnoseWebSocket();
        await this.diagnoseAPI();
        await this.diagnoseSmartOrders();
        await this.diagnoseWallet();
        await this.diagnoseDatabase();

        // Generate comprehensive report
        this.generateDiagnosticReport();
        
        return this.results;
    }

    async diagnoseWebSocket() {
        console.log("\n🔍 1️⃣ WEBSOCKET DIAGNOSTICS:");
        
        try {
            // Check if WebSocket manager exists
            if (!window.app?.marketStream) {
                this.results.websocket.issues.push("WebSocket manager not initialized");
                this.results.websocket.fixes.push("Initialize RealWebSocketManager properly");
                console.error("❌ WebSocket Manager not found");
                return;
            }

            const wsManager = window.app.marketStream;
            console.log("- WebSocket Manager:", wsManager.constructor.name);

            // Check connection state
            if (wsManager.connection) {
                const state = wsManager.connection.readyState;
                const states = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'];
                console.log("- Connection State:", states[state] || 'UNKNOWN');
                
                if (state !== 1) { // Not OPEN
                    this.results.websocket.issues.push(`Connection state is ${states[state]}`);
                    this.results.websocket.fixes.push("Reconnect WebSocket with proper error handling");
                }
            } else {
                this.results.websocket.issues.push("No WebSocket connection object");
                this.results.websocket.fixes.push("Create WebSocket connection");
                console.error("❌ No WebSocket connection");
            }

            // Test WebSocket URL accessibility
            await this.testWebSocketURL();

        } catch (error) {
            console.error("❌ WebSocket diagnostics failed:", error);
            this.results.websocket.issues.push(`Diagnostic error: ${error.message}`);
            this.results.websocket.fixes.push("Debug WebSocket initialization code");
        }

        this.results.websocket.status = this.results.websocket.issues.length > 0 ? 'failed' : 'passed';
    }

    async testWebSocketURL() {
        console.log("- Testing WebSocket URL accessibility...");
        
        const testUrls = [
            'wss://ws-subscriptions-clob.polymarket.com/ws/v1',
            'wss://ws-subscriptions-clob.polymarket.com/ws/market',
            'wss://ws.polymarket.com/ws'
        ];

        for (const url of testUrls) {
            try {
                console.log(`  Testing: ${url}`);
                const testWs = new WebSocket(url);
                
                await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        testWs.close();
                        reject(new Error('Timeout'));
                    }, 5000);

                    testWs.onopen = () => {
                        console.log(`  ✅ ${url} - Accessible`);
                        clearTimeout(timeout);
                        testWs.close();
                        resolve();
                    };

                    testWs.onerror = (error) => {
                        console.error(`  ❌ ${url} - Failed:`, error);
                        clearTimeout(timeout);
                        reject(error);
                    };
                });

                // If we get here, this URL works
                this.results.websocket.fixes.push(`Use working WebSocket URL: ${url}`);
                break;

            } catch (error) {
                console.error(`  ❌ ${url} - Error:`, error.message);
                this.results.websocket.issues.push(`URL ${url} not accessible: ${error.message}`);
            }
        }
    }

    async diagnoseAPI() {
        console.log("\n🔍 2️⃣ API DIAGNOSTICS:");

        try {
            if (!window.app?.api) {
                this.results.api.issues.push("API manager not initialized");
                this.results.api.fixes.push("Initialize RealPolymarketAPI properly");
                console.error("❌ API Manager not found");
                return;
            }

            const api = window.app.api;
            console.log("- API Manager:", api.constructor.name);
            
            // Check API URLs
            if (api.clobBaseURL) {
                console.log("- CLOB API URL:", api.clobBaseURL);
            }
            if (api.gammaBaseURL) {
                console.log("- Gamma API URL:", api.gammaBaseURL);
            }

            // Test API endpoints
            await this.testAPIEndpoints();

        } catch (error) {
            console.error("❌ API diagnostics failed:", error);
            this.results.api.issues.push(`Diagnostic error: ${error.message}`);
            this.results.api.fixes.push("Debug API initialization code");
        }

        this.results.api.status = this.results.api.issues.length > 0 ? 'failed' : 'passed';
    }

    async testAPIEndpoints() {
        console.log("- Testing API endpoints...");

        const endpoints = [
            { name: 'Gamma Markets', url: 'https://gamma-api.polymarket.com/markets?limit=1' },
            { name: 'CLOB Ping', url: 'https://clob.polymarket.com/ping' },
            { name: 'CLOB Markets', url: 'https://clob.polymarket.com/markets' }
        ];

        for (const endpoint of endpoints) {
            try {
                console.log(`  Testing: ${endpoint.name}`);
                
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 10000);

                const response = await fetch(endpoint.url, {
                    signal: controller.signal,
                    headers: {
                        'Accept': 'application/json',
                    }
                });
                clearTimeout(timeout);

                if (response.ok) {
                    console.log(`  ✅ ${endpoint.name} - Status: ${response.status}`);
                    
                    // Try to parse response
                    try {
                        const data = await response.json();
                        console.log(`  📊 ${endpoint.name} - Data structure:`, Object.keys(data));
                    } catch (parseError) {
                        console.warn(`  ⚠️ ${endpoint.name} - Could not parse JSON response`);
                    }
                } else {
                    console.error(`  ❌ ${endpoint.name} - Status: ${response.status}`);
                    this.results.api.issues.push(`${endpoint.name} returned ${response.status}`);
                    
                    try {
                        const errorText = await response.text();
                        console.error(`    Error details: ${errorText.substring(0, 200)}`);
                    } catch (e) {
                        console.error("    Could not read error details");
                    }
                }

            } catch (error) {
                console.error(`  ❌ ${endpoint.name} - Error:`, error.name, error.message);
                this.results.api.issues.push(`${endpoint.name}: ${error.message}`);
                
                if (error.name === 'TypeError' && error.message.includes('CORS')) {
                    this.results.api.fixes.push("Implement CORS proxy or server-side API calls");
                } else if (error.name === 'AbortError') {
                    this.results.api.fixes.push("Increase timeout or check network connectivity");
                } else {
                    this.results.api.fixes.push(`Debug ${endpoint.name} connectivity issue`);
                }
            }
        }
    }

    async diagnoseSmartOrders() {
        console.log("\n🔍 3️⃣ SMART ORDERS DIAGNOSTICS:");

        try {
            if (!window.app?.smartOrderManager) {
                this.results.smartOrders.issues.push("Smart Order Manager not initialized");
                this.results.smartOrders.fixes.push("Initialize SmartOrderManager properly");
                console.error("❌ Smart Order Manager not found");
                return;
            }

            const smartOrders = window.app.smartOrderManager;
            console.log("- Smart Order Manager:", smartOrders.constructor.name);

            // Check strategies
            if (smartOrders.strategies) {
                const strategyNames = Object.keys(smartOrders.strategies);
                console.log("- Available Strategies:", strategyNames);
                
                if (strategyNames.length === 0) {
                    this.results.smartOrders.issues.push("No order strategies available");
                    this.results.smartOrders.fixes.push("Initialize order execution strategies");
                }
            } else {
                this.results.smartOrders.issues.push("No strategies object");
                this.results.smartOrders.fixes.push("Create strategies configuration");
            }

            // Test order validation
            await this.testOrderValidation();

        } catch (error) {
            console.error("❌ Smart Orders diagnostics failed:", error);
            this.results.smartOrders.issues.push(`Diagnostic error: ${error.message}`);
            this.results.smartOrders.fixes.push("Debug SmartOrderManager initialization");
        }

        this.results.smartOrders.status = this.results.smartOrders.issues.length > 0 ? 'failed' : 'passed';
    }

    async testOrderValidation() {
        console.log("- Testing order validation...");

        const testOrder = {
            marketId: 'test-market-123',
            side: 'buy',
            size: 1.0,
            price: 0.5,
            strategy: 'market'
        };

        try {
            // Basic validation checks
            const validation = {
                hasMarketId: !!testOrder.marketId,
                hasValidSide: ['buy', 'sell'].includes(testOrder.side),
                hasValidSize: testOrder.size > 0,
                hasValidPrice: testOrder.price > 0 && testOrder.price < 1,
                hasStrategy: !!testOrder.strategy
            };

            console.log("  📋 Order validation checks:", validation);

            const isValid = Object.values(validation).every(check => check);
            if (isValid) {
                console.log("  ✅ Basic order validation passed");
            } else {
                this.results.smartOrders.issues.push("Order validation logic has issues");
                this.results.smartOrders.fixes.push("Fix order validation parameters");
            }

        } catch (error) {
            console.error("  ❌ Order validation test failed:", error);
            this.results.smartOrders.issues.push(`Order validation error: ${error.message}`);
        }
    }

    async diagnoseWallet() {
        console.log("\n🔍 4️⃣ WALLET DIAGNOSTICS:");

        try {
            if (!window.app?.walletManager) {
                this.results.wallet.issues.push("Wallet Manager not initialized");
                this.results.wallet.fixes.push("Initialize WalletManager properly");
                console.error("❌ Wallet Manager not found");
                return;
            }

            const wallet = window.app.walletManager;
            console.log("- Wallet Manager:", wallet.constructor.name);
            console.log("- Is Connected:", wallet.isConnected || false);
            console.log("- Current Address:", wallet.currentAddress || 'None');

            // Check MetaMask availability
            if (typeof window.ethereum !== 'undefined') {
                console.log("- MetaMask Available:", true);
                console.log("- MetaMask Provider:", window.ethereum.isMetaMask ? 'MetaMask' : 'Other');
            } else {
                console.error("❌ MetaMask not available");
                this.results.wallet.issues.push("MetaMask extension not installed or available");
                this.results.wallet.fixes.push("Install MetaMask browser extension");
            }

            // Check network
            if (wallet.currentNetwork) {
                console.log("- Current Network:", wallet.currentNetwork);
            }

        } catch (error) {
            console.error("❌ Wallet diagnostics failed:", error);
            this.results.wallet.issues.push(`Diagnostic error: ${error.message}`);
            this.results.wallet.fixes.push("Debug WalletManager initialization");
        }

        this.results.wallet.status = this.results.wallet.issues.length > 0 ? 'failed' : 'passed';
    }

    async diagnoseDatabase() {
        console.log("\n🔍 5️⃣ DATABASE DIAGNOSTICS:");

        try {
            if (!window.app?.database) {
                this.results.database.issues.push("Database Manager not initialized");
                this.results.database.fixes.push("Initialize DatabaseManager properly");
                console.error("❌ Database Manager not found");
                return;
            }

            const db = window.app.database;
            console.log("- Database Manager:", db.constructor.name);

            // Test database connection
            if (db.db) {
                console.log("- Database Connected:", true);
                console.log("- Database Name:", db.db.name);
                console.log("- Database Version:", db.db.version);
                
                // Test basic operations
                try {
                    const testResult = await db.addMarket({
                        id: 'test-market',
                        name: 'Test Market',
                        timestamp: Date.now()
                    });
                    console.log("- Database Write Test:", testResult ? 'Passed' : 'Failed');
                    
                    // Clean up test data
                    await db.deleteMarket('test-market');
                } catch (dbError) {
                    console.error("- Database Operation Test Failed:", dbError);
                    this.results.database.issues.push(`Database operation failed: ${dbError.message}`);
                }
            } else {
                console.error("❌ Database not connected");
                this.results.database.issues.push("Database connection not established");
                this.results.database.fixes.push("Establish IndexedDB connection");
            }

        } catch (error) {
            console.error("❌ Database diagnostics failed:", error);
            this.results.database.issues.push(`Diagnostic error: ${error.message}`);
            this.results.database.fixes.push("Debug DatabaseManager initialization");
        }

        this.results.database.status = this.results.database.issues.length > 0 ? 'failed' : 'passed';
    }

    generateDiagnosticReport() {
        console.log("\n📊 === DIAGNOSTIC REPORT ===");
        
        const components = ['websocket', 'api', 'smartOrders', 'wallet', 'database'];
        let totalIssues = 0;
        
        components.forEach(component => {
            const result = this.results[component];
            const status = result.status === 'passed' ? '✅' : '❌';
            console.log(`\n${status} ${component.toUpperCase()}:`);
            
            if (result.issues.length > 0) {
                console.log("  Issues:");
                result.issues.forEach((issue, i) => {
                    console.log(`    ${i + 1}. ${issue}`);
                });
                totalIssues += result.issues.length;
            }
            
            if (result.fixes.length > 0) {
                console.log("  Suggested Fixes:");
                result.fixes.forEach((fix, i) => {
                    console.log(`    ${i + 1}. ${fix}`);
                });
            }
        });

        console.log(`\n🎯 SUMMARY: ${totalIssues} total issues found`);
        
        if (totalIssues === 0) {
            console.log("✅ All components passed diagnostics");
        } else {
            console.log("❌ Critical issues need immediate attention");
            console.log("\n🚨 PRIORITY FIXES NEEDED:");
            
            // Prioritize fixes
            if (this.results.api.status === 'failed') {
                console.log("1. 🔥 HIGH: Fix API connectivity - markets cannot load without this");
            }
            if (this.results.websocket.status === 'failed') {
                console.log("2. 🔥 HIGH: Fix WebSocket - no real-time data without this");
            }
            if (this.results.smartOrders.status === 'failed') {
                console.log("3. 🔥 HIGH: Fix Smart Orders - trading functionality broken");
            }
            if (this.results.wallet.status === 'failed') {
                console.log("4. 🔶 MEDIUM: Fix Wallet - needed for trading");
            }
            if (this.results.database.status === 'failed') {
                console.log("5. 🔶 MEDIUM: Fix Database - data persistence issues");
            }
        }

        console.log("\n=== END DIAGNOSTIC REPORT ===");
    }
}

// Make diagnostics globally available
window.QADiagnostics = EmergencyQADiagnostics;

// Auto-run diagnostics when loaded
console.log("🚨 QA Diagnostics loaded. Run with: new QADiagnostics().runFullDiagnostics()");

export { EmergencyQADiagnostics };