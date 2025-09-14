// Investigate the recent markets we found
import { RealPolymarketAPI } from './js/core/real-polymarket-api.js';

console.log("🔍 Investigating Recent Markets...");

async function investigateRecentMarkets() {
    try {
        const api = new RealPolymarketAPI();
        await api.initialize();
        
        console.log("✅ API initialized, fetching recent markets...");
        
        // Use the successful parameter combination we found
        const response = await api.makeRequest(`${api.gammaBaseURL}/markets?closed=false&limit=50`);
        
        console.log(`📊 Found ${response.length} non-closed markets`);
        
        const now = new Date();
        const recentMarkets = response.filter(market => {
            const endDate = new Date(market.endDate || 0);
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
            return endDate > oneYearAgo;
        });
        
        console.log(`⏱️ Recent markets (last year): ${recentMarkets.length}`);
        
        if (recentMarkets.length > 0) {
            console.log("\n📈 RECENT MARKETS ANALYSIS:");
            
            recentMarkets.forEach((market, index) => {
                const endDate = new Date(market.endDate);
                const isActive = endDate > now;
                const daysTillEnd = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
                
                console.log(`\n${index + 1}. ${market.question}`);
                console.log(`   📝 Description: ${market.description?.slice(0, 100) || 'N/A'}...`);
                console.log(`   🏷️  Tags: ${market.tags?.join(', ') || 'N/A'}`);
                console.log(`   📊 Volume: $${market.volume || 'N/A'}`);
                console.log(`   💧 Liquidity: $${market.liquidity || 'N/A'}`);
                console.log(`   📅 End Date: ${market.endDate}`);
                console.log(`   ⏱️  Days till end: ${daysTillEnd}`);
                console.log(`   🟢 Status: ${isActive ? 'ACTIVE' : 'EXPIRED'}`);
                
                // Check for crypto content
                const question = market.question?.toLowerCase() || '';
                const description = market.description?.toLowerCase() || '';
                
                const cryptoTerms = ['btc', 'bitcoin', 'eth', 'ethereum', 'crypto', 'sol', 'solana', 'ada', 'cardano', 'matic', 'polygon'];
                const hasCrypto = cryptoTerms.some(term => question.includes(term) || description.includes(term));
                
                const timeTerms = ['15 minute', '15-minute', '15min', '15 min', 'fifteen minute', 'hourly', 'daily', 'price'];
                const hasTimeElement = timeTerms.some(term => question.includes(term) || description.includes(term));
                
                console.log(`   💎 Has Crypto: ${hasCrypto ? '✅' : '❌'}`);
                console.log(`   ⏰ Has Time Element: ${hasTimeElement ? '✅' : '❌'}`);
                
                if (hasCrypto || hasTimeElement) {
                    console.log(`   🎯 POTENTIAL MATCH!`);
                }
            });
            
            // Check for actively trading markets
            const activeMarkets = recentMarkets.filter(market => {
                const endDate = new Date(market.endDate);
                return endDate > now;
            });
            
            console.log(`\n🟢 Currently active markets: ${activeMarkets.length}`);
            
            if (activeMarkets.length > 0) {
                console.log("📊 ACTIVE MARKETS:");
                activeMarkets.forEach((market, index) => {
                    console.log(`   ${index + 1}. ${market.question}`);
                    console.log(`      📅 Ends: ${market.endDate}`);
                    console.log(`      📊 Volume: $${market.volume}`);
                });
            }
            
            // Test our filtering logic on these markets
            console.log("\n🧪 Testing our filtering logic on recent markets...");
            const filteredMarkets = recentMarkets.filter(market => {
                return api.isChainlink15MinuteMarket(market);
            });
            
            console.log(`🎯 Our filter matches: ${filteredMarkets.length} markets`);
            
            if (filteredMarkets.length === 0) {
                console.log("⚠️ Our filter is too strict for current markets. Let's adjust it...");
                
                // Try more lenient filtering
                const lenientFiltered = recentMarkets.filter(market => {
                    const question = market.question?.toLowerCase() || '';
                    const description = market.description?.toLowerCase() || '';
                    
                    // Just look for any crypto mention
                    const hasCrypto = ['btc', 'bitcoin', 'eth', 'ethereum', 'crypto'].some(term => 
                        question.includes(term) || description.includes(term)
                    );
                    
                    // Basic volume/liquidity check
                    const volume = parseFloat(market.volume || '0');
                    const hasVolume = volume > 0;
                    
                    return hasCrypto && hasVolume;
                });
                
                console.log(`🎯 Lenient filter matches: ${lenientFiltered.length} markets`);
                
                if (lenientFiltered.length > 0) {
                    console.log("✅ Found crypto markets with lenient filtering!");
                    lenientFiltered.forEach((market, index) => {
                        console.log(`   ${index + 1}. ${market.question}`);
                    });
                }
            }
        }
        
    } catch (error) {
        console.error("❌ Investigation failed:", error.message);
    }
}

investigateRecentMarkets();