import supabase from '../lib/supabaseClient.js';

async function check() {
    console.log("📡 Querying stock_detail_cache for SK스퀘어 and other stocks...");
    const { data, error } = await supabase
        .from('stock_detail_cache')
        .select('symbol, fundamental, advanced, updated_at')
        .limit(20);

    if (error) {
        console.error("❌ Error querying DB:", error);
        return;
    }

    for (const row of data) {
        console.log(`\nSymbol: ${row.symbol} | Name: ${row.fundamental?.name || 'unknown'}`);
        console.log(`Updated At: ${row.updated_at}`);
        if (row.advanced?.investor) {
            console.log("Investor Stats:", JSON.stringify(row.advanced.investor, null, 2));
        } else {
            console.log("⚠️ No investor stats present in advanced.");
        }
    }
}

check().catch(console.error);
