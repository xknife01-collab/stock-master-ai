import dotenv from 'dotenv';
dotenv.config();
import { syncSingleStock } from '../lib/stockSync.js';
import supabase from '../lib/supabaseClient.js';

async function syncKia() {
    console.log("Syncing Kia (000270) to Supabase cache...");
    const result = await syncSingleStock('000270');
    if (result) {
        console.log("Sync complete! Advanced fields:", JSON.stringify(result.advanced, null, 2));
        
        // Fetch to confirm what's in Supabase now
        const { data } = await supabase
            .from('stock_detail_cache')
            .select('*')
            .eq('symbol', '000270')
            .single();
        console.log("Supabase cached advanced:", JSON.stringify(data.advanced, null, 2));
    } else {
        console.error("Failed to sync Kia.");
    }
}
syncKia();
