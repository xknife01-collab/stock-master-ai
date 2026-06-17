import supabase from '../lib/supabaseClient.js';

async function check() {
    const symbols = ['402340', '000660', '005930'];
    console.log("📡 Querying major stocks...");
    const { data, error } = await supabase
        .from('stock_detail_cache')
        .select('symbol, fundamental, advanced, updated_at')
        .in('symbol', symbols);

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
