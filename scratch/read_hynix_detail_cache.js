import dotenv from 'dotenv';
dotenv.config();
import supabase from '../lib/supabaseClient.js';

(async () => {
    const { data, error } = await supabase
        .from('stock_detail_cache')
        .select('advanced')
        .eq('symbol', '000660')
        .single();
    if (error) {
        console.error("Error fetching Hynix detail:", error);
    } else {
        console.log("SK Hynix advanced investor details:", JSON.stringify(data.advanced?.investor, null, 2));
    }
    process.exit(0);
})();
