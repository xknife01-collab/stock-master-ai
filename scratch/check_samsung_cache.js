import dotenv from 'dotenv';
dotenv.config();
import supabase from '../lib/supabaseClient.js';

(async () => {
    try {
        const { data, error } = await supabase
            .from('stock_detail_cache')
            .select('*')
            .eq('symbol', '005930')
            .single();

        if (error) {
            console.error("❌ Supabase Error:", error.message);
        } else if (data) {
            console.log("=== SAMSUNG ELECTRONICS (005930) CACHE DATA ===");
            console.log("Updated At:", data.updated_at);
            console.log("Fundamental Price:", data.fundamental?.price);
            console.log("Fundamental finance length:", data.fundamental?.finance?.length);
            console.log("Advanced Chart History Keys:", Object.keys(data.advanced?.chartHistory || {}));
            console.log("Advanced 1D chart length:", data.advanced?.chartHistory?.['1D']?.length);
            console.log("Advanced Investor Details:", JSON.stringify(data.advanced?.investor, null, 2));
        } else {
            console.log("❌ No cache data found for Samsung Electronics.");
        }
    } catch (err) {
        console.error("Exception:", err.message);
    }
    process.exit(0);
})();
