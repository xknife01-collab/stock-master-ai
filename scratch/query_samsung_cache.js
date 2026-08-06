import supabase from '../lib/supabaseClient.js';

async function checkSamsung() {
    const { data, error } = await supabase
        .from('stock_detail_cache')
        .select('*')
        .eq('symbol', '005930')
        .single();
        
    if (error) {
        console.error("Error fetching Samsung:", error);
    } else {
        console.log("Samsung cache updated_at:", data.updated_at);
        console.log("Samsung advanced.investor:", JSON.stringify(data.advanced?.investor, null, 2));
    }
}

checkSamsung();
