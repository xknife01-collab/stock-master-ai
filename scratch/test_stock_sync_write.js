import dotenv from 'dotenv';
dotenv.config();

import supabase from '../lib/supabaseClient.js';
import { syncSingleStock } from '../lib/stockSync.js';

async function testSyncAndWrite() {
    console.log("=== Starting Stock Sync Write Verification ===");
    
    const targetSymbol = "005930"; // Samsung Electronics
    console.log(`Triggering syncSingleStock for: ${targetSymbol}...`);
    const result = await syncSingleStock(targetSymbol);

    if (!result) {
        console.error("❌ Stock sync failed to return result.");
        return;
    }

    console.log("\nSync Result Advanced Fields (local memory):", {
        isSelfHealed: result.advanced?.isSelfHealed,
        selfHealedReasons: result.advanced?.selfHealedReasons
    });

    console.log("\nFetching updated row from Supabase to verify DB persistence...");
    const { data, error } = await supabase
        .from('stock_detail_cache')
        .select('*')
        .eq('symbol', targetSymbol)
        .single();

    if (error) {
        console.error("❌ Failed to query database:", error.message);
        return;
    }

    console.log("Supabase Persisted Advanced Fields:", {
        isSelfHealed: data.advanced?.isSelfHealed,
        selfHealedReasons: data.advanced?.selfHealedReasons
    });

    if (data.advanced && typeof data.advanced.isSelfHealed === 'boolean') {
        console.log("\n✅ Database Write Test Passed: isSelfHealed correctly persisted as boolean in Supabase!");
    } else {
        console.error("\n❌ Database Write Test Failed: isSelfHealed not persisted properly.");
    }
}

testSyncAndWrite();
