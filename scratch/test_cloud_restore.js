import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import supabase from '../lib/supabaseClient.js';
import { restoreSupplyCacheFromCloud } from '../lib/supplyCache.js';

const supplyCachePath = path.resolve(process.cwd(), 'supply_cache.json');
const dashboardCachePath = path.resolve(process.cwd(), 'dashboard_cache.json');

async function testCloudRestore() {
    console.log("=== Testing Cloud Restore ===");

    // 1. Delete local caches
    console.log("Deleting local cache files...");
    if (fs.existsSync(supplyCachePath)) {
        fs.unlinkSync(supplyCachePath);
        console.log("- Deleted supply_cache.json");
    }
    if (fs.existsSync(dashboardCachePath)) {
        fs.unlinkSync(dashboardCachePath);
        console.log("- Deleted dashboard_cache.json");
    }

    // 2. Restore Supply Cache
    console.log("\nRestoring supply cache from cloud...");
    await restoreSupplyCacheFromCloud();
    if (fs.existsSync(supplyCachePath)) {
        console.log("✅ supply_cache.json successfully restored from Supabase!");
        const content = JSON.parse(fs.readFileSync(supplyCachePath, 'utf8'));
        console.log("Keys restored:", Object.keys(content));
    } else {
        console.error("❌ supply_cache.json was NOT restored.");
    }

    // 3. Restore Dashboard Cache
    console.log("\nRestoring dashboard cache from cloud...");
    if (supabase) {
        try {
            const { data, error } = await supabase
                .from('stock_detail_cache')
                .select('fundamental')
                .eq('symbol', '__DASH__')
                .maybeSingle();

            if (!error && data && data.fundamental) {
                fs.writeFileSync(dashboardCachePath, JSON.stringify(data.fundamental, null, 2), 'utf8');
                console.log("✅ dashboard_cache.json successfully restored from Supabase!");
                const content = JSON.parse(fs.readFileSync(dashboardCachePath, 'utf8'));
                console.log("Dashboard sectors count:", content.sectors?.length);
            } else {
                console.error("❌ Failed to query dashboard cache from Supabase:", error?.message);
            }
        } catch (e) {
            console.error("❌ Exception during dashboard cloud restore:", e.message);
        }
    } else {
        console.error("❌ Supabase client is not initialized.");
    }
}

testCloudRestore();
