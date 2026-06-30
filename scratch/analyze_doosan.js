import { fetchStockPrice, fetchStockAnalytics, fetchStockIntradayInvestorEstimate } from '../lib/kisCore.js';

(async () => {
    try {
        console.log("=== Doosan Enerbility (034020) Real-time Data Fetch ===");
        
        const priceInfo = await fetchStockPrice("034020");
        console.log("\n[1] Price Info:");
        console.log(priceInfo);

        const analyticsInfo = await fetchStockAnalytics("034020");
        console.log("\n[2] Analytics & Technical Indicators:");
        console.log(JSON.stringify(analyticsInfo, null, 2));

        const estimateInfo = await fetchStockIntradayInvestorEstimate("034020");
        console.log("\n[3] Intraday Investor Estimate:");
        console.log(estimateInfo);

        console.log("\n=============================================");
    } catch (e) {
        console.error("Failed to analyze Doosan Enerbility:", e);
    }
})();
