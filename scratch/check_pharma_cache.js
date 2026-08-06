import dotenv from 'dotenv';
dotenv.config();
import supabase from '../lib/supabaseClient.js';

(async () => {
    const { data, error } = await supabase
        .from('stock_detail_cache')
        .select('symbol, fundamental, advanced')
        .eq('symbol', '090430')
        .single();
    if (error) {
        console.error("Error fetching Amorepacific detail:", error);
    } else {
        console.log("Amorepacific fundamental name:", data.fundamental?.name);
        console.log("Amorepacific advanced investor details:", JSON.stringify(data.advanced?.investor, null, 2));
    }
    process.exit(0);
})();
