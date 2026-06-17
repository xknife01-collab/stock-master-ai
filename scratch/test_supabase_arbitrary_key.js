import dotenv from 'dotenv';
dotenv.config();

import supabase from '../lib/supabaseClient.js';

async function testArbitraryKey() {
    console.log("=== Testing 10-char Key in stock_detail_cache ===");
    const testKey = "__SUPPLY__";
    const testData = { hello: "world", value: [1, 2, 3] };

    console.log("Upserting test data...");
    const { error: upsertError } = await supabase
        .from('stock_detail_cache')
        .upsert({
            symbol: testKey,
            fundamental: testData,
            advanced: {},
            updated_at: new Date().toISOString()
        }, { onConflict: 'symbol' });

    if (upsertError) {
        console.error("❌ Upsert failed:", upsertError.message);
        return;
    }
    console.log("✅ Upsert succeeded!");

    console.log("Reading test data back...");
    const { data, error: readError } = await supabase
        .from('stock_detail_cache')
        .select('*')
        .eq('symbol', testKey)
        .single();

    if (readError) {
        console.error("❌ Read failed:", readError.message);
        return;
    }
    console.log("✅ Read succeeded! Data:", data);

    console.log("Cleaning up test data...");
    const { error: deleteError } = await supabase
        .from('stock_detail_cache')
        .delete()
        .eq('symbol', testKey);

    if (deleteError) {
        console.error("❌ Delete failed:", deleteError.message);
        return;
    }
    console.log("✅ Cleaned up successfully!");
}

testArbitraryKey();
