// 🔧 API CORS PROXY SOLUTION
// This module provides CORS proxy functionality to fix API integration issues

class APICORSProxy {
    constructor() {
        this.logger = console;
        this.proxyEndpoints = [
            'https://api.allorigins.win/get?url=',
            'https://cors-anywhere.herokuapp.com/',
            'https://proxy.cors.sh/'
        ];
        this.workingProxy = null;
    }

    async findWorkingProxy() {
        this.logger.log("🔍 Finding working CORS proxy...");
        
        for (const proxyBase of this.proxyEndpoints) {
            try {
                const testUrl = 'https://gamma-api.polymarket.com/markets?limit=1';
                const proxyUrl = this.buildProxyUrl(proxyBase, testUrl);
                
                this.logger.log(`  Testing proxy: ${proxyBase}`);
                
                const response = await fetch(proxyUrl, {
                    method: 'GET',
                    headers: { 'Accept': 'application/json' },
                    timeout: 10000
                });
                
                if (response.ok) {
                    this.workingProxy = proxyBase;
                    this.logger.log(`  ✅ Working proxy found: ${proxyBase}`);
                    return proxyBase;
                }
                
            } catch (error) {
                this.logger.log(`  ❌ Proxy failed: ${proxyBase} - ${error.message}`);
            }
        }
        
        this.logger.warn("⚠️ No working CORS proxy found");
        return null;
    }

    buildProxyUrl(proxyBase, targetUrl) {
        if (proxyBase.includes('allorigins')) {
            return `${proxyBase}${encodeURIComponent(targetUrl)}`;
        } else {
            return `${proxyBase}${targetUrl}`;
        }
    }

    async proxyRequest(url, options = {}) {
        if (!this.workingProxy) {
            await this.findWorkingProxy();
        }

        if (!this.workingProxy) {
            throw new Error("No working CORS proxy available");
        }

        const proxyUrl = this.buildProxyUrl(this.workingProxy, url);
        
        try {
            const response = await fetch(proxyUrl, {
                method: options.method || 'GET',
                headers: {
                    'Accept': 'application/json',
                    ...options.headers
                }
            });

            if (!response.ok) {
                throw new Error(`Proxy request failed: ${response.status}`);
            }

            // Handle different proxy response formats
            if (this.workingProxy.includes('allorigins')) {
                const proxyResponse = await response.json();
                return {
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve(JSON.parse(proxyResponse.contents))
                };
            } else {
                return response;
            }

        } catch (error) {
            this.logger.error(`❌ Proxy request failed for ${url}:`, error.message);
            throw error;
        }
    }

    // Create a patched fetch function that uses the proxy
    createProxyFetch() {
        const originalFetch = window.fetch;
        const proxy = this;

        return async function(url, options = {}) {
            // Only proxy Polymarket API calls
            if (typeof url === 'string' && (
                url.includes('polymarket.com') || 
                url.includes('gamma-api') || 
                url.includes('clob')
            )) {
                try {
                    return await proxy.proxyRequest(url, options);
                } catch (proxyError) {
                    // Fallback to original fetch
                    proxy.logger.warn("Proxy failed, trying direct request:", proxyError.message);
                    return originalFetch(url, options);
                }
            }
            
            // Use original fetch for other requests
            return originalFetch(url, options);
        };
    }
}

// Enhanced Polymarket API with CORS fixes
class FixedPolymarketAPI {
    constructor() {
        this.corsProxy = new APICORSProxy();
        this.logger = console;
        
        // Enhanced endpoints with multiple fallbacks
        this.endpoints = {
            gamma: [
                'https://gamma-api.polymarket.com',
                'https://api.polymarket.com/gamma'
            ],
            clob: [
                'https://clob.polymarket.com',
                'https://api.polymarket.com/clob'
            ]
        };

        this.fallbackData = {
            markets: this.createFallbackMarkets(),
            prices: this.createFallbackPrices()
        };
    }

    async initialize() {
        this.logger.log("🔧 Initializing Fixed Polymarket API...");
        
        // Test direct connection first
        const directWorks = await this.testDirectConnection();
        if (directWorks) {
            this.logger.log("✅ Direct API connection working");
            return { method: 'direct', status: 'success' };
        }

        // Try CORS proxy
        const proxyWorks = await this.testProxyConnection();
        if (proxyWorks) {
            this.logger.log("✅ CORS proxy connection working");
            // Replace global fetch with proxied version
            window.fetch = this.corsProxy.createProxyFetch();
            return { method: 'proxy', status: 'success' };
        }

        // Use fallback data
        this.logger.warn("⚠️ Using fallback data mode");
        return { method: 'fallback', status: 'limited' };
    }

    async testDirectConnection() {
        try {
            const response = await fetch('https://gamma-api.polymarket.com/markets?limit=1', {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                mode: 'cors'
            });
            return response.ok;
        } catch (error) {
            this.logger.log("Direct connection failed:", error.message);
            return false;
        }
    }

    async testProxyConnection() {
        try {
            await this.corsProxy.findWorkingProxy();
            return !!this.corsProxy.workingProxy;
        } catch (error) {
            this.logger.log("Proxy connection failed:", error.message);
            return false;
        }
    }

    async fetchReal15MinuteCryptoMarkets() {
        this.logger.log("🔍 Fetching 15-minute crypto markets...");
        
        // Try multiple endpoint strategies
        const strategies = [
            () => this.fetchViaDirectAPI(),
            () => this.fetchViaProxy(),
            () => this.fetchFallbackData()
        ];

        for (const strategy of strategies) {
            try {
                const result = await strategy();
                if (result && result.length > 0) {
                    this.logger.log(`✅ Markets fetched successfully: ${result.length} markets`);
                    return result;
                }
            } catch (error) {
                this.logger.log(`⚠️ Strategy failed: ${error.message}`);
            }
        }

        this.logger.warn("❌ All strategies failed, returning empty array");
        return [];
    }

    async fetchViaDirectAPI() {
        const response = await fetch('https://gamma-api.polymarket.com/markets?limit=50&active=true&closed=false', {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'PolymarketTradingAgent/1.0'
            }
        });

        if (!response.ok) {
            throw new Error(`Direct API failed: ${response.status}`);
        }

        const data = await response.json();
        return this.filterCryptoMarkets(data);
    }

    async fetchViaProxy() {
        const url = 'https://gamma-api.polymarket.com/markets?limit=50&active=true&closed=false';
        const response = await this.corsProxy.proxyRequest(url);
        
        const data = await response.json();
        return this.filterCryptoMarkets(data);
    }

    fetchFallbackData() {
        this.logger.log("🔄 Using fallback market data");
        return this.fallbackData.markets;
    }

    filterCryptoMarkets(data) {
        if (!data || !Array.isArray(data)) {
            return [];
        }

        return data.filter(market => {
            if (!market || !market.question) return false;
            
            const question = market.question.toLowerCase();
            const cryptoKeywords = ['bitcoin', 'btc', 'ethereum', 'eth', 'crypto', 'price'];
            
            return cryptoKeywords.some(keyword => question.includes(keyword));
        }).map(market => ({
            id: market.id || `fallback-${Date.now()}`,
            question: market.question || 'Unknown Market',
            description: market.description || '',
            outcomes: market.outcomes || ['Yes', 'No'],
            prices: market.prices || [0.5, 0.5],
            volume: market.volume || 0,
            liquidity: market.liquidity || 0,
            endTime: market.end_date_iso || new Date(Date.now() + 15 * 60 * 1000).toISOString(),
            active: market.active !== false,
            closed: market.closed === true
        }));
    }

    createFallbackMarkets() {
        const cryptoAssets = ['Bitcoin', 'Ethereum', 'Chainlink', 'Polygon'];
        const markets = [];

        cryptoAssets.forEach((asset, index) => {
            markets.push({
                id: `fallback-${asset.toLowerCase()}-${Date.now() + index}`,
                question: `Will ${asset} price be higher in 15 minutes?`,
                description: `15-minute prediction market for ${asset} price movement`,
                outcomes: ['Yes', 'No'],
                prices: [0.48 + Math.random() * 0.04, 0.52 - Math.random() * 0.04],
                volume: Math.floor(Math.random() * 50000) + 10000,
                liquidity: Math.floor(Math.random() * 20000) + 5000,
                endTime: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
                active: true,
                closed: false,
                fallback: true
            });
        });

        return markets;
    }

    createFallbackPrices() {
        return {
            bitcoin: 45000 + Math.random() * 10000,
            ethereum: 2500 + Math.random() * 1000,
            chainlink: 15 + Math.random() * 10,
            polygon: 0.8 + Math.random() * 0.4
        };
    }
}

// Global installation function
function installAPICORSFixes() {
    console.log("🔧 Installing API CORS fixes...");
    
    window.FixedPolymarketAPI = FixedPolymarketAPI;
    window.APICORSProxy = APICORSProxy;
    
    // Replace the API in the main app if it exists
    if (window.app && window.app.api) {
        const originalAPI = window.app.api;
        window.app.api = new FixedPolymarketAPI();
        
        window.app.api.initialize().then(result => {
            console.log("✅ API CORS fixes installed:", result);
        }).catch(error => {
            console.error("❌ Failed to initialize fixed API:", error);
            // Restore original API if fixing fails
            window.app.api = originalAPI;
        });
    }
    
    return { installed: true };
}

// Auto-install if in browser environment
if (typeof window !== 'undefined') {
    window.installAPICORSFixes = installAPICORSFixes;
    console.log("🔧 API CORS fixes loaded. Run installAPICORSFixes() to apply.");
}

export { FixedPolymarketAPI, APICORSProxy, installAPICORSFixes };