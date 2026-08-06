import dotenv from 'dotenv';
dotenv.config();

import { fetchStockOvertimeData } from '../lib/kisCore.js';
import { isAftermarketHours } from '../lib/stockSync.js';

// Simple mock runner for VETO filtering logic
function simulateVetoCheck(symbol, name, afterMarketData) {
    console.log(`\n--- Simulating VETO Filter for ${name} (${symbol}) ---`);
    const forceRecommend = false;
    const changePct = 0.5; // regular market change
    const m = {
        afterMarket: afterMarketData,
        strength: 110,
        transactionValue: 5000000000,
        creditBalance: 2,
        openPrice: 100000,
        highPrice: 105000
    };

    let isVetoed = false;
    const vetoReasons = [];

    // The VETO logic copied exactly from routes/aiApi.js:
    if (!forceRecommend && m.afterMarket) {
        const amChange = m.afterMarket.change || 0;
        const amVol = m.afterMarket.volume || 0;
        const amVolPower = m.afterMarket.volumePower || 100;
        
        const isOvertimeDrop = amChange <= -1.5;
        const isOvertimeWeakStrength = (amVol > 100 && amVolPower < 35);
        
        if (isOvertimeDrop || isOvertimeWeakStrength) {
            isVetoed = true;
            vetoReasons.push(`[시간외 Risk] Gap-Down 위험 감지 (시간외 급락: ${amChange}% / 체결강도: ${amVolPower}%)`);
        }
    }

    console.log("VETO Result:", isVetoed ? "🔴 VETOED" : "🟢 PASSED");
    if (isVetoed) {
        console.log("Reasons:", vetoReasons.join(' | '));
    }
    return isVetoed;
}

(async () => {
    try {
        console.log("=== STEP 1: testing isAftermarketHours() ===");
        const amHours = isAftermarketHours();
        console.log("isAftermarketHours() returned:", amHours);

        console.log("\n=== STEP 2: fetching Real Aftermarket Data from KIS API (Kia: 000270) ===");
        const amData = await fetchStockOvertimeData('000270', false);
        console.log("Parsed Aftermarket Data:", amData);

        console.log("\n=== STEP 3: Simulating VETO Scenarios ===");
        
        // Scenario A: Safe aftermarket metrics
        simulateVetoCheck('000270', '기아 (Safe)', {
            change: -0.5,
            volume: 12000,
            volumePower: 75.4
        });

        // Scenario B: Drop of -1.8% (Should VETO)
        simulateVetoCheck('000270', '기아 (Gap-Down Drop)', {
            change: -1.8,
            volume: 5000,
            volumePower: 80.0
        });

        // Scenario C: Weak volume power (Should VETO)
        simulateVetoCheck('000270', '기아 (Gap-Down Weak Volume Power)', {
            change: -0.2,
            volume: 450,
            volumePower: 28.5
        });

        console.log("\n🎉 End-to-end check simulation complete.");
    } catch (err) {
        console.error("Test failed with error:", err);
    }
})();
