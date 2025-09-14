// Configuration Override System
// This allows runtime configuration changes without editing the main config file

export class ConfigOverride {
    static getConfig() {
        // Start with base production config
        const config = { ...window.ProductionConfig };
        
        // Override based on URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        
        if (urlParams.get('demo') === 'true') {
            config.FEATURES.DEMO_MODE = true;
            config.FEATURES.ENABLE_TRADING = false;
        }
        
        if (urlParams.get('testnet') === 'false') {
            config.FEATURES.TESTNET_MODE = false;
        }
        
        if (urlParams.get('trading') === 'true') {
            config.FEATURES.ENABLE_TRADING = true;
        }
        
        // Override based on localStorage
        const storedConfig = localStorage.getItem('tradingAgentConfig');
        if (storedConfig) {
            try {
                const userConfig = JSON.parse(storedConfig);
                Object.assign(config.FEATURES, userConfig.FEATURES || {});
                Object.assign(config.TRADING_LIMITS, userConfig.TRADING_LIMITS || {});
            } catch (error) {
                console.warn('Invalid stored configuration:', error);
            }
        }
        
        // Override based on environment detection
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            // Development environment - enable debug features
            config.FEATURES.DEBUG_MODE = true;
            config.FEATURES.VERBOSE_LOGGING = true;
            config.DEV_CONFIG.ENABLE_DEBUG_PANEL = true;
        }
        
        return config;
    }
    
    static saveUserConfig(configUpdate) {
        try {
            localStorage.setItem('tradingAgentConfig', JSON.stringify(configUpdate));
            console.log('Configuration saved:', configUpdate);
        } catch (error) {
            console.error('Failed to save configuration:', error);
        }
    }
    
    static resetConfig() {
        localStorage.removeItem('tradingAgentConfig');
        console.log('Configuration reset to defaults');
    }
}

// Make available globally
window.ConfigOverride = ConfigOverride;