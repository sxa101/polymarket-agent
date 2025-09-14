import { DatabaseManager } from './data/database.js';
import { PolymarketAPI } from './core/polymarket-api.js';
import { MarketDataStream } from './core/market-stream.js';
import { TradingEngine } from './trading/trading-engine.js';
import { UIManager } from './ui/ui-manager.js';
import { WalletManager } from './core/wallet-manager.js';
import { Logger } from './utils/logger.js';

class PolymarketTradingAgent {
    constructor() {
        this.isInitialized = false;
        this.components = {};
        this.logger = new Logger('TradingAgent');
    }

    async initialize() {
        try {
            this.logger.info('Initializing Polymarket Trading Agent...');

            // Initialize core components
            this.components.database = new DatabaseManager();
            await this.components.database.initialize();
            
            this.components.wallet = new WalletManager();
            this.components.api = new PolymarketAPI();
            this.components.marketStream = new MarketDataStream();
            this.components.tradingEngine = new TradingEngine({
                database: this.components.database,
                api: this.components.api,
                wallet: this.components.wallet
            });
            
            this.components.ui = new UIManager({
                database: this.components.database,
                api: this.components.api,
                marketStream: this.components.marketStream,
                tradingEngine: this.components.tradingEngine,
                wallet: this.components.wallet
            });

            // Initialize UI
            await this.components.ui.initialize();

            // Set up event listeners
            this.setupEventListeners();

            this.isInitialized = true;
            this.logger.info('Trading Agent initialized successfully');

            // Update UI status
            this.updateConnectionStatus();

        } catch (error) {
            this.logger.error('Failed to initialize Trading Agent:', error);
            this.showError('Failed to initialize application. Please refresh and try again.');
        }
    }

    setupEventListeners() {
        // Wallet connection events
        this.components.wallet.on('connected', (account) => {
            this.logger.info('Wallet connected:', account);
            this.updateConnectionStatus();
            this.components.ui.showSuccess('Wallet connected successfully');
        });

        this.components.wallet.on('disconnected', () => {
            this.logger.info('Wallet disconnected');
            this.updateConnectionStatus();
            this.components.ui.showInfo('Wallet disconnected');
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
            this.components.ui.updateMarketData(data);
        });

        // Trading events
        this.components.tradingEngine.on('orderPlaced', (order) => {
            this.logger.info('Order placed:', order);
            this.components.ui.updatePositions();
        });

        this.components.tradingEngine.on('orderFilled', (trade) => {
            this.logger.info('Order filled:', trade);
            this.components.ui.updatePositions();
            this.components.ui.updateTradeHistory();
        });

        this.components.tradingEngine.on('error', (error) => {
            this.logger.error('Trading engine error:', error);
            this.components.ui.showError(`Trading error: ${error.message}`);
        });

        // Window events
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });

        // Error handling
        window.addEventListener('error', (event) => {
            this.logger.error('Unhandled error:', event.error);
            this.showError('An unexpected error occurred. Please check the console for details.');
        });

        window.addEventListener('unhandledrejection', (event) => {
            this.logger.error('Unhandled promise rejection:', event.reason);
            this.showError('An unexpected error occurred. Please check the console for details.');
        });
    }

    updateConnectionStatus() {
        const walletStatus = document.getElementById('wallet-status');
        const marketStatus = document.getElementById('market-status');

        if (walletStatus) {
            const isConnected = this.components.wallet.isConnected();
            const account = this.components.wallet.getAccount();
            walletStatus.textContent = isConnected 
                ? `Wallet: ${account.slice(0, 6)}...${account.slice(-4)}`
                : 'Wallet: Not Connected';
            walletStatus.className = `status-indicator ${isConnected ? 'connected' : 'disconnected'}`;
        }

        if (marketStatus) {
            const isConnected = this.components.marketStream.isConnected();
            marketStatus.textContent = isConnected 
                ? 'Markets: Connected'
                : 'Markets: Disconnected';
            marketStatus.className = `status-indicator ${isConnected ? 'connected' : 'disconnected'}`;
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

    async cleanup() {
        this.logger.info('Cleaning up Trading Agent...');
        
        try {
            if (this.components.marketStream) {
                this.components.marketStream.disconnect();
            }
            if (this.components.database) {
                await this.components.database.close();
            }
        } catch (error) {
            this.logger.error('Error during cleanup:', error);
        }
    }

    // Public API methods
    async connectWallet() {
        try {
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
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    window.tradingAgent = new PolymarketTradingAgent();
    await window.tradingAgent.initialize();
});

// Export for module use
export { PolymarketTradingAgent };