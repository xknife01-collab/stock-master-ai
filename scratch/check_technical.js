import dotenv from 'dotenv';
dotenv.config();

import supabase from '../lib/supabaseClient.js';

async function checkTechnical() {
    const { data, error } = await supabase
        .from('stock_detail_cache')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error("Error:", error);
        return;
    }

    const item = data.find(row => row.advanced?.technical);
    if (item) {
        console.log(`Stock: ${item.symbol} (${item.fundamental?.name})`);
        console.log("Technical indicators:", JSON.stringify(item.advanced.technical, null, 2));
    } else {
        console.log("No stock found with technical indicators in cache.");
    }
}

checkTechnical();
