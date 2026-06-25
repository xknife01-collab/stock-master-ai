import supabase from '../lib/supabaseClient.js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    const { data: row, error } = await supabase
        .from('stock_detail_cache')
        .select('*')
        .eq('symbol', '320000')
        .single();
        
    if (error) {
        console.error("Failed to fetch:", error.message);
        return;
    }
    
    console.log("Symbol:", row.symbol);
    console.log("Name:", row.fundamental?.name);
    console.log("Strength:", row.advanced?.strength);
    console.log("Strength type:", typeof row.advanced?.strength);
    process.exit(0);
}

run();
