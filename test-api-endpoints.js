// Test different Polymarket API endpoints to find current markets
import { RealPolymarketAPI } from './js/core/real-polymarket-api.js';

console.log("🔍 Testing Different Polymarket API Endpoints...");

async function testAPIEndpoints() {
    try {
        const api = new RealPolymarketAPI();
        await api.initialize();
        
        console.log("✅ API initialized");
        console.log("🌐 Gamma Base URL:", api.gammaBaseURL);
        console.log("🌐 CLOB Base URL:", api.clobBaseURL);
        
        // Test 1: Different market query parameters
        console.log("\n1️⃣ Testing different market parameters...");
        
        const testParams = [
            'active=true&limit=10',
            'closed=false&limit=10', 
            'archived=false&limit=10',
            'limit=10&order=volume_desc',
            'limit=10&order=created_desc',
            'category=crypto&limit=10',
            'category=sports&limit=10'
        ];
        
        for (const params of testParams) {
            try {
                console.log(`\n🧪 Testing: /markets?${params}`);
                const response = await api.makeRequest(`${api.gammaBaseURL}/markets?${params}`);
                
                if (Array.isArray(response) && response.length > 0) {
                    const market = response[0];
                    console.log(`   📊 Found ${response.length} markets`);
                    console.log(`   📅 Latest market end date: ${market.endDate || 'N/A'}`);
                    console.log(`   📈 Sample: ${market.question?.slice(0, 60)}...`);
                    
                    // Check for recent markets (created in last year)
                    const recentMarkets = response.filter(m => {
                        const endDate = new Date(m.endDate || 0);
                        const oneYearAgo = new Date();
                        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
                        return endDate > oneYearAgo;
                    });
                    
                    console.log(`   ⏱️  Recent markets (last year): ${recentMarkets.length}`);
                } else {
                    console.log(`   ❌ No results or invalid response`);
                }
            } catch (error) {
                console.log(`   ❌ Error: ${error.message}`);
            }
        }
        
        // Test 2: Check different API endpoints
        console.log("\n2️⃣ Testing different API endpoints...");
        
        const endpoints = [
            '/events',
            '/markets/popular', 
            '/markets/trending',
            '/markets/featured',
            '/categories',
            '/tags'
        ];
        
        for (const endpoint of endpoints) {
            try {
                console.log(`\n🧪 Testing: ${endpoint}`);
                const response = await api.makeRequest(`${api.gammaBaseURL}${endpoint}`);
                
                if (response) {
                    if (Array.isArray(response)) {
                        console.log(`   📊 Array with ${response.length} items`);
                        if (response.length > 0) {
                            const item = response[0];
                            console.log(`   📝 Sample item keys: ${Object.keys(item).slice(0, 5).join(', ')}`);
                        }
                    } else {
                        console.log(`   📊 Object with keys: ${Object.keys(response).slice(0, 5).join(', ')}`);
                    }
                } else {
                    console.log(`   ❌ No response`);
                }
            } catch (error) {
                console.log(`   ❌ Error: ${error.message}`);
            }
        }
        
        // Test 3: Search for crypto-related terms
        console.log("\n3️⃣ Testing search functionality...");
        
        const searchTerms = ['bitcoin', 'ethereum', 'crypto', 'BTC', 'ETH', '15', 'minute', 'price'];
        
        for (const term of searchTerms.slice(0, 3)) { // Limit to avoid too many requests
            try {
                console.log(`\n🧪 Searching for: "${term}"`);
                const response = await api.makeRequest(`${api.gammaBaseURL}/markets?search=${term}&limit=5`);
                
                if (Array.isArray(response) && response.length > 0) {
                    console.log(`   📊 Found ${response.length} markets`);
                    response.forEach((market, index) => {
                        console.log(`   ${index + 1}. ${market.question?.slice(0, 80)}...`);
                    });
                } else {
                    console.log(`   ❌ No results found`);
                }
            } catch (error) {
                console.log(`   ❌ Search error: ${error.message}`);
            }
        }
        
        // Test 4: Check current timestamp and market dates
        console.log("\n4️⃣ Testing timestamp and market dates...");
        
        const now = new Date();
        console.log(`🕐 Current time: ${now.toISOString()}`);
        
        try {
            const response = await api.makeRequest(`${api.gammaBaseURL}/markets?limit=20`);
            
            if (Array.isArray(response)) {
                const currentMarkets = response.filter(market => {
                    const endDate = new Date(market.endDate || 0);
                    return endDate > now;
                });
                
                const recentMarkets = response.filter(market => {
                    const startDate = new Date(market.startDate || market.createdAt || 0);
                    const thirtyDaysAgo = new Date();
                    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                    return startDate > thirtyDaysAgo;
                });
                
                console.log(`📊 Total markets: ${response.length}`);
                console.log(`⏱️  Markets ending in future: ${currentMarkets.length}`);
                console.log(`📅 Markets created in last 30 days: ${recentMarkets.length}`);
                
                if (currentMarkets.length > 0) {
                    console.log("\n📈 Current/future markets:");
                    currentMarkets.slice(0, 3).forEach((market, index) => {
                        console.log(`   ${index + 1}. ${market.question?.slice(0, 60)}...`);
                        console.log(`      📅 Ends: ${market.endDate}`);
                    });
                }
            }
        } catch (error) {
            console.log(`❌ Timestamp test error: ${error.message}`);
        }
        
    } catch (error) {
        console.error("❌ API endpoint testing failed:", error.message);
    }
}

testAPIEndpoints();