import dotenv from 'dotenv';
dotenv.config();
import { syncSingleStock } from '../lib/stockSync.js';

async function run() {
    const symbols = ['005930', '000270', '005380', '403870', '000660'];
    console.log(`🚀 Starting real-time synchronization from KIS to Supabase cache for: ${symbols.join(', ')}`);
    
    for (const symbol of symbols) {
        console.log(`\n🔄 Synchronizing ${symbol}...`);
        const result = await syncSingleStock(symbol);
        if (result) {
            console.log(`✅ Completed sync for ${symbol}. Current Price: ${result.fundamental?.price}`);
        } else {
            console.error(`❌ Failed to sync ${symbol}.`);
        }
        // Wait 2 seconds between syncs to prevent API throttling
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log("\n✨ All target stocks successfully synchronized with real market data!");
    process.exit(0);
}

run().catch(err => {
    console.error("Fatal error during synchronization:", err);
    process.exit(1);
});
