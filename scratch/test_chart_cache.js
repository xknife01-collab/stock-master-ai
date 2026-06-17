import dotenv from 'dotenv';
dotenv.config();
import supabase from '../lib/supabaseClient.js';
import { syncSingleStock } from '../lib/stockSync.js';

async function runTest() {
    const symbol = '000660'; // SK Hynix
    console.log(`\n🚀 1. Triggering syncSingleStock for ${symbol}...`);
    const startTime = Date.now();
    const result = await syncSingleStock(symbol);
    const syncDuration = Date.now() - startTime;
    
    if (!result) {
        console.error("❌ syncSingleStock returned null. Check logs.");
        process.exit(1);
    }
    console.log(`✅ Sync finished in ${(syncDuration / 1000).toFixed(2)}s.`);

    console.log(`\n🚀 2. Querying Supabase stock_detail_cache for ${symbol}...`);
    const { data: cache, error } = await supabase
        .from('stock_detail_cache')
        .select('*')
        .eq('symbol', symbol)
        .single();

    if (error || !cache) {
        console.error("❌ Failed to read database cache:", error?.message);
        process.exit(1);
    }

    const chartHistory = cache.advanced?.chartHistory;
    console.log("Database cache record check:");
    console.log(`- has chartHistory field: ${!!chartHistory}`);
    if (chartHistory) {
        console.log(`- ranges cached: ${Object.keys(chartHistory).join(', ')}`);
        if (chartHistory['1D']) {
            console.log(`- 1D points count: ${chartHistory['1D'].length}`);
            console.log(`- First point:`, chartHistory['1D'][0]);
            console.log(`- Last point:`, chartHistory['1D'][chartHistory['1D'].length - 1]);
        } else {
            console.error("❌ 1D chart data is missing!");
        }
    }

    console.log("\n🚀 3. Simulating fast cache retrieval from Supabase...");
    const readStart = Date.now();
    const { data: fastData } = await supabase
        .from('stock_detail_cache')
        .select('advanced')
        .eq('symbol', symbol)
        .single();
    
    const readDuration = Date.now() - readStart;
    console.log(`⚡ Supabase fetch took: ${readDuration}ms`);
    if (readDuration < 100) {
        console.log("🥇 Excellent! Response is under 100ms (blazing fast!).");
    } else {
        console.warn("⚠️ Response is slightly slow, check database connection latency.");
    }
    
    process.exit(0);
}

runTest();
