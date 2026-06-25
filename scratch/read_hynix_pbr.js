import dotenv from 'dotenv';
dotenv.config();
import supabase from '../lib/supabaseClient.js';

(async () => {
    const { data, error } = await supabase
        .from('stock_detail_cache')
        .select('*')
        .eq('symbol', '000660')
        .single();
    if (error) {
        console.error("Error fetching Hynix:", error);
    } else {
        console.log("SK Hynix fundamental:", data.fundamental);
    }
    process.exit(0);
})();
