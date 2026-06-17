import { syncSingleStock } from '../lib/stockSync.js';
import supabase from '../lib/supabaseClient.js';

async function test() {
    const symbol = '402340'; // SK스퀘어
    console.log(`\n=================== Fast Sync Test for ${symbol} ===================`);
    
    // 1. Get current stats
    const { data: before } = await supabase
        .from('stock_detail_cache')
        .select('advanced')
        .eq('symbol', symbol)
        .single();
    
    console.log("📊 Investor stats BEFORE sync:", JSON.stringify(before?.advanced?.investor, null, 2));

    // 2. Run sync (it will run with isFastSync: true because it was updated today)
    console.log("\n🔄 Running syncSingleStock...");
    await syncSingleStock(symbol);

    // 3. Get stats after sync
    const { data: after } = await supabase
        .from('stock_detail_cache')
        .select('advanced')
        .eq('symbol', symbol)
        .single();
    
    console.log("\n📊 Investor stats AFTER sync:", JSON.stringify(after?.advanced?.investor, null, 2));

    const isRetained = after?.advanced?.investor && after.advanced.investor.foreign5D !== 0;
    if (isRetained) {
        console.log("\n✅ SUCCESS: Historical investor stats were successfully RETAINED during fast sync!");
    } else {
        console.error("\n❌ FAILURE: Historical investor stats were overwritten/cleared during fast sync!");
    }
}

test().catch(console.error);
