import dotenv from 'dotenv';
dotenv.config();
import supabase from '../lib/supabaseClient.js';

async function checkHynix() {
    // 1. Check stock_master_map
    const { data: master } = await supabase
        .from('stock_master_map')
        .select('*')
        .limit(1);
    console.log("Master mapping sample:", master);

    // 2. Check stock_detail_cache
    const { data: cache } = await supabase
        .from('stock_detail_cache')
        .select('*')
        .eq('symbol', '000660');
    console.log("Cache detail found:", cache ? cache.length > 0 : false);
    if (cache && cache.length > 0) {
        console.log("Cache detail:", JSON.stringify(cache[0], null, 2));
    }
}
checkHynix();
