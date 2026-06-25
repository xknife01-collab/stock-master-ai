import supabase from '../lib/supabaseClient.js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    const { data: rows, error } = await supabase
        .from('stock_detail_cache')
        .select('symbol, fundamental, advanced');
        
    if (error) {
        console.error("Failed to fetch:", error.message);
        return;
    }
    
    console.log(`Loaded ${rows.length} rows from stock_detail_cache.`);
    const sorted = rows.map(r => ({
        name: r.fundamental?.name || r.symbol,
        symbol: r.symbol,
        strength: parseFloat(r.advanced?.strength) || 0
    })).sort((a, b) => b.strength - a.strength);
    
    sorted.forEach((s, idx) => {
        console.log(`${idx + 1}. ${s.name} (${s.symbol}): Strength = ${s.strength}%`);
    });
    process.exit(0);
}

run();
