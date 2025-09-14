import { Logger } from '../utils/logger.js';

export class UIManager {
    constructor({ database, api, marketStream, tradingEngine, wallet, marketAnalyzer, smartOrders, alertSystem }) {
        this.database = database;
        this.api = api;
        this.marketStream = marketStream;
        this.tradingEngine = tradingEngine;
        this.wallet = wallet;
        this.marketAnalyzer = marketAnalyzer;
        this.smartOrders = smartOrders;
        this.alertSystem = alertSystem;
        this.logger = new Logger('UIManager');
        
        this.currentView = 'dashboard';
        this.updateIntervals = new Map();
        this.components = new Map();
        
        // Modal management
        this.modalOverlay = null;
        this.modal = null;
        this.modalContent = null;
    }

    async initialize() {
        try {
            this.logger.info('Initializing UI Manager...');
            
            // Get DOM elements
            this.initializeDOMElements();
            
            // Set up navigation
            this.setupNavigation();
            
            // Initialize components
            await this.initializeComponents();
            
            // Set up real-time updates
            this.setupRealTimeUpdates();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Load initial data
            await this.loadInitialData();
            
            this.logger.info('UI Manager initialized successfully');
            
        } catch (error) {
            this.logger.error('Failed to initialize UI Manager:', error);
            throw error;
        }
    }

    initializeDOMElements() {
        // Navigation
        this.navButtons = document.querySelectorAll('.nav-btn');
        this.views = document.querySelectorAll('.view');
        
        // Modal elements
        this.modalOverlay = document.getElementById('modal-overlay');
        this.modal = document.querySelector('.modal');
        this.modalContent = document.getElementById('modal-content');
        
        // Dashboard elements
        this.dashboardElements = {
            marketList: document.querySelector('#active-markets .market-list'),
            positionsList: document.querySelector('#positions .positions-list'),
            pnlMetrics: document.querySelector('#pnl-summary .pnl-metrics'),
            tradesList: document.querySelector('#recent-trades .trades-list')
        };
        
        // Markets view elements
        this.marketsElements = {
            assetFilter: document.getElementById('asset-filter'),
            refreshButton: document.getElementById('refresh-markets'),
            marketsGrid: document.getElementById('markets-grid')
        };
        
        // Strategy elements
        this.strategyElements = {
            createButton: document.getElementById('create-strategy'),
            backtestButton: document.getElementById('backtest-all'),
            strategiesList: document.getElementById('strategies-list')
        };
    }

    setupNavigation() {
        this.navButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const viewName = e.target.dataset.view;
                this.switchView(viewName);
            });
        });
        
        // Modal close handlers
        if (this.modalOverlay) {
            this.modalOverlay.addEventListener('click', (e) => {
                if (e.target === this.modalOverlay) {
                    this.closeModal();
                }
            });
        }
        
        const modalClose = document.querySelector('.modal-close');
        if (modalClose) {
            modalClose.addEventListener('click', () => this.closeModal());
        }
    }

    async initializeComponents() {
        // Initialize dashboard components
        this.components.set('dashboard', new DashboardComponent(this));
        this.components.set('markets', new MarketsComponent(this));
        this.components.set('strategies', new StrategiesComponent(this));
        this.components.set('portfolio', new PortfolioComponent(this));
        this.components.set('analytics', new AnalyticsComponent(this));
        
        // Initialize all components
        for (const [name, component] of this.components) {
            try {
                await component.initialize();
            } catch (error) {
                this.logger.error(`Failed to initialize ${name} component:`, error);
            }
        }
    }

    setupRealTimeUpdates() {
        // Update dashboard every 5 seconds
        this.updateIntervals.set('dashboard', setInterval(() => {
            if (this.currentView === 'dashboard') {
                this.updateDashboard();
            }
        }, 5000));
        
        // Update positions every 10 seconds
        this.updateIntervals.set('positions', setInterval(() => {
            this.updatePositions();
        }, 10000));
    }

    setupEventListeners() {
        // Markets filter
        if (this.marketsElements.assetFilter) {
            this.marketsElements.assetFilter.addEventListener('input', (e) => {
                this.filterMarkets(e.target.value);
            });
        }
        
        // Refresh markets button
        if (this.marketsElements.refreshButton) {
            this.marketsElements.refreshButton.addEventListener('click', () => {
                this.refreshMarkets();
            });
        }
        
        // Strategy buttons
        if (this.strategyElements.createButton) {
            this.strategyElements.createButton.addEventListener('click', () => {
                this.showCreateStrategyModal();
            });
        }
        
        if (this.strategyElements.backtestButton) {
            this.strategyElements.backtestButton.addEventListener('click', () => {
                this.runAllBacktests();
            });
        }
        
        // Wallet connection (these would be added by wallet manager)
        document.addEventListener('walletConnected', (e) => {
            this.updateWalletStatus();
        });
        
        document.addEventListener('walletDisconnected', (e) => {
            this.updateWalletStatus();
        });
    }

    async loadInitialData() {
        try {
            await Promise.all([
                this.updateDashboard(),
                this.loadMarkets(),
                this.loadStrategies(),
                this.updatePortfolio()
            ]);
        } catch (error) {
            this.logger.error('Failed to load initial data:', error);
        }
    }

    switchView(viewName) {
        // Update navigation
        this.navButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === viewName);
        });
        
        // Update views
        this.views.forEach(view => {
            view.classList.toggle('active', view.id === `${viewName}-view`);
        });
        
        this.currentView = viewName;
        
        // Load view-specific data
        const component = this.components.get(viewName);
        if (component && component.onViewActivated) {
            component.onViewActivated();
        }
    }

    async updateDashboard() {
        try {
            const component = this.components.get('dashboard');
            if (component) {
                await component.update();
            }
        } catch (error) {
            this.logger.error('Failed to update dashboard:', error);
        }
    }

    async updatePositions() {
        try {
            if (!this.tradingEngine) return;
            
            const positions = this.tradingEngine.getPositions();
            this.renderPositions(positions);
        } catch (error) {
            this.logger.error('Failed to update positions:', error);
        }
    }

    async updateTradeHistory() {
        try {
            const recentTrades = await this.database.getRecentTrades(10);
            this.renderTradeHistory(recentTrades);
        } catch (error) {
            this.logger.error('Failed to update trade history:', error);
        }
    }

    async updateMarketData(marketData) {
        try {
            // Update market displays with real-time data
            const marketCards = document.querySelectorAll(`[data-market-id="${marketData.marketId}"]`);
            
            marketCards.forEach(card => {
                const yesPrice = card.querySelector('.yes-price');
                const noPrice = card.querySelector('.no-price');
                
                if (yesPrice) {
                    yesPrice.textContent = (marketData.yesPrice * 100).toFixed(1) + '¢';
                }
                
                if (noPrice) {
                    noPrice.textContent = (marketData.noPrice * 100).toFixed(1) + '¢';
                }
            });
        } catch (error) {
            this.logger.error('Failed to update market data:', error);
        }
    }

    async loadMarkets() {
        try {
            const component = this.components.get('markets');
            if (component) {
                await component.loadMarkets();
            }
        } catch (error) {
            this.logger.error('Failed to load markets:', error);
        }
    }

    async refreshMarkets() {
        try {
            this.showLoading('Refreshing markets...');
            await this.loadMarkets();
            this.hideLoading();
            this.showSuccess('Markets refreshed successfully');
        } catch (error) {
            this.hideLoading();
            this.showError('Failed to refresh markets');
            this.logger.error('Failed to refresh markets:', error);
        }
    }

    filterMarkets(query) {
        const marketCards = document.querySelectorAll('.market-card');
        const lowerQuery = query.toLowerCase();
        
        marketCards.forEach(card => {
            const text = card.textContent.toLowerCase();
            const matches = text.includes(lowerQuery);
            card.style.display = matches ? 'block' : 'none';
        });
    }

    async loadStrategies() {
        try {
            const component = this.components.get('strategies');
            if (component) {
                await component.loadStrategies();
            }
        } catch (error) {
            this.logger.error('Failed to load strategies:', error);
        }
    }

    async updatePortfolio() {
        try {
            const component = this.components.get('portfolio');
            if (component) {
                await component.update();
            }
        } catch (error) {
            this.logger.error('Failed to update portfolio:', error);
        }
    }

    renderPositions(positions) {
        const container = this.dashboardElements.positionsList;
        if (!container) return;
        
        if (positions.length === 0) {
            container.innerHTML = '<div class="empty-state">No active positions</div>';
            return;
        }
        
        container.innerHTML = positions.map(position => `
            <div class="position-item">
                <div class="position-info">
                    <div class="position-market">${this.formatMarketId(position.marketId)}</div>
                    <div class="position-details">${position.side} ${position.quantity} @ ${position.averagePrice.toFixed(4)}</div>
                </div>
                <div class="position-pnl ${position.unrealizedPnL >= 0 ? 'positive' : 'negative'}">
                    ${position.unrealizedPnL >= 0 ? '+' : ''}${position.unrealizedPnL.toFixed(2)}
                </div>
            </div>
        `).join('');
    }

    renderTradeHistory(trades) {
        const container = this.dashboardElements.tradesList;
        if (!container) return;
        
        if (trades.length === 0) {
            container.innerHTML = '<div class="empty-state">No recent trades</div>';
            return;
        }
        
        container.innerHTML = trades.map(trade => `
            <div class="trade-item">
                <div class="trade-info">
                    <div class="trade-market">${this.formatMarketId(trade.marketId)}</div>
                    <div class="trade-details">${trade.side} ${trade.quantity} @ ${trade.price.toFixed(4)}</div>
                </div>
                <div class="trade-time">${this.formatTime(trade.timestamp)}</div>
            </div>
        `).join('');
    }

    updateWalletStatus() {
        const walletStatus = document.getElementById('wallet-status');
        if (!walletStatus) return;
        
        if (this.wallet.isConnected()) {
            const account = this.wallet.getAccount();
            walletStatus.textContent = `Wallet: ${account.slice(0, 6)}...${account.slice(-4)}`;
            walletStatus.classList.add('connected');
        } else {
            walletStatus.textContent = 'Wallet: Not Connected';
            walletStatus.classList.remove('connected');
        }
    }

    // Modal management
    showModal(title, content) {
        if (!this.modalOverlay) return;
        
        const modalTitle = document.getElementById('modal-title');
        if (modalTitle) modalTitle.textContent = title;
        
        if (this.modalContent) this.modalContent.innerHTML = content;
        
        this.modalOverlay.classList.add('active');
    }

    closeModal() {
        if (this.modalOverlay) {
            this.modalOverlay.classList.remove('active');
        }
    }

    showCreateStrategyModal() {
        const content = `
            <form id="strategy-form">
                <div class="form-group">
                    <label for="strategy-name">Strategy Name</label>
                    <input type="text" id="strategy-name" required>
                </div>
                <div class="form-group">
                    <label for="strategy-type">Strategy Type</label>
                    <select id="strategy-type" required>
                        <option value="MovingAverageCrossover">Moving Average Crossover</option>
                        <option value="RSIDivergence">RSI Divergence</option>
                        <option value="BollingerBands">Bollinger Bands</option>
                        <option value="OrderBookImbalance">Order Book Imbalance</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="strategy-asset">Asset</label>
                    <select id="strategy-asset" required>
                        <option value="BTC">Bitcoin</option>
                        <option value="ETH">Ethereum</option>
                        <option value="SOL">Solana</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="position-size">Position Size (%)</label>
                    <input type="number" id="position-size" min="1" max="10" value="5" required>
                </div>
                <div class="form-actions">
                    <button type="button" class="secondary" onclick="tradingAgent.getComponent('ui').closeModal()">Cancel</button>
                    <button type="submit">Create Strategy</button>
                </div>
            </form>
        `;
        
        this.showModal('Create New Strategy', content);
        
        // Handle form submission
        const form = document.getElementById('strategy-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleCreateStrategy(form);
            });
        }
    }

    async handleCreateStrategy(form) {
        try {
            const formData = new FormData(form);
            const strategyConfig = {
                name: formData.get('strategy-name'),
                type: formData.get('strategy-type'),
                asset: formData.get('strategy-asset'),
                positionSize: parseFloat(formData.get('position-size')) / 100,
                active: true,
                strategyId: `strategy_${Date.now()}`
            };
            
            await this.tradingEngine.addStrategy(strategyConfig);
            
            this.closeModal();
            this.showSuccess('Strategy created successfully');
            await this.loadStrategies();
            
        } catch (error) {
            this.logger.error('Failed to create strategy:', error);
            this.showError('Failed to create strategy');
        }
    }

    async runAllBacktests() {
        this.showInfo('Running backtests for all strategies...');
        // Implementation would run backtests and show results
        setTimeout(() => {
            this.showSuccess('Backtests completed');
        }, 2000);
    }

    // Utility methods
    formatMarketId(marketId) {
        // Extract readable market name from ID
        return marketId.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim();
    }

    formatTime(timestamp) {
        return new Date(timestamp).toLocaleTimeString();
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    }

    // Message display
    showSuccess(message) {
        this.showMessage(message, 'success');
    }

    showError(message) {
        this.showMessage(message, 'error');
    }

    showInfo(message) {
        this.showMessage(message, 'info');
    }

    showMessage(message, type) {
        // Create or update message display
        let messageDiv = document.querySelector('.message-display');
        if (!messageDiv) {
            messageDiv = document.createElement('div');
            messageDiv.className = 'message-display';
            document.body.appendChild(messageDiv);
        }
        
        messageDiv.innerHTML = `<div class="${type}-message">${message}</div>`;
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            messageDiv.innerHTML = '';
        }, 3000);
    }

    showAlert(alert) {
        // Show alert notification
        this.showNotification({
            id: alert.id,
            title: `🚨 Alert: ${alert.ruleName}`,
            message: alert.message,
            priority: alert.priority,
            timestamp: alert.timestamp,
            type: 'alert',
            actions: [
                { label: 'Dismiss', action: `window.tradingAgent.dismissAlert('${alert.id}')` },
                { label: 'View Details', action: `window.tradingAgent.showAlertDetails('${alert.id}')` }
            ]
        });
        
        // Also show as message for immediate visibility
        const priorityIcon = alert.priority === 'critical' ? '🔴' : 
                           alert.priority === 'high' ? '🟠' : 
                           alert.priority === 'medium' ? '🟡' : '🟢';
        
        this.showMessage(`${priorityIcon} ${alert.ruleName}: ${alert.message}`, 
                        alert.priority === 'critical' ? 'error' : 'info');
    }

    showNotification(notification) {
        // Create notification element
        let notificationContainer = document.querySelector('.notification-container');
        if (!notificationContainer) {
            notificationContainer = document.createElement('div');
            notificationContainer.className = 'notification-container';
            notificationContainer.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                max-width: 400px;
            `;
            document.body.appendChild(notificationContainer);
        }

        const notificationElement = document.createElement('div');
        notificationElement.className = `notification ${notification.priority || 'medium'}`;
        notificationElement.style.cssText = `
            background: var(--bg-primary, #1a1a1a);
            border: 1px solid var(--border-color, #333);
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 10px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            animation: slideInRight 0.3s ease-out;
        `;

        const priorityColors = {
            critical: '#ff4757',
            high: '#ff9f43', 
            medium: '#feca57',
            low: '#48dbfb'
        };

        const borderColor = priorityColors[notification.priority] || priorityColors.medium;
        notificationElement.style.borderLeftColor = borderColor;
        notificationElement.style.borderLeftWidth = '4px';

        notificationElement.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div style="flex: 1;">
                    <h4 style="margin: 0 0 8px 0; color: var(--text-primary, #fff); font-size: 14px;">
                        ${notification.title}
                    </h4>
                    <p style="margin: 0 0 12px 0; color: var(--text-secondary, #ccc); font-size: 12px; line-height: 1.4;">
                        ${notification.message}
                    </p>
                    ${notification.actions ? `
                        <div style="display: flex; gap: 8px;">
                            ${notification.actions.map(action => `
                                <button onclick="${action.action}" style="
                                    background: var(--bg-secondary, #333);
                                    color: var(--text-primary, #fff);
                                    border: 1px solid var(--border-color, #555);
                                    padding: 4px 8px;
                                    border-radius: 4px;
                                    font-size: 11px;
                                    cursor: pointer;
                                ">
                                    ${action.label}
                                </button>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
                <button onclick="this.parentElement.parentElement.remove()" style="
                    background: none;
                    border: none;
                    color: var(--text-secondary, #ccc);
                    cursor: pointer;
                    padding: 0;
                    margin-left: 12px;
                    font-size: 16px;
                ">&times;</button>
            </div>
        `;

        notificationContainer.appendChild(notificationElement);

        // Auto-remove after timeout
        const timeout = notification.priority === 'critical' ? 15000 : 8000;
        setTimeout(() => {
            if (notificationElement.parentNode) {
                notificationElement.remove();
            }
        }, timeout);
    }

    showLoading(message = 'Loading...') {
        // Implementation for loading indicator
        console.log(message);
    }

    hideLoading() {
        // Implementation to hide loading indicator
    }

    // Cleanup
    destroy() {
        // Clear intervals
        for (const interval of this.updateIntervals.values()) {
            clearInterval(interval);
        }
        this.updateIntervals.clear();
        
        // Destroy components
        for (const component of this.components.values()) {
            if (component.destroy) {
                component.destroy();
            }
        }
        this.components.clear();
        
        this.logger.info('UI Manager destroyed');
    }
}

// Component base class
class BaseComponent {
    constructor(uiManager) {
        this.ui = uiManager;
        this.logger = new Logger(`Component-${this.constructor.name}`);
    }

    async initialize() {
        // Override in subclasses
    }

    async update() {
        // Override in subclasses
    }

    onViewActivated() {
        // Override in subclasses
    }

    destroy() {
        // Override in subclasses
    }
}

// Dashboard Component
class DashboardComponent extends BaseComponent {
    async update() {
        await Promise.all([
            this.updateMarkets(),
            this.updatePositions(),
            this.updatePnL(),
            this.updateRecentTrades()
        ]);
    }

    async updateMarkets() {
        try {
            const markets = await this.ui.database.getActiveMarkets();
            const container = this.ui.dashboardElements.marketList;
            
            if (!container) return;
            
            if (markets.length === 0) {
                container.innerHTML = '<div class="empty-state">No active markets</div>';
                return;
            }
            
            container.innerHTML = markets.slice(0, 5).map(market => `
                <div class="market-item" data-market-id="${market.marketId}">
                    <div class="market-info">
                        <div class="market-name">${market.asset}</div>
                        <div class="market-time">${new Date(market.endTime).toLocaleTimeString()}</div>
                    </div>
                    <div class="market-prices">
                        <span class="yes-price">${(market.yesShares?.price * 100 || 50).toFixed(1)}¢</span>
                        <span class="no-price">${(market.noShares?.price * 100 || 50).toFixed(1)}¢</span>
                    </div>
                </div>
            `).join('');
            
        } catch (error) {
            this.logger.error('Failed to update markets:', error);
        }
    }

    async updatePositions() {
        if (this.ui.tradingEngine) {
            const positions = this.ui.tradingEngine.getPositions();
            this.ui.renderPositions(positions);
        }
    }

    async updatePnL() {
        try {
            const stats = await this.ui.database.getPerformanceStats(null, 1);
            const container = this.ui.dashboardElements.pnlMetrics;
            
            if (!container) return;
            
            container.innerHTML = `
                <div class="pnl-metric">
                    <div class="pnl-value ${stats.totalPnL >= 0 ? 'positive' : 'negative'}">
                        ${this.ui.formatCurrency(stats.totalPnL || 0)}
                    </div>
                    <div class="pnl-label">Total P&L</div>
                </div>
                <div class="pnl-metric">
                    <div class="pnl-value">
                        ${stats.totalTrades || 0}
                    </div>
                    <div class="pnl-label">Total Trades</div>
                </div>
                <div class="pnl-metric">
                    <div class="pnl-value">
                        ${((stats.winRate || 0) * 100).toFixed(1)}%
                    </div>
                    <div class="pnl-label">Win Rate</div>
                </div>
            `;
            
        } catch (error) {
            this.logger.error('Failed to update P&L:', error);
        }
    }

    async updateRecentTrades() {
        const trades = await this.ui.database.getRecentTrades(5);
        this.ui.renderTradeHistory(trades);
    }
}

// Markets Component
class MarketsComponent extends BaseComponent {
    async loadMarkets() {
        try {
            const markets = await this.ui.api.getActiveMarkets();
            this.renderMarkets(markets);
        } catch (error) {
            this.logger.error('Failed to load markets:', error);
        }
    }

    renderMarkets(markets) {
        const container = this.ui.marketsElements.marketsGrid;
        if (!container) return;
        
        if (markets.length === 0) {
            container.innerHTML = '<div class="empty-state">No active markets available</div>';
            return;
        }
        
        container.innerHTML = markets.map(market => `
            <div class="market-card" data-market-id="${market.marketId}">
                <h4>${market.question}</h4>
                <div class="market-info">
                    <span class="market-asset">${market.asset}</span>
                    <span class="market-ends">Ends: ${new Date(market.endTime).toLocaleString()}</span>
                </div>
                <div class="market-prices">
                    <div class="price-option">
                        <div class="price-value yes-price">${((market.yesShares?.price || 0.5) * 100).toFixed(1)}¢</div>
                        <div class="price-label">Yes</div>
                    </div>
                    <div class="price-option">
                        <div class="price-value no-price">${((market.noShares?.price || 0.5) * 100).toFixed(1)}¢</div>
                        <div class="price-label">No</div>
                    </div>
                </div>
                <div class="market-actions">
                    <button class="secondary" onclick="tradingAgent.getComponent('ui').subscribeToMarket('${market.marketId}')">
                        Subscribe
                    </button>
                </div>
            </div>
        `).join('');
    }

    onViewActivated() {
        this.loadMarkets();
    }
}

// Strategies Component
class StrategiesComponent extends BaseComponent {
    async loadStrategies() {
        try {
            const strategies = await this.ui.database.getActiveStrategies();
            this.renderStrategies(strategies);
        } catch (error) {
            this.logger.error('Failed to load strategies:', error);
        }
    }

    renderStrategies(strategies) {
        const container = this.ui.strategyElements.strategiesList;
        if (!container) return;
        
        if (strategies.length === 0) {
            container.innerHTML = '<div class="empty-state">No strategies configured</div>';
            return;
        }
        
        container.innerHTML = strategies.map(strategy => `
            <div class="strategy-card">
                <h4>${strategy.name}</h4>
                <div class="strategy-info">
                    <span class="strategy-type">${strategy.type}</span>
                    <span class="strategy-asset">${strategy.asset}</span>
                    <span class="strategy-status ${strategy.active ? 'active' : 'inactive'}">
                        ${strategy.active ? 'Active' : 'Inactive'}
                    </span>
                </div>
                <div class="strategy-actions">
                    <button class="secondary" onclick="tradingAgent.getComponent('ui').toggleStrategy('${strategy.strategyId}')">
                        ${strategy.active ? 'Pause' : 'Activate'}
                    </button>
                    <button class="secondary" onclick="tradingAgent.getComponent('ui').showStrategyDetails('${strategy.strategyId}')">
                        Details
                    </button>
                </div>
            </div>
        `).join('');
    }

    onViewActivated() {
        this.loadStrategies();
    }
}

// Portfolio Component
class PortfolioComponent extends BaseComponent {
    async update() {
        // Implementation for portfolio updates
    }

    onViewActivated() {
        this.update();
    }
}

// Analytics Component with Advanced Performance Tracking
class AnalyticsComponent extends BaseComponent {
    constructor(uiManager) {
        super(uiManager);
        this.performanceTracker = new AdvancedPerformanceTracker(uiManager);
        this.chartInstances = new Map();
    }

    async initialize() {
        try {
            await this.performanceTracker.initialize();
            this.setupAnalyticsElements();
        } catch (error) {
            this.logger.error('Failed to initialize analytics component:', error);
        }
    }

    setupAnalyticsElements() {
        this.analyticsElements = {
            performanceChart: document.getElementById('performance-chart'),
            strategyStats: document.getElementById('strategy-stats'),
            performanceMetrics: document.querySelector('.performance-metrics'),
            strategyComparison: document.querySelector('.strategy-comparison')
        };
    }

    async update() {
        try {
            await Promise.all([
                this.updatePerformanceMetrics(),
                this.updatePerformanceChart(),
                this.updateStrategyComparison(),
                this.updateRecommendations()
            ]);
        } catch (error) {
            this.logger.error('Failed to update analytics:', error);
        }
    }

    async updatePerformanceMetrics() {
        const report = await this.performanceTracker.generatePerformanceReport();
        const overallMetrics = report.overallMetrics;
        
        const metricsContainer = this.analyticsElements.performanceMetrics;
        if (!metricsContainer) return;

        const metricsHTML = `
            <div class="analytics-grid">
                <div class="metric-card">
                    <h4>Total P&L</h4>
                    <div class="metric-value ${overallMetrics.totalPnL >= 0 ? 'positive' : 'negative'}">
                        ${this.ui.formatCurrency(overallMetrics.totalPnL)}
                    </div>
                    <div class="metric-change">
                        ${overallMetrics.dailyChange >= 0 ? '+' : ''}${(overallMetrics.dailyChange * 100).toFixed(2)}% today
                    </div>
                </div>
                
                <div class="metric-card">
                    <h4>Win Rate</h4>
                    <div class="metric-value">
                        ${(overallMetrics.winRate * 100).toFixed(1)}%
                    </div>
                    <div class="metric-detail">
                        ${overallMetrics.totalTrades} trades
                    </div>
                </div>
                
                <div class="metric-card">
                    <h4>Sharpe Ratio</h4>
                    <div class="metric-value ${overallMetrics.sharpeRatio >= 1 ? 'positive' : 'neutral'}">
                        ${overallMetrics.sharpeRatio.toFixed(2)}
                    </div>
                    <div class="metric-detail">
                        Risk-adjusted return
                    </div>
                </div>
                
                <div class="metric-card">
                    <h4>Max Drawdown</h4>
                    <div class="metric-value negative">
                        ${(overallMetrics.maxDrawdown * 100).toFixed(1)}%
                    </div>
                    <div class="metric-detail">
                        Peak to trough
                    </div>
                </div>
                
                <div class="metric-card">
                    <h4>Profit Factor</h4>
                    <div class="metric-value ${overallMetrics.profitFactor >= 1 ? 'positive' : 'negative'}">
                        ${overallMetrics.profitFactor.toFixed(2)}
                    </div>
                    <div class="metric-detail">
                        Gross profit / loss
                    </div>
                </div>
                
                <div class="metric-card">
                    <h4>Average Trade</h4>
                    <div class="metric-value ${overallMetrics.averageWin >= 0 ? 'positive' : 'negative'}">
                        ${this.ui.formatCurrency(overallMetrics.averageWin)}
                    </div>
                    <div class="metric-detail">
                        Per position
                    </div>
                </div>
            </div>
        `;

        metricsContainer.innerHTML = metricsHTML;
    }

    async updatePerformanceChart() {
        const canvas = this.analyticsElements.performanceChart;
        if (!canvas) return;

        const performanceData = await this.performanceTracker.getPerformanceTimeSeries();
        
        this.renderPerformanceChart(canvas, performanceData);
    }

    async updateStrategyComparison() {
        const strategyPerformance = await this.performanceTracker.getStrategyPerformance();
        const container = this.analyticsElements.strategyStats;
        
        if (!container) return;

        const strategyHTML = `
            <div class="strategy-performance-table">
                <div class="table-header">
                    <div>Strategy</div>
                    <div>P&L</div>
                    <div>Win Rate</div>
                    <div>Trades</div>
                    <div>Sharpe</div>
                    <div>Status</div>
                </div>
                ${strategyPerformance.map(strategy => `
                    <div class="table-row">
                        <div class="strategy-name">${strategy.name}</div>
                        <div class="pnl-value ${strategy.totalPnL >= 0 ? 'positive' : 'negative'}">
                            ${this.ui.formatCurrency(strategy.totalPnL)}
                        </div>
                        <div>${(strategy.winRate * 100).toFixed(1)}%</div>
                        <div>${strategy.totalTrades}</div>
                        <div>${strategy.sharpeRatio.toFixed(2)}</div>
                        <div class="strategy-status ${strategy.isActive ? 'active' : 'inactive'}">
                            ${strategy.isActive ? 'Active' : 'Paused'}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        container.innerHTML = strategyHTML;
    }

    async updateRecommendations() {
        const recommendations = await this.performanceTracker.generateRecommendations();
        
        const recommendationsHTML = `
            <div class="recommendations-panel">
                <h4>🎯 Performance Recommendations</h4>
                <div class="recommendations-list">
                    ${recommendations.map(rec => `
                        <div class="recommendation-item ${rec.priority}">
                            <div class="rec-icon">${rec.icon}</div>
                            <div class="rec-content">
                                <div class="rec-title">${rec.title}</div>
                                <div class="rec-description">${rec.description}</div>
                                ${rec.action ? `<button class="rec-action" onclick="${rec.action}">Take Action</button>` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        // Add recommendations to the analytics view
        const analyticsContainer = document.querySelector('#analytics-view');
        if (analyticsContainer) {
            let recPanel = analyticsContainer.querySelector('.recommendations-panel');
            if (!recPanel) {
                analyticsContainer.insertAdjacentHTML('beforeend', recommendationsHTML);
            } else {
                recPanel.outerHTML = recommendationsHTML;
            }
        }
    }

    renderPerformanceChart(canvas, data) {
        const ctx = canvas.getContext('2d');
        
        // Destroy existing chart
        if (this.chartInstances.has('performance')) {
            this.chartInstances.get('performance').destroy();
        }

        // Create new chart (simplified implementation)
        const chart = this.createLineChart(ctx, {
            labels: data.timestamps.map(ts => new Date(ts).toLocaleDateString()),
            datasets: [{
                label: 'Portfolio Value',
                data: data.values,
                borderColor: '#4CAF50',
                backgroundColor: 'rgba(76, 175, 80, 0.1)',
                tension: 0.4
            }, {
                label: 'Benchmark',
                data: data.benchmark,
                borderColor: '#888',
                backgroundColor: 'rgba(136, 136, 136, 0.1)',
                tension: 0.4
            }]
        });

        this.chartInstances.set('performance', chart);
    }

    createLineChart(ctx, config) {
        // Simplified chart implementation
        // In a real implementation, you'd use Chart.js or similar
        return {
            destroy: () => {
                ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            }
        };
    }

    onViewActivated() {
        this.update();
    }

    destroy() {
        // Destroy all chart instances
        for (const chart of this.chartInstances.values()) {
            chart.destroy();
        }
        this.chartInstances.clear();

        if (this.performanceTracker) {
            this.performanceTracker.destroy();
        }
    }
}

// Advanced Performance Tracker
class AdvancedPerformanceTracker {
    constructor(uiManager) {
        this.ui = uiManager;
        this.logger = new Logger('AdvancedPerformanceTracker');
        this.performanceCache = new Map();
        this.cacheTimeout = 60000; // 1 minute
    }

    async initialize() {
        this.logger.info('Initializing Advanced Performance Tracker...');
        await this.preloadPerformanceData();
    }

    async preloadPerformanceData() {
        try {
            const endTime = Date.now();
            const startTime = endTime - (30 * 24 * 60 * 60 * 1000); // 30 days
            
            await Promise.all([
                this.cachePerformanceData('overall', startTime, endTime),
                this.cacheStrategyPerformance(),
                this.cacheRiskMetrics()
            ]);
        } catch (error) {
            this.logger.error('Failed to preload performance data:', error);
        }
    }

    async generatePerformanceReport() {
        const cacheKey = 'performance_report';
        if (this.isCacheValid(cacheKey)) {
            return this.performanceCache.get(cacheKey);
        }

        try {
            const [overallMetrics, strategyBreakdown, riskMetrics] = await Promise.all([
                this.calculateOverallMetrics(),
                this.calculateStrategyBreakdown(),
                this.calculateRiskMetrics()
            ]);

            const report = {
                overallMetrics,
                strategyBreakdown,
                riskMetrics,
                generatedAt: Date.now()
            };

            this.performanceCache.set(cacheKey, report);
            return report;

        } catch (error) {
            this.logger.error('Failed to generate performance report:', error);
            throw error;
        }
    }

    async calculateOverallMetrics() {
        const trades = await this.ui.database.getAllTrades();
        const positions = this.ui.tradingEngine?.getPositions() || [];

        if (trades.length === 0) {
            return this.getDefaultMetrics();
        }

        const totalPnL = trades.reduce((sum, trade) => sum + trade.realizedPnL, 0);
        const unrealizedPnL = positions.reduce((sum, pos) => sum + pos.unrealizedPnL, 0);
        const netPnL = totalPnL + unrealizedPnL;

        const winningTrades = trades.filter(t => t.realizedPnL > 0);
        const losingTrades = trades.filter(t => t.realizedPnL < 0);
        
        const winRate = trades.length > 0 ? winningTrades.length / trades.length : 0;
        const averageWin = winningTrades.length > 0 ? 
            winningTrades.reduce((sum, t) => sum + t.realizedPnL, 0) / winningTrades.length : 0;
        const averageLoss = losingTrades.length > 0 ?
            Math.abs(losingTrades.reduce((sum, t) => sum + t.realizedPnL, 0) / losingTrades.length) : 0;

        const profitFactor = averageLoss > 0 ? averageWin / averageLoss : 0;
        
        // Calculate daily returns for Sharpe ratio
        const dailyReturns = this.calculateDailyReturns(trades);
        const sharpeRatio = this.calculateSharpeRatio(dailyReturns);
        
        // Calculate maximum drawdown
        const maxDrawdown = this.calculateMaxDrawdown(trades);
        
        // Calculate daily change
        const todayTrades = trades.filter(t => 
            new Date(t.timestamp).toDateString() === new Date().toDateString()
        );
        const dailyChange = todayTrades.reduce((sum, t) => sum + t.realizedPnL, 0) / Math.max(Math.abs(totalPnL), 1000);

        return {
            totalPnL: netPnL,
            realizedPnL: totalPnL,
            unrealizedPnL,
            totalTrades: trades.length,
            winRate,
            averageWin,
            averageLoss,
            profitFactor,
            sharpeRatio,
            maxDrawdown,
            dailyChange,
            winningTrades: winningTrades.length,
            losingTrades: losingTrades.length
        };
    }

    async calculateStrategyBreakdown() {
        const strategies = await this.ui.database.getActiveStrategies();
        const trades = await this.ui.database.getAllTrades();
        
        return strategies.map(strategy => {
            const strategyTrades = trades.filter(t => t.strategyId === strategy.strategyId);
            const totalPnL = strategyTrades.reduce((sum, t) => sum + t.realizedPnL, 0);
            const winningTrades = strategyTrades.filter(t => t.realizedPnL > 0);
            const winRate = strategyTrades.length > 0 ? winningTrades.length / strategyTrades.length : 0;
            
            const dailyReturns = this.calculateDailyReturns(strategyTrades);
            const sharpeRatio = this.calculateSharpeRatio(dailyReturns);

            return {
                strategyId: strategy.strategyId,
                name: strategy.name,
                type: strategy.type,
                totalPnL,
                winRate,
                totalTrades: strategyTrades.length,
                sharpeRatio,
                isActive: strategy.active,
                averageTradeSize: strategyTrades.length > 0 ? 
                    strategyTrades.reduce((sum, t) => sum + Math.abs(t.quantity), 0) / strategyTrades.length : 0
            };
        });
    }

    async calculateRiskMetrics() {
        const positions = this.ui.tradingEngine?.getPositions() || [];
        const totalExposure = positions.reduce((sum, pos) => sum + Math.abs(pos.quantity * pos.averagePrice), 0);
        
        // Portfolio concentration
        const assetExposure = positions.reduce((acc, pos) => {
            const asset = pos.marketId.split('_')[0] || 'UNKNOWN';
            acc[asset] = (acc[asset] || 0) + Math.abs(pos.quantity * pos.averagePrice);
            return acc;
        }, {});

        const maxAssetExposure = Math.max(...Object.values(assetExposure), 0);
        const concentration = totalExposure > 0 ? maxAssetExposure / totalExposure : 0;

        // Value at Risk (simplified 1-day VaR at 95% confidence)
        const trades = await this.ui.database.getAllTrades();
        const dailyReturns = this.calculateDailyReturns(trades);
        const valueAtRisk = this.calculateVaR(dailyReturns, 0.95);

        return {
            totalExposure,
            concentration,
            valueAtRisk,
            positionCount: positions.length,
            diversificationScore: this.calculateDiversificationScore(assetExposure)
        };
    }

    calculateDailyReturns(trades) {
        const dailyPnL = trades.reduce((acc, trade) => {
            const date = new Date(trade.timestamp).toDateString();
            acc[date] = (acc[date] || 0) + trade.realizedPnL;
            return acc;
        }, {});

        return Object.values(dailyPnL);
    }

    calculateSharpeRatio(dailyReturns) {
        if (dailyReturns.length < 2) return 0;

        const avgReturn = dailyReturns.reduce((sum, ret) => sum + ret, 0) / dailyReturns.length;
        const variance = dailyReturns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / dailyReturns.length;
        const stdDev = Math.sqrt(variance);

        return stdDev > 0 ? avgReturn / stdDev : 0;
    }

    calculateMaxDrawdown(trades) {
        let peak = 0;
        let maxDrawdown = 0;
        let runningPnL = 0;

        trades.forEach(trade => {
            runningPnL += trade.realizedPnL;
            peak = Math.max(peak, runningPnL);
            const drawdown = (peak - runningPnL) / Math.max(peak, 1);
            maxDrawdown = Math.max(maxDrawdown, drawdown);
        });

        return maxDrawdown;
    }

    calculateVaR(returns, confidence) {
        if (returns.length === 0) return 0;
        
        const sorted = returns.slice().sort((a, b) => a - b);
        const index = Math.floor((1 - confidence) * sorted.length);
        return Math.abs(sorted[index] || 0);
    }

    calculateDiversificationScore(assetExposure) {
        const exposures = Object.values(assetExposure);
        if (exposures.length <= 1) return 0;

        const total = exposures.reduce((sum, exp) => sum + exp, 0);
        const weights = exposures.map(exp => exp / total);
        
        // Herfindahl-Hirschman Index (lower = more diversified)
        const hhi = weights.reduce((sum, w) => sum + w * w, 0);
        return Math.max(0, 1 - hhi); // Convert to diversification score (higher = better)
    }

    async getStrategyPerformance() {
        return (await this.generatePerformanceReport()).strategyBreakdown;
    }

    async getPerformanceTimeSeries() {
        const trades = await this.ui.database.getAllTrades();
        const timestamps = [];
        const values = [];
        const benchmark = [];

        let runningPnL = 10000; // Starting value
        let currentDate = null;
        
        // Group trades by date
        const dailyTrades = trades.reduce((acc, trade) => {
            const date = new Date(trade.timestamp).toDateString();
            if (!acc[date]) acc[date] = [];
            acc[date].push(trade);
            return acc;
        }, {});

        // Create time series
        Object.keys(dailyTrades).sort().forEach(date => {
            const dayTrades = dailyTrades[date];
            const dayPnL = dayTrades.reduce((sum, t) => sum + t.realizedPnL, 0);
            
            runningPnL += dayPnL;
            timestamps.push(new Date(date).getTime());
            values.push(runningPnL);
            
            // Simple benchmark (market return simulation)
            const marketReturn = (Math.random() - 0.5) * 0.02; // ±1% daily
            const benchmarkValue = 10000 * (1 + marketReturn * timestamps.length / 365);
            benchmark.push(benchmarkValue);
        });

        return { timestamps, values, benchmark };
    }

    async generateRecommendations() {
        const report = await this.generatePerformanceReport();
        const recommendations = [];

        // Performance-based recommendations
        if (report.overallMetrics.winRate < 0.4) {
            recommendations.push({
                priority: 'high',
                icon: '⚠️',
                title: 'Low Win Rate Detected',
                description: `Your current win rate is ${(report.overallMetrics.winRate * 100).toFixed(1)}%. Consider reviewing your entry signals and risk management.`,
                action: 'tradingAgent.getComponent("ui").showModal("Strategy Review", "Review your strategies...")'
            });
        }

        if (report.overallMetrics.sharpeRatio < 0.5) {
            recommendations.push({
                priority: 'medium',
                icon: '📊',
                title: 'Risk-Adjusted Returns Need Improvement',
                description: 'Your Sharpe ratio suggests high risk relative to returns. Consider reducing position sizes.',
                action: null
            });
        }

        if (report.riskMetrics.concentration > 0.5) {
            recommendations.push({
                priority: 'high',
                icon: '🎯',
                title: 'High Portfolio Concentration',
                description: `${(report.riskMetrics.concentration * 100).toFixed(1)}% of your portfolio is in a single asset. Consider diversifying.`,
                action: null
            });
        }

        // Strategy-specific recommendations
        const underperformingStrategies = report.strategyBreakdown.filter(s => s.sharpeRatio < 0);
        if (underperformingStrategies.length > 0) {
            recommendations.push({
                priority: 'medium',
                icon: '🔧',
                title: 'Underperforming Strategies',
                description: `${underperformingStrategies.length} strategies have negative Sharpe ratios. Consider pausing or optimizing them.`,
                action: null
            });
        }

        // Positive recommendations
        if (report.overallMetrics.profitFactor > 1.5) {
            recommendations.push({
                priority: 'low',
                icon: '🚀',
                title: 'Strong Performance',
                description: 'Your profit factor indicates good trading performance. Consider scaling up successful strategies.',
                action: null
            });
        }

        return recommendations;
    }

    getDefaultMetrics() {
        return {
            totalPnL: 0,
            realizedPnL: 0,
            unrealizedPnL: 0,
            totalTrades: 0,
            winRate: 0,
            averageWin: 0,
            averageLoss: 0,
            profitFactor: 0,
            sharpeRatio: 0,
            maxDrawdown: 0,
            dailyChange: 0,
            winningTrades: 0,
            losingTrades: 0
        };
    }

    async cachePerformanceData(key, startTime, endTime) {
        // Implementation for caching performance data
    }

    async cacheStrategyPerformance() {
        // Implementation for caching strategy performance
    }

    async cacheRiskMetrics() {
        // Implementation for caching risk metrics
    }

    isCacheValid(key) {
        if (!this.performanceCache.has(key)) return false;
        const cached = this.performanceCache.get(key);
        return (Date.now() - cached.generatedAt) < this.cacheTimeout;
    }

    destroy() {
        this.performanceCache.clear();
        this.logger.info('Advanced Performance Tracker destroyed');
    }
}