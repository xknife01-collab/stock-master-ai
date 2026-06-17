import dotenv from 'dotenv';
dotenv.config();
import supabase from '../lib/supabaseClient.js';

async function check() {
    const { data, error } = await supabase
        .from('stock_detail_cache')
        .select('*')
        .eq('symbol', '000270')
        .maybeSingle();
    
    if (error) {
        console.error("Supabase Error:", error);
    } else {
        console.log("Cached Data for Kia (000270):", data ? "FOUND" : "NOT FOUND");
        if (data) {
            console.log("Updated At:", data.updated_at);
            console.log("Has Fundamental:", !!data.fundamental);
            console.log("Has Advanced:", !!data.advanced);
            console.log("Advanced Data:", JSON.stringify(data.advanced, null, 2));
        }
    }
}
check();
