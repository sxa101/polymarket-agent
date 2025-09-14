// Market Discovery Test
// Let's see what markets are actually available on Polymarket

import { RealPolymarketAPI } from './js/core/real-polymarket-api.js';

console.log("🔍 Testing Polymarket Market Discovery...");

async function testMarketDiscovery() {
    try {
        const api = new RealPolymarketAPI();
        await api.initialize();
        
        console.log("✅ API initialized, fetching raw market data...");
        
        // Make a raw request to see what's available
        const response = await api.makeRequest(
            `${api.gammaBaseURL}/markets?active=true&limit=10&offset=0`
        );
        
        console.log(`📊 Found ${response.length} total active markets`);
        
        if (response.length > 0) {
            console.log("\n📈 Sample markets:");
            response.slice(0, 5).forEach((market, index) => {
                console.log(`\n${index + 1}. ${market.question}`);
                console.log(`   📝 Description: ${market.description?.slice(0, 100) || 'N/A'}...`);
                console.log(`   🏷️  Tags: ${market.tags?.join(', ') || 'N/A'}`);
                console.log(`   📊 Volume: $${market.volume || 'N/A'}`);
                console.log(`   💧 Liquidity: $${market.liquidity || 'N/A'}`);
                console.log(`   📅 Start: ${market.startDate || 'N/A'}`);
                console.log(`   📅 End: ${market.endDate || 'N/A'}`);
                
                // Check our filtering logic
                const question = market.question?.toLowerCase() || '';
                const description = market.description?.toLowerCase() || '';
                const tags = market.tags || [];
                
                const hasCryptoAsset = ['btc', 'eth', 'sol', 'ada', 'matic', 'avax', 'dot', 'link', 'uni'].some(asset => 
                    question.includes(asset) || description.includes(asset)
                );
                
                const has15MinIndicator = ['chainlink', 'automation', '15 minute', '15-minute', 'fifteen minute', '15min', '15 min'].some(keyword =>
                    question.includes(keyword) || description.includes(keyword)
                );
                
                console.log(`   🔍 Has Crypto Asset: ${hasCryptoAsset ? '✅' : '❌'}`);
                console.log(`   🔍 Has 15min Indicator: ${has15MinIndicator ? '✅' : '❌'}`);
            });
        }
        
        // Now test our filtering function
        console.log("\n🧪 Testing our filtering function...");
        const filteredMarkets = response.filter(market => {
            return api.isChainlink15MinuteMarket(market);
        });
        
        console.log(`📊 Our filter found: ${filteredMarkets.length} markets`);
        
        if (filteredMarkets.length === 0) {
            console.log("⚠️ Our filtering is too strict! Let's see why...");
            
            // Test less strict filtering
            const cryptoMarkets = response.filter(market => {
                const question = market.question?.toLowerCase() || '';
                const description = market.description?.toLowerCase() || '';
                
                return ['btc', 'eth', 'sol', 'ada', 'matic', 'avax', 'dot', 'link', 'uni', 'bitcoin', 'ethereum', 'solana'].some(asset => 
                    question.includes(asset) || description.includes(asset)
                );
            });
            
            console.log(`💎 Found ${cryptoMarkets.length} crypto-related markets`);
            
            if (cryptoMarkets.length > 0) {
                console.log("📈 Sample crypto markets:");
                cryptoMarkets.slice(0, 3).forEach((market, index) => {
                    console.log(`   ${index + 1}. ${market.question}`);
                });
            }
        }
        
    } catch (error) {
        console.error("❌ Market discovery failed:", error.message);
    }
}

testMarketDiscovery();