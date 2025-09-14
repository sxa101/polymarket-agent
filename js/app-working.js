import { DatabaseManager } from './data/database.js';
import { PolymarketAPI } from './core/polymarket-api.js';
import { RealPolymarketAPI } from './core/real-polymarket-api.js';
import { MarketDataStream } from './core/market-stream.js';
import { RealWebSocketManager } from './core/real-websocket-manager.js';
import { TradingEngine } from './trading/trading-engine.js';
import { UIManager } from './ui/ui-manager.js';
import { SettingsPanel } from './ui/settings-panel.js';
import { WalletManager } from './core/wallet-manager.js';
import { DemoDataProvider } from './demo/demo-data.js';
import { ProductionConfig } from './config/production-config.js';
import { Logger } from './utils/logger.js';
import { MarketAnalyzer } from './trading/market-analyzer.js';
import { SmartOrderManager } from './trading/smart-orders.js';
import { RealTimeAlertSystem } from './monitoring/alert-system.js';

// Make ProductionConfig globally accessible for debugging
window.ProductionConfig = ProductionConfig;

class PolymarketTradingAgent {
    constructor() {
        this.isInitialized = false;
        this.isDemoMode = ProductionConfig.FEATURES.DEMO_MODE; // Use configuration
        this.components = {};
        this.logger = new Logger('TradingAgent');
        
        // Add demo data provider
        this.demoData = null;
        
        // Initialization status tracking
        this.initializationStatus = {
            database: 'pending',
            wallet: 'pending',
            api: 'pending',
            marketStream: 'pending',
            webSocket: 'pending',
            tradingEngine: 'pending',
            marketAnalyzer: 'pending',
            smartOrders: 'pending',
            alertSystem: 'pending',
            ui: 'pending'
        };
        
        // Error tracking
        this.errors = [];
    }

    async initialize() {
        try {
            this.logger.info('🚀 Initializing Polymarket Trading Agent...');
            
            // Check if we should run in demo mode
            await this.checkDemoMode();
            
            if (this.isDemoMode) {
                this.logger.info('🎮 Running in DEMO MODE with simulated data');
                this.demoData = new DemoDataProvider();
            }

            // Initialize components with proper error handling
            await this.initializeDatabase();
            await this.initializeWallet();
            await this.initializeAPI();
            await this.initializeWebSocket();
            await this.initializeMarketStream();
            await this.initializeTradingEngine();
            await this.initializeAdvancedComponents();
            await this.initializeUI();

            // Initialize settings panel
            this.settingsPanel = new SettingsPanel();

            // Set up event listeners
            this.setupEventListeners();

            // Start demo data flow if in demo mode
            if (this.isDemoMode) {
                await this.startDemoDataFlow();
            }

            this.isInitialized = true;
            this.logger.info('✅ Trading Agent initialized successfully');

            // Update UI status
            this.updateConnectionStatus();
            
            // Show initialization results
            this.showInitializationResults();

        } catch (error) {
            this.logger.error('❌ Failed to initialize Trading Agent:', error);
            this.errors.push({ component: 'main', error: error.message });
            this.showError('Failed to initialize application: ' + error.message);
        }
    }

    async checkDemoMode() {
        this.logger.info('🔍 Checking demo mode configuration...');
        
        // PRIMARY: Use ProductionConfig.FEATURES.DEMO_MODE as the authoritative source
        const configDemoMode = ProductionConfig.FEATURES.DEMO_MODE;
        const configTradingEnabled = ProductionConfig.FEATURES.ENABLE_TRADING;
        
        this.logger.info(`📊 Config settings: DEMO_MODE=${configDemoMode}, ENABLE_TRADING=${configTradingEnabled}`);
        
        // If demo mode is explicitly disabled in config, try to enable production mode
        if (!configDemoMode && configTradingEnabled) {
            const hasMetaMask = typeof window.ethereum !== 'undefined';
            
            if (!hasMetaMask) {
                this.logger.warn('⚠️ Config wants production mode but MetaMask not available - falling back to demo');
                this.isDemoMode = true;
                return;
            }
            
            // Use production mode
            this.isDemoMode = false;
            this.logger.info('🚀 PRODUCTION MODE ENABLED - Real Polymarket integration active!');
            return;
        }
        
        // Otherwise use demo mode
        this.isDemoMode = true;
        if (!configTradingEnabled) {
            this.logger.info('🎮 Trading disabled in config - using DEMO mode');
        } else {
            this.logger.info('🎮 Demo mode enabled in config - using DEMO mode');
        }
    }

    async initializeDatabase() {
        try {
            this.logger.info('📊 Initializing database...');
            this.components.database = new DatabaseManager();
            await this.components.database.initialize();
            
            // Test basic functionality
            await this.components.database.saveConfig('init_test', Date.now());
            const testValue = await this.components.database.getConfig('init_test');
            
            if (testValue) {
                this.initializationStatus.database = 'success';
                this.logger.info('✅ Database initialized and tested successfully');
            } else {
                throw new Error('Database test failed');
            }
            
        } catch (error) {
            this.initializationStatus.database = 'error';
            this.errors.push({ component: 'database', error: error.message });
            this.logger.error('❌ Database initialization failed:', error);
            
            // Continue with in-memory fallback
            this.components.database = new MockDatabase();
            this.logger.info('🔄 Using in-memory database fallback');
        }
    }

    async initializeWallet() {
        try {
            this.logger.info('👛 Initializing wallet...');
            this.components.wallet = new WalletManager();
            
            if (!this.isDemoMode) {
                await this.components.wallet.initialize();
            }
            
            this.initializationStatus.wallet = 'success';
            this.logger.info('✅ Wallet manager initialized');
            
        } catch (error) {
            this.initializationStatus.wallet = 'error';
            this.errors.push({ component: 'wallet', error: error.message });
            this.logger.error('❌ Wallet initialization failed:', error);
            
            // Continue without wallet in demo mode
            if (this.isDemoMode) {
                this.components.wallet = new MockWallet();
                this.logger.info('🔄 Using mock wallet for demo mode');
            }
        }
    }

    async initializeAPI() {
        try {
            this.logger.info('🌐 Initializing API...');
            
            if (this.isDemoMode) {
                this.components.api = new MockAPI(this.demoData);
                this.logger.info('🎮 Using demo API with simulated data');
            } else {
                // Use real Polymarket API for production
                this.components.api = new RealPolymarketAPI();
                await this.components.api.initialize();
                
                // Test real API connectivity
                const healthCheck = await this.components.api.healthCheck();
                if (!healthCheck) {
                    throw new Error('Real Polymarket API health check failed');
                }
                
                this.logger.info('🚀 Real Polymarket API initialized and connected');
            }
            
            this.initializationStatus.api = 'success';
            this.logger.info('✅ API initialized successfully');
            
        } catch (error) {
            this.initializationStatus.api = 'error';
            this.errors.push({ component: 'api', error: error.message });
            this.logger.error('❌ API initialization failed:', error);
            
            // Fallback to demo mode
            this.isDemoMode = true;
            this.components.api = new MockAPI(this.demoData);
            this.logger.info('🔄 Falling back to demo API');
        }
    }

    async initializeWebSocket() {
        try {
            this.logger.info('🔗 Initializing WebSocket...');
            
            if (this.isDemoMode) {
                this.components.webSocket = null; // No real WebSocket in demo mode
                this.logger.info('🎮 Skipping WebSocket in demo mode');
            } else {
                // Initialize real WebSocket for production
                this.components.webSocket = new RealWebSocketManager();
                await this.components.webSocket.initialize();
                this.logger.info('🚀 Real WebSocket initialized and connected');
            }
            
            this.initializationStatus.webSocket = 'success';
            this.logger.info('✅ WebSocket initialized');
            
        } catch (error) {
            this.initializationStatus.webSocket = 'error';
            this.errors.push({ component: 'webSocket', error: error.message });
            this.logger.error('❌ WebSocket initialization failed:', error);
            
            // Continue without WebSocket (polling fallback)
            this.components.webSocket = null;
            this.logger.info('🔄 Continuing without WebSocket - will use polling');
        }
    }

    async initializeMarketStream() {
        try {
            this.logger.info('📡 Initializing market data stream...');
            
            if (this.isDemoMode) {
                this.components.marketStream = new MockMarketStream(this.demoData);
                this.logger.info('🎮 Using demo market stream');
            } else {
                this.components.marketStream = new MarketDataStream();
            }
            
            this.initializationStatus.marketStream = 'success';
            this.logger.info('✅ Market stream initialized');
            
        } catch (error) {
            this.initializationStatus.marketStream = 'error';
            this.errors.push({ component: 'marketStream', error: error.message });
            this.logger.error('❌ Market stream initialization failed:', error);
            
            // Continue without real-time data
            this.components.marketStream = new MockMarketStream(this.demoData);
        }
    }

    async initializeTradingEngine() {
        try {
            this.logger.info('⚙️ Initializing trading engine...');
            
            this.components.tradingEngine = new TradingEngine({
                database: this.components.database,
                api: this.components.api,
                wallet: this.components.wallet,
                webSocket: this.components.webSocket,
                demoMode: this.isDemoMode
            });
            
            this.initializationStatus.tradingEngine = 'success';
            this.logger.info('✅ Trading engine initialized');
            
        } catch (error) {
            this.initializationStatus.tradingEngine = 'error';
            this.errors.push({ component: 'tradingEngine', error: error.message });
            this.logger.error('❌ Trading engine initialization failed:', error);
            
            // Continue with limited functionality
            this.components.tradingEngine = new MockTradingEngine();
        }
    }

    async initializeAdvancedComponents() {
        // Initialize Market Analyzer
        try {
            this.logger.info('🧠 Initializing Market Analyzer...');
            this.components.marketAnalyzer = new MarketAnalyzer(this.components.api, this.components.database);
            this.initializationStatus.marketAnalyzer = 'success';
            this.logger.info('✅ Market Analyzer initialized');
        } catch (error) {
            this.initializationStatus.marketAnalyzer = 'error';
            this.errors.push({ component: 'marketAnalyzer', error: error.message });
            this.logger.error('❌ Market Analyzer initialization failed:', error);
            this.components.marketAnalyzer = null;
        }

        // Initialize Smart Order Manager
        try {
            this.logger.info('📋 Initializing Smart Order Manager...');
            this.components.smartOrders = new SmartOrderManager({
                database: this.components.database,
                api: this.components.api,
                wallet: this.components.wallet,
                tradingEngine: this.components.tradingEngine,
                demoMode: this.isDemoMode
            });
            await this.components.smartOrders.initialize();
            this.initializationStatus.smartOrders = 'success';
            this.logger.info('✅ Smart Order Manager initialized');
        } catch (error) {
            this.initializationStatus.smartOrders = 'error';
            this.errors.push({ component: 'smartOrders', error: error.message });
            this.logger.error('❌ Smart Order Manager initialization failed:', error);
            this.components.smartOrders = null;
        }

        // Initialize Alert System (if enabled)
        try {
            if (ProductionConfig.FEATURES.ENABLE_ALERT_SYSTEM) {
                this.logger.info('🚨 Initializing Real-time Alert System...');
                this.components.alertSystem = new RealTimeAlertSystem({
                    database: this.components.database,
                    api: this.components.api,
                    tradingEngine: this.components.tradingEngine,
                    wallet: this.components.wallet,
                    marketAnalyzer: this.components.marketAnalyzer
                });
                await this.components.alertSystem.initialize();
                this.initializationStatus.alertSystem = 'success';
                this.logger.info('✅ Alert System initialized');
            } else {
                this.initializationStatus.alertSystem = 'disabled';
                this.logger.info('⚙️ Alert System disabled in configuration');
                this.components.alertSystem = null;
            }
        } catch (error) {
            this.initializationStatus.alertSystem = 'error';
            this.errors.push({ component: 'alertSystem', error: error.message });
            this.logger.error('❌ Alert System initialization failed:', error);
            this.components.alertSystem = null;
        }
    }

    async initializeUI() {
        try {
            this.logger.info('🎨 Initializing UI...');
            
            this.components.ui = new UIManager({
                database: this.components.database,
                api: this.components.api,
                marketStream: this.components.marketStream,
                tradingEngine: this.components.tradingEngine,
                wallet: this.components.wallet,
                marketAnalyzer: this.components.marketAnalyzer,
                smartOrders: this.components.smartOrders,
                alertSystem: this.components.alertSystem,
                demoMode: this.isDemoMode
            });

            await this.components.ui.initialize();
            
            this.initializationStatus.ui = 'success';
            this.logger.info('✅ UI initialized successfully');
            
        } catch (error) {
            this.initializationStatus.ui = 'error';
            this.errors.push({ component: 'ui', error: error.message });
            this.logger.error('❌ UI initialization failed:', error);
            throw error; // UI is critical
        }
    }

    async startDemoDataFlow() {
        try {
            this.logger.info('🎮 Starting demo data flow...');
            
            // Load initial markets
            const markets = await this.components.api.getActiveMarkets();
            this.logger.info(`📊 Loaded ${markets.length} demo markets`);
            
            // Save markets to database
            for (const market of markets) {
                await this.components.database.saveMarket(market);
            }
            
            // Start simulated market updates
            if (this.components.marketStream && this.components.marketStream.startDemo) {
                this.components.marketStream.startDemo();
            }
            
            this.logger.info('✅ Demo data flow started');
            
        } catch (error) {
            this.logger.error('❌ Failed to start demo data flow:', error);
        }
    }

    setupEventListeners() {
        // Settings button
        document.getElementById('settings-btn')?.addEventListener('click', () => {
            if (this.settingsPanel) {
                this.settingsPanel.show();
            }
        });

        // Wallet connection events
        this.components.wallet.on('connected', (account) => {
            this.logger.info('Wallet connected:', account);
            this.updateConnectionStatus();
            if (this.components.ui) {
                this.components.ui.showSuccess('Wallet connected successfully');
            }
        });

        this.components.wallet.on('disconnected', () => {
            this.logger.info('Wallet disconnected');
            this.updateConnectionStatus();
            if (this.components.ui) {
                this.components.ui.showInfo('Wallet disconnected');
            }
        });

        // Market data events
        this.components.marketStream.on('connected', () => {
            this.logger.info('Market data stream connected');
            this.updateConnectionStatus();
        });

        this.components.marketStream.on('disconnected', () => {
            this.logger.warn('Market data stream disconnected');
            this.updateConnectionStatus();
        });

        this.components.marketStream.on('marketUpdate', (data) => {
            if (this.components.ui) {
                this.components.ui.updateMarketData(data);
            }
        });

        // Trading events
        this.components.tradingEngine.on('orderPlaced', (order) => {
            this.logger.info('Order placed:', order);
            if (this.components.ui) {
                this.components.ui.updatePositions();
            }
        });

        this.components.tradingEngine.on('orderFilled', (trade) => {
            this.logger.info('Order filled:', trade);
            if (this.components.ui) {
                this.components.ui.updatePositions();
                this.components.ui.updateTradeHistory();
            }
        });

        this.components.tradingEngine.on('error', (error) => {
            this.logger.error('Trading engine error:', error);
            if (this.components.ui) {
                this.components.ui.showError(`Trading error: ${error.message}`);
            }
        });

        // Alert system events
        if (this.components.alertSystem) {
            document.addEventListener('alertTriggered', (event) => {
                const alert = event.detail;
                this.logger.info(`Alert triggered: ${alert.ruleName}`, alert);
                if (this.components.ui) {
                    this.components.ui.showAlert(alert);
                }
            });

            document.addEventListener('newNotification', (event) => {
                const notification = event.detail;
                if (this.components.ui) {
                    this.components.ui.showNotification(notification);
                }
            });
        }

        // Window events
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });

        // Error handling
        window.addEventListener('error', (event) => {
            this.logger.error('Unhandled error:', event.error);
            this.showError('An unexpected error occurred. Check console for details.');
        });

        window.addEventListener('unhandledrejection', (event) => {
            this.logger.error('Unhandled promise rejection:', event.reason);
            this.showError('An unexpected error occurred. Check console for details.');
        });
    }

    updateConnectionStatus() {
        const walletStatus = document.getElementById('wallet-status');
        const marketStatus = document.getElementById('market-status');

        if (walletStatus) {
            if (this.isDemoMode) {
                walletStatus.textContent = 'Demo Mode';
                walletStatus.className = 'status-indicator demo';
            } else {
                const isConnected = this.components.wallet.isConnected();
                const account = this.components.wallet.getAccount();
                walletStatus.textContent = isConnected 
                    ? `Wallet: ${account.slice(0, 6)}...${account.slice(-4)}`
                    : 'Wallet: Not Connected';
                walletStatus.className = `status-indicator ${isConnected ? 'connected' : 'disconnected'}`;
            }
        }

        if (marketStatus) {
            if (this.isDemoMode) {
                marketStatus.textContent = 'Markets: Demo Data';
                marketStatus.className = 'status-indicator demo';
            } else {
                const isConnected = this.components.marketStream.isConnected();
                marketStatus.textContent = isConnected 
                    ? 'Markets: Connected'
                    : 'Markets: Disconnected';
                marketStatus.className = `status-indicator ${isConnected ? 'connected' : 'disconnected'}`;
            }
        }
    }

    showInitializationResults() {
        const successCount = Object.values(this.initializationStatus).filter(s => s === 'success').length;
        const totalCount = Object.keys(this.initializationStatus).length;
        
        this.logger.info(`📊 Initialization Summary: ${successCount}/${totalCount} components successful`);
        
        if (this.errors.length > 0) {
            this.logger.warn(`⚠️  ${this.errors.length} initialization errors (running in fallback mode)`);
            for (const error of this.errors) {
                this.logger.warn(`  - ${error.component}: ${error.error}`);
            }
        }
        
        if (this.isDemoMode) {
            this.showInfo('🎮 Running in Demo Mode - No real trading will occur');
        }
    }

    showError(message) {
        if (this.components.ui) {
            this.components.ui.showError(message);
        } else {
            console.error(message);
            alert(message);
        }
    }

    showInfo(message) {
        if (this.components.ui) {
            this.components.ui.showInfo(message);
        } else {
            console.info(message);
        }
    }

    async cleanup() {
        this.logger.info('Cleaning up Trading Agent...');
        
        try {
            if (this.demoData) {
                this.demoData.destroy();
            }
            
            // Cleanup advanced components first
            if (this.components.alertSystem) {
                this.components.alertSystem.destroy();
            }
            if (this.components.smartOrders) {
                this.components.smartOrders.destroy();
            }
            if (this.components.marketAnalyzer) {
                this.components.marketAnalyzer.cleanupCache();
            }
            
            // Cleanup core components
            if (this.components.marketStream) {
                this.components.marketStream.disconnect();
            }
            if (this.components.database) {
                await this.components.database.close();
            }
            if (this.components.ui) {
                this.components.ui.destroy();
            }
        } catch (error) {
            this.logger.error('Error during cleanup:', error);
        }
    }

    // Alert System Methods
    dismissAlert(alertId) {
        if (this.components.alertSystem) {
            this.components.alertSystem.dismissAlert(alertId);
        }
    }

    acknowledgeAlert(alertId) {
        if (this.components.alertSystem) {
            this.components.alertSystem.acknowledgeAlert(alertId);
        }
    }

    showAlertDetails(alertId) {
        if (this.components.alertSystem && this.components.ui) {
            const activeAlerts = this.components.alertSystem.getActiveAlerts();
            const alert = activeAlerts.find(a => a.id === alertId);
            
            if (alert) {
                const detailsHTML = `
                    <div class="alert-details">
                        <h3>${alert.ruleName}</h3>
                        <p><strong>Priority:</strong> ${alert.priority}</p>
                        <p><strong>Type:</strong> ${alert.type}</p>
                        <p><strong>Message:</strong> ${alert.message}</p>
                        <p><strong>Triggered:</strong> ${new Date(alert.timestamp).toLocaleString()}</p>
                        ${alert.autoAnalysis ? `
                            <div class="auto-analysis">
                                <h4>Auto-Analysis Results:</h4>
                                <pre>${JSON.stringify(alert.autoAnalysis.results, null, 2)}</pre>
                            </div>
                        ` : ''}
                        <div class="alert-actions" style="margin-top: 16px;">
                            <button onclick="window.tradingAgent.acknowledgeAlert('${alertId}'); window.tradingAgent.getComponent('ui').closeModal();">
                                Acknowledge
                            </button>
                            <button onclick="window.tradingAgent.dismissAlert('${alertId}'); window.tradingAgent.getComponent('ui').closeModal();">
                                Dismiss
                            </button>
                        </div>
                    </div>
                `;
                
                this.components.ui.showModal(`Alert Details`, detailsHTML);
            }
        }
    }

    getAlertStatistics() {
        if (this.components.alertSystem) {
            return this.components.alertSystem.getAlertStatistics();
        }
        return null;
    }

    // Market Analysis Methods
    async analyzeMarketOpportunities() {
        if (this.components.marketAnalyzer && this.components.api) {
            try {
                const opportunities = await this.components.marketAnalyzer.analyzeMarketOpportunities();
                this.logger.info(`Found ${opportunities.length} market opportunities`);
                return opportunities;
            } catch (error) {
                this.logger.error('Failed to analyze market opportunities:', error);
                throw error;
            }
        }
        return [];
    }

    // Smart Orders Methods
    async executeSmartOrder(orderType, params) {
        if (this.components.smartOrders) {
            try {
                return await this.components.smartOrders.executeOrder(orderType, params);
            } catch (error) {
                this.logger.error('Failed to execute smart order:', error);
                throw error;
            }
        }
        throw new Error('Smart Order Manager not available');
    }

    // Public API methods
    async connectWallet() {
        try {
            if (this.isDemoMode) {
                this.showInfo('Demo mode active - wallet connection simulated');
                return;
            }
            await this.components.wallet.connect();
        } catch (error) {
            this.logger.error('Failed to connect wallet:', error);
            this.showError('Failed to connect wallet. Please try again.');
        }
    }

    async disconnectWallet() {
        try {
            await this.components.wallet.disconnect();
        } catch (error) {
            this.logger.error('Failed to disconnect wallet:', error);
            this.showError('Failed to disconnect wallet.');
        }
    }

    async refreshMarkets() {
        try {
            await this.components.ui.refreshMarkets();
        } catch (error) {
            this.logger.error('Failed to refresh markets:', error);
            this.showError('Failed to refresh markets. Please try again.');
        }
    }

    getComponent(name) {
        return this.components[name];
    }

    getStatus() {
        return {
            isInitialized: this.isInitialized,
            isDemoMode: this.isDemoMode,
            initializationStatus: { ...this.initializationStatus },
            errors: [...this.errors],
            components: Object.keys(this.components)
        };
    }

    // Demo mode controls
    toggleDemoMode() {
        this.isDemoMode = !this.isDemoMode;
        localStorage.setItem('forceDemo', this.isDemoMode.toString());
        location.reload(); // Restart with new mode
    }

    async loadDemoStrategy() {
        if (!this.isDemoMode) return;
        
        try {
            const demoStrategy = {
                name: 'Demo MA Strategy',
                type: 'MovingAverageCrossover',
                asset: 'BTC',
                positionSize: 0.02,
                active: true,
                strategyId: 'demo_strategy_' + Date.now(),
                fastPeriod: 5,
                slowPeriod: 10
            };
            
            await this.components.tradingEngine.addStrategy(demoStrategy);
            this.showInfo('Demo strategy loaded successfully');
        } catch (error) {
            this.logger.error('Failed to load demo strategy:', error);
        }
    }
}

// Mock classes for fallbacks
class MockDatabase {
    constructor() {
        this.data = new Map();
    }
    
    async initialize() {}
    async saveConfig(key, value) { this.data.set(key, value); }
    async getConfig(key) { return this.data.get(key); }
    async saveMarket(market) { this.data.set(`market_${market.id}`, market); }
    async getActiveMarkets() { return Array.from(this.data.values()).filter(v => v.id); }
    async close() {}
}

class MockWallet {
    isConnected() { return false; }
    getAccount() { return null; }
    on() {}
    emit() {}
}

class MockAPI {
    constructor(demoData) {
        this.demoData = demoData;
    }
    
    async getActiveMarkets() {
        return this.demoData ? this.demoData.getActiveMarkets() : [];
    }
    
    async getMarket(id) {
        return this.demoData ? this.demoData.getMarket(id) : null;
    }
}

class MockMarketStream {
    constructor(demoData) {
        this.demoData = demoData;
        this.listeners = new Map();
    }
    
    isConnected() { return true; }
    on(event, listener) { 
        if (!this.listeners.has(event)) this.listeners.set(event, []);
        this.listeners.get(event).push(listener);
    }
    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(listener => listener(data));
        }
    }
    startDemo() {
        setTimeout(() => this.emit('connected'), 100);
    }
}

class MockTradingEngine {
    getStatus() { return { isRunning: false }; }
    getPositions() { return []; }
    getActiveOrders() { return []; }
    on() {}
    emit() {}
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 DOM loaded - initializing Polymarket Trading Agent...");
    console.log("📊 Configuration loaded:", {
        demoMode: ProductionConfig.FEATURES.DEMO_MODE,
        tradingEnabled: ProductionConfig.FEATURES.ENABLE_TRADING,
        testnetMode: ProductionConfig.FEATURES.TESTNET_MODE,
        configObject: ProductionConfig
    });
    
    window.tradingAgent = new PolymarketTradingAgent();
    await window.tradingAgent.initialize();
    
    console.log("✅ Trading agent initialization completed");
    console.log("🔍 App state:", {
        initialized: window.tradingAgent.isInitialized,
        demoMode: window.tradingAgent.isDemoMode,
        components: Object.keys(window.tradingAgent.components),
        errors: window.tradingAgent.errors
    });
});

// Export for module use
export { PolymarketTradingAgent };