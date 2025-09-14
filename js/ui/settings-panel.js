import { Logger } from '../utils/logger.js';
import { ProductionConfig } from '../config/production-config.js';

export class SettingsPanel {
    constructor() {
        this.logger = new Logger('SettingsPanel');
        this.isVisible = false;
        
        // Current configuration state
        this.currentConfig = { ...ProductionConfig };
        
        this.createPanel();
        this.setupEventListeners();
    }

    createPanel() {
        // Create settings panel HTML
        const settingsHTML = `
            <div id="settings-panel" class="settings-panel hidden">
                <div class="settings-content">
                    <div class="settings-header">
                        <h3>🔧 Trading Agent Configuration</h3>
                        <button id="close-settings" class="close-btn">×</button>
                    </div>
                    
                    <div class="settings-body">
                        <div class="config-section">
                            <h4>Trading Mode</h4>
                            <label class="config-item">
                                <input type="checkbox" id="demo-mode" ${this.currentConfig.FEATURES.DEMO_MODE ? 'checked' : ''}>
                                <span>Demo Mode (Safe - No Real Trading)</span>
                            </label>
                            <label class="config-item">
                                <input type="checkbox" id="enable-trading" ${this.currentConfig.FEATURES.ENABLE_TRADING ? 'checked' : ''}>
                                <span>Enable Real Trading ⚠️</span>
                            </label>
                            <label class="config-item">
                                <input type="checkbox" id="testnet-mode" ${this.currentConfig.FEATURES.TESTNET_MODE ? 'checked' : ''}>
                                <span>Testnet Mode (Polygon Mumbai)</span>
                            </label>
                        </div>

                        <div class="config-section">
                            <h4>Strategy & Risk</h4>
                            <label class="config-item">
                                <input type="checkbox" id="enable-strategies" ${this.currentConfig.FEATURES.ENABLE_STRATEGIES ? 'checked' : ''}>
                                <span>Enable Trading Strategies</span>
                            </label>
                            <label class="config-item">
                                <input type="checkbox" id="risk-management" ${this.currentConfig.FEATURES.ENABLE_RISK_MANAGEMENT ? 'checked' : ''}>
                                <span>Enable Risk Management</span>
                            </label>
                        </div>

                        <div class="config-section">
                            <h4>Trading Limits</h4>
                            <label class="config-item">
                                <span>Max Position Size (USDC)</span>
                                <input type="number" id="max-position" value="${this.currentConfig.TRADING_LIMITS.MAX_POSITION_SIZE}" min="1" max="10000">
                            </label>
                            <label class="config-item">
                                <span>Daily Loss Limit (%)</span>
                                <input type="number" id="daily-loss" value="${this.currentConfig.TRADING_LIMITS.DAILY_LOSS_LIMIT * 100}" min="1" max="50" step="0.1">
                            </label>
                            <label class="config-item">
                                <span>Max Open Orders</span>
                                <input type="number" id="max-orders" value="${this.currentConfig.TRADING_LIMITS.MAX_OPEN_ORDERS}" min="1" max="100">
                            </label>
                        </div>

                        <div class="config-section">
                            <h4>Development</h4>
                            <label class="config-item">
                                <input type="checkbox" id="debug-mode" ${this.currentConfig.FEATURES.DEBUG_MODE ? 'checked' : ''}>
                                <span>Debug Mode</span>
                            </label>
                            <label class="config-item">
                                <input type="checkbox" id="verbose-logging" ${this.currentConfig.FEATURES.VERBOSE_LOGGING ? 'checked' : ''}>
                                <span>Verbose Logging</span>
                            </label>
                        </div>

                        <div class="config-actions">
                            <button id="save-config" class="btn-primary">💾 Save Configuration</button>
                            <button id="reset-config" class="btn-secondary">🔄 Reset to Defaults</button>
                            <button id="export-config" class="btn-secondary">📤 Export Config</button>
                        </div>

                        <div class="config-warning">
                            <p>⚠️ <strong>Warning:</strong> Enabling real trading will use actual USDC on Polygon network. Always test on testnet first!</p>
                        </div>
                    </div>
                </div>
            </div>

            <style>
                .settings-panel {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.5);
                    z-index: 10000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .settings-panel.hidden {
                    display: none;
                }

                .settings-content {
                    background: white;
                    border-radius: 12px;
                    max-width: 600px;
                    width: 90%;
                    max-height: 80vh;
                    overflow-y: auto;
                    box-shadow: 0 25px 50px rgba(0, 0, 0, 0.25);
                }

                .settings-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1.5rem 2rem 0;
                    border-bottom: 1px solid #e5e7eb;
                }

                .settings-header h3 {
                    margin: 0;
                    color: #1f2937;
                }

                .close-btn {
                    background: none;
                    border: none;
                    font-size: 1.5rem;
                    cursor: pointer;
                    color: #6b7280;
                    padding: 0;
                    width: 2rem;
                    height: 2rem;
                }

                .settings-body {
                    padding: 1.5rem 2rem 2rem;
                }

                .config-section {
                    margin-bottom: 2rem;
                }

                .config-section h4 {
                    margin: 0 0 1rem 0;
                    color: #374151;
                    font-size: 1.1rem;
                }

                .config-item {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 0.75rem;
                    padding: 0.5rem;
                    border-radius: 6px;
                    transition: background-color 0.2s;
                }

                .config-item:hover {
                    background: #f9fafb;
                }

                .config-item input[type="checkbox"] {
                    margin-right: 0.75rem;
                }

                .config-item input[type="number"] {
                    width: 100px;
                    padding: 0.25rem 0.5rem;
                    border: 1px solid #d1d5db;
                    border-radius: 4px;
                    margin-left: 1rem;
                }

                .config-actions {
                    display: flex;
                    gap: 1rem;
                    margin: 2rem 0 1rem 0;
                    flex-wrap: wrap;
                }

                .config-actions button {
                    flex: 1;
                    min-width: 120px;
                }

                .btn-primary {
                    background: #10b981;
                    color: white;
                    border: none;
                    padding: 0.75rem 1rem;
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: 500;
                }

                .btn-secondary {
                    background: #f3f4f6;
                    color: #374151;
                    border: 1px solid #d1d5db;
                    padding: 0.75rem 1rem;
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: 500;
                }

                .config-warning {
                    background: rgba(239, 68, 68, 0.1);
                    border: 1px solid #ef4444;
                    border-radius: 6px;
                    padding: 1rem;
                    margin-top: 1rem;
                }

                .config-warning p {
                    margin: 0;
                    color: #dc2626;
                    font-size: 0.875rem;
                }
            </style>
        `;

        // Add to page
        document.body.insertAdjacentHTML('beforeend', settingsHTML);
    }

    setupEventListeners() {
        // Show/hide panel
        document.getElementById('close-settings')?.addEventListener('click', () => this.hide());
        
        // Click outside to close
        document.getElementById('settings-panel')?.addEventListener('click', (e) => {
            if (e.target.id === 'settings-panel') this.hide();
        });

        // Save configuration
        document.getElementById('save-config')?.addEventListener('click', () => this.saveConfiguration());
        
        // Reset configuration
        document.getElementById('reset-config')?.addEventListener('click', () => this.resetConfiguration());
        
        // Export configuration
        document.getElementById('export-config')?.addEventListener('click', () => this.exportConfiguration());

        // Demo mode toggle - disable trading when demo is enabled
        document.getElementById('demo-mode')?.addEventListener('change', (e) => {
            const tradingCheckbox = document.getElementById('enable-trading');
            if (e.target.checked && tradingCheckbox) {
                tradingCheckbox.checked = false;
                tradingCheckbox.disabled = true;
            } else if (tradingCheckbox) {
                tradingCheckbox.disabled = false;
            }
        });
    }

    show() {
        const panel = document.getElementById('settings-panel');
        if (panel) {
            panel.classList.remove('hidden');
            this.isVisible = true;
            this.updateFormValues();
        }
    }

    hide() {
        const panel = document.getElementById('settings-panel');
        if (panel) {
            panel.classList.add('hidden');
            this.isVisible = false;
        }
    }

    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    updateFormValues() {
        // Update form with current configuration
        const config = this.currentConfig;
        
        document.getElementById('demo-mode').checked = config.FEATURES.DEMO_MODE;
        document.getElementById('enable-trading').checked = config.FEATURES.ENABLE_TRADING;
        document.getElementById('testnet-mode').checked = config.FEATURES.TESTNET_MODE;
        document.getElementById('enable-strategies').checked = config.FEATURES.ENABLE_STRATEGIES;
        document.getElementById('risk-management').checked = config.FEATURES.ENABLE_RISK_MANAGEMENT;
        document.getElementById('debug-mode').checked = config.FEATURES.DEBUG_MODE;
        document.getElementById('verbose-logging').checked = config.FEATURES.VERBOSE_LOGGING;
        
        document.getElementById('max-position').value = config.TRADING_LIMITS.MAX_POSITION_SIZE;
        document.getElementById('daily-loss').value = config.TRADING_LIMITS.DAILY_LOSS_LIMIT * 100;
        document.getElementById('max-orders').value = config.TRADING_LIMITS.MAX_OPEN_ORDERS;
    }

    saveConfiguration() {
        try {
            // Collect form values
            const newConfig = {
                FEATURES: {
                    DEMO_MODE: document.getElementById('demo-mode').checked,
                    ENABLE_TRADING: document.getElementById('enable-trading').checked,
                    TESTNET_MODE: document.getElementById('testnet-mode').checked,
                    ENABLE_STRATEGIES: document.getElementById('enable-strategies').checked,
                    ENABLE_RISK_MANAGEMENT: document.getElementById('risk-management').checked,
                    DEBUG_MODE: document.getElementById('debug-mode').checked,
                    VERBOSE_LOGGING: document.getElementById('verbose-logging').checked
                },
                TRADING_LIMITS: {
                    MAX_POSITION_SIZE: parseFloat(document.getElementById('max-position').value),
                    DAILY_LOSS_LIMIT: parseFloat(document.getElementById('daily-loss').value) / 100,
                    MAX_OPEN_ORDERS: parseInt(document.getElementById('max-orders').value)
                }
            };

            // Validation
            if (newConfig.FEATURES.ENABLE_TRADING && newConfig.FEATURES.DEMO_MODE) {
                alert('Cannot enable trading while in demo mode!');
                return;
            }

            // Save to localStorage
            localStorage.setItem('tradingAgentConfig', JSON.stringify(newConfig));
            
            // Update current config
            Object.assign(this.currentConfig.FEATURES, newConfig.FEATURES);
            Object.assign(this.currentConfig.TRADING_LIMITS, newConfig.TRADING_LIMITS);

            this.logger.info('Configuration saved successfully');
            alert('Configuration saved! Refresh the page to apply changes.');
            
        } catch (error) {
            this.logger.error('Failed to save configuration:', error);
            alert('Failed to save configuration: ' + error.message);
        }
    }

    resetConfiguration() {
        if (confirm('Reset all settings to default values?')) {
            localStorage.removeItem('tradingAgentConfig');
            this.currentConfig = { ...ProductionConfig };
            this.updateFormValues();
            this.logger.info('Configuration reset to defaults');
            alert('Configuration reset! Refresh the page to apply changes.');
        }
    }

    exportConfiguration() {
        try {
            const config = JSON.parse(localStorage.getItem('tradingAgentConfig') || '{}');
            const dataStr = JSON.stringify(config, null, 2);
            const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
            
            const exportFileDefaultName = 'trading-agent-config.json';
            
            const linkElement = document.createElement('a');
            linkElement.setAttribute('href', dataUri);
            linkElement.setAttribute('download', exportFileDefaultName);
            linkElement.click();
            
            this.logger.info('Configuration exported successfully');
            
        } catch (error) {
            this.logger.error('Failed to export configuration:', error);
            alert('Failed to export configuration: ' + error.message);
        }
    }
}