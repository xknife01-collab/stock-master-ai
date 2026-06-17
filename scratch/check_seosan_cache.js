import dotenv from 'dotenv';
dotenv.config();
import supabase from '../lib/supabaseClient.js';

(async () => {
    const { data, error } = await supabase
        .from('stock_detail_cache')
        .select('*')
        .eq('symbol', '079650')
        .single();
    console.log("Seosan Cache Row:", JSON.stringify(data, null, 2));
    process.exit(0);
})();
