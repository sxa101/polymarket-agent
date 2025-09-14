// Integration Testing Script for Polymarket Trading Agent
// This script will test all the real components we've built

console.log("🧪 Starting Integration Tests...");

// Test 1: Check if ProductionConfig loads correctly
async function testProductionConfig() {
    console.log("\n1️⃣ Testing ProductionConfig Loading...");
    
    try {
        const { ProductionConfig } = await import('./js/config/production-config.js');
        
        console.log("✅ ProductionConfig imported successfully");
        console.log("📊 Demo Mode:", ProductionConfig.FEATURES.DEMO_MODE);
        console.log("🔧 Trading Enabled:", ProductionConfig.FEATURES.ENABLE_TRADING);
        console.log("🧪 Testnet Mode:", ProductionConfig.FEATURES.TESTNET_MODE);
        
        // Validate critical settings
        if (ProductionConfig.FEATURES.DEMO_MODE === false && ProductionConfig.FEATURES.ENABLE_TRADING === true) {
            console.log("🚀 Configuration is set for PRODUCTION MODE!");
            return true;
        } else {
            console.log("🎮 Configuration is set for DEMO MODE");
            return false;
        }
        
    } catch (error) {
        console.error("❌ ProductionConfig test failed:", error.message);
        return false;
    }
}

// Test 2: Check if RealPolymarketAPI initializes
async function testRealPolymarketAPI() {
    console.log("\n2️⃣ Testing RealPolymarketAPI...");
    
    try {
        const { RealPolymarketAPI } = await import('./js/core/real-polymarket-api.js');
        
        console.log("✅ RealPolymarketAPI imported successfully");
        
        const api = new RealPolymarketAPI();
        console.log("✅ RealPolymarketAPI instance created");
        
        // Test initialization
        await api.initialize();
        console.log("✅ RealPolymarketAPI initialized");
        
        // Test health check
        const healthy = await api.healthCheck();
        console.log(`📊 Health check: ${healthy ? '✅ PASS' : '❌ FAIL'}`);
        
        if (healthy) {
            // Test market fetching
            console.log("⏳ Testing real market data fetch...");
            const markets = await api.fetchRealCryptoMarkets();
            console.log(`📈 Found ${markets.length} real markets`);
            
            if (markets.length > 0) {
                console.log(`💎 Sample market: ${markets[0].question}`);
                console.log(`🔗 Asset: ${markets[0].asset}`);
                console.log(`💰 Volume: $${markets[0].volume}`);
            }
        }
        
        return healthy;
        
    } catch (error) {
        console.error("❌ RealPolymarketAPI test failed:", error.message);
        return false;
    }
}

// Test 3: Check if WalletManager works
async function testWalletManager() {
    console.log("\n3️⃣ Testing WalletManager...");
    
    try {
        const { WalletManager } = await import('./js/core/wallet-manager.js');
        
        console.log("✅ WalletManager imported successfully");
        
        const wallet = new WalletManager();
        console.log("✅ WalletManager instance created");
        
        // Check if MetaMask is available (this won't work in Node.js, but we can test the class)
        console.log("📊 Wallet info:", wallet.getWalletInfo());
        
        return true;
        
    } catch (error) {
        console.error("❌ WalletManager test failed:", error.message);
        return false;
    }
}

// Test 4: Check if RealWebSocketManager loads
async function testRealWebSocketManager() {
    console.log("\n4️⃣ Testing RealWebSocketManager...");
    
    try {
        const { RealWebSocketManager } = await import('./js/core/real-websocket-manager.js');
        
        console.log("✅ RealWebSocketManager imported successfully");
        
        const ws = new RealWebSocketManager();
        console.log("✅ RealWebSocketManager instance created");
        console.log("📊 Connection status:", ws.getConnectionStatus());
        
        return true;
        
    } catch (error) {
        console.error("❌ RealWebSocketManager test failed:", error.message);
        return false;
    }
}

// Test 5: Check TradingEngine integration
async function testTradingEngineIntegration() {
    console.log("\n5️⃣ Testing TradingEngine Integration...");
    
    try {
        // Import all required components
        const { TradingEngine } = await import('./js/trading/trading-engine.js');
        const { RealPolymarketAPI } = await import('./js/core/real-polymarket-api.js');
        const { WalletManager } = await import('./js/core/wallet-manager.js');
        const { RealWebSocketManager } = await import('./js/core/real-websocket-manager.js');
        
        console.log("✅ All trading components imported");
        
        // Create mock database for testing
        const mockDatabase = {
            isReady: () => true,
            connect: () => Promise.resolve(),
            close: () => Promise.resolve()
        };
        
        const api = new RealPolymarketAPI();
        const wallet = new WalletManager();
        const webSocket = new RealWebSocketManager();
        
        const tradingEngine = new TradingEngine({
            database: mockDatabase,
            api: api,
            wallet: wallet,
            webSocket: webSocket,
            demoMode: false // Test production mode
        });
        
        console.log("✅ TradingEngine created with real components");
        console.log("📊 Production safety:", tradingEngine.productionSafety);
        
        return true;
        
    } catch (error) {
        console.error("❌ TradingEngine integration test failed:", error.message);
        return false;
    }
}

// Run all tests
async function runAllTests() {
    console.log("🚀 POLYMARKET TRADING AGENT - INTEGRATION TEST SUITE");
    console.log("=" .repeat(60));
    
    const results = {
        config: await testProductionConfig(),
        api: await testRealPolymarketAPI(),
        wallet: await testWalletManager(),
        webSocket: await testRealWebSocketManager(),
        trading: await testTradingEngineIntegration()
    };
    
    console.log("\n" + "=" .repeat(60));
    console.log("📋 TEST RESULTS SUMMARY:");
    console.log("=" .repeat(60));
    
    Object.entries(results).forEach(([test, passed]) => {
        const icon = passed ? "✅" : "❌";
        const status = passed ? "PASS" : "FAIL";
        console.log(`${icon} ${test.toUpperCase().padEnd(15)} ${status}`);
    });
    
    const totalTests = Object.keys(results).length;
    const passedTests = Object.values(results).filter(Boolean).length;
    const failedTests = totalTests - passedTests;
    
    console.log("=" .repeat(60));
    console.log(`📊 TOTAL: ${totalTests} | ✅ PASSED: ${passedTests} | ❌ FAILED: ${failedTests}`);
    
    if (passedTests === totalTests) {
        console.log("🎉 ALL TESTS PASSED! Real integration is working!");
    } else {
        console.log("⚠️  Some tests failed. Check the errors above.");
    }
    
    return results;
}

// Run the tests
runAllTests().catch(console.error);