import { fetchStockIntradayInvestorEstimate } from '../lib/kisCore.js';

(async () => {
    try {
        console.log("🚀 Starting Intraday Investor Estimate cache and data verification test...");
        
        console.log("\n--- Query 1: Samsung Electronics (005930) ---");
        const t0 = Date.now();
        const est1 = await fetchStockIntradayInvestorEstimate("005930");
        console.log(`Query 1 completed in ${Date.now() - t0}ms`);
        console.log("Samsung Electronics Estimate:", est1);

        console.log("\n--- Query 2: Kia (000270) ---");
        const t1 = Date.now();
        const est2 = await fetchStockIntradayInvestorEstimate("000270");
        console.log(`Query 2 completed in ${Date.now() - t1}ms (Should be 0-5ms due to cache)`);
        console.log("Kia Estimate:", est2);

        console.log("\n--- Query 3: HPSP (403870) ---");
        const t2 = Date.now();
        const est3 = await fetchStockIntradayInvestorEstimate("403870");
        console.log(`Query 3 completed in ${Date.now() - t2}ms (Should be 0-5ms due to cache)`);
        console.log("HPSP Estimate:", est3);

        console.log("\n--- Query 4: A random non-top stock (999999) ---");
        const t3 = Date.now();
        const est4 = await fetchStockIntradayInvestorEstimate("999999");
        console.log(`Query 4 completed in ${Date.now() - t3}ms (Should be 0-5ms, should return null)`);
        console.log("Non-top Stock Estimate:", est4);

        console.log("\n✅ Test finished successfully.");
    } catch (e) {
        console.error("Test failed:", e.message);
    }
})();
