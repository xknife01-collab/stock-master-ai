import dotenv from 'dotenv';
dotenv.config();

import { syncDashboardData, cachedDashboard } from '../routes/dashboardApi.js';

async function runDashboardSyncTest() {
    console.log("=== Starting Dashboard Sync Test ===");
    console.log("Calling syncDashboardData()...");
    await syncDashboardData();
    console.log("\nFinished syncDashboardData call.");
    
    console.log("\nCached dashboard contents (sectors):");
    if (cachedDashboard && cachedDashboard.sectors) {
        console.log(JSON.stringify(cachedDashboard.sectors, null, 2));
        const kosdaqIndex = cachedDashboard.sectors.find(s => s.name === 'KOSDAQ');
        if (kosdaqIndex && kosdaqIndex.price !== '0') {
            console.log("\n✅ Test Passed: KOSDAQ index fetched or restored successfully and is not '0'.");
        } else {
            console.error("\n❌ Test Failed: KOSDAQ index is still '0'.");
        }
    } else {
        console.error("\n❌ Test Failed: Cached dashboard or sectors is missing.");
    }
}

runDashboardSyncTest();
