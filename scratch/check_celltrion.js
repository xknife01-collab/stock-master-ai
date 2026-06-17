import dotenv from 'dotenv';
dotenv.config();
import supabase from '../lib/supabaseClient.js';

async function check() {
    const { data, error } = await supabase
        .from('stock_detail_cache')
        .select('*')
        .eq('symbol', '068270')
        .maybeSingle();
    
    if (error) {
        console.error("Supabase Error:", error);
    } else {
        console.log("Cached Data for Celltrion (068270):", data ? "FOUND" : "NOT FOUND");
        if (data) {
            console.log("Updated At:", data.updated_at);
            console.log("Investor Data:", JSON.stringify(data.advanced?.investor, null, 2));
            console.log("Technical Data:", JSON.stringify(data.advanced?.technical, null, 2));
            console.log("Intraday Data:", JSON.stringify(data.advanced?.intraday, null, 2));
        }
    }
}
check();
