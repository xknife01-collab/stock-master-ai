import { syncSingleStock } from '../lib/stockSync.js';
import supabase from '../lib/supabaseClient.js';
import { fetchStockFullDetailFromKIS } from '../lib/kisCore.js';

async function restore() {
    const symbols = ['402340', '000660', '005930'];
    console.log("🚀 Starting full restoration of investor stats for major stocks...");

    for (const symbol of symbols) {
        console.log(`\n----------------------------------------`);
        console.log(`📡 Performing FULL sync (bypassing FastSync) for: ${symbol}`);
        
        // We call fetchStockFullDetailFromKIS with isFastSync = false to force fetching all fields from KIS
        const result = await fetchStockFullDetailFromKIS(symbol, null, false);
        if (result && result.fundamental && result.advanced) {
            console.log(`✅ Successfully fetched full details. Investor stats:`, JSON.stringify(result.advanced.investor, null, 2));
            
            // Write to Supabase stock_detail_cache
            const { error } = await supabase
                .from('stock_detail_cache')
                .upsert({
                    symbol,
                    fundamental: result.fundamental,
                    advanced: result.advanced,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'symbol' });

            if (error) {
                console.error(`❌ Failed to update Supabase for ${symbol}:`, error.message);
            } else {
                console.log(`💾 Saved correct details & investor stats to Supabase for ${symbol}`);
            }
        } else {
            console.error(`❌ Failed to fetch full detail for ${symbol}`);
        }
        
        // Wait 1 second between requests to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`\n🎉 Restoration completed successfully!`);
}

restore().catch(console.error);
