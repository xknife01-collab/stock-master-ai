import dotenv from 'dotenv';
dotenv.config();

import supabase from '../lib/supabaseClient.js';

async function checkSupabaseDetails() {
    console.log("=== Checking Supabase detail cache schema and values ===");
    const { data, error } = await supabase
        .from('stock_detail_cache')
        .select('*')
        .limit(3);

    if (error) {
        console.error("❌ Error fetching from Supabase:", error.message);
        return;
    }

    if (!data || data.length === 0) {
        console.log("⚠️ No records found in stock_detail_cache.");
        return;
    }

    console.log(`Found ${data.length} records in cache.`);
    data.forEach(row => {
        console.log(`\n📌 Stock: ${row.name} (${row.symbol})`);
        console.log(`- Updated At: ${row.updated_at}`);
        console.log(`- Fundamental Keys:`, Object.keys(row.fundamental || {}));
        console.log(`- Advanced Keys:`, Object.keys(row.advanced || {}));
        console.log(`- Advanced values:`, {
            strength: row.advanced?.strength,
            transactionValue: row.advanced?.transactionValue,
            isSelfHealed: row.advanced?.isSelfHealed,
            selfHealedReasons: row.advanced?.selfHealedReasons
        });
    });
}

checkSupabaseDetails();
