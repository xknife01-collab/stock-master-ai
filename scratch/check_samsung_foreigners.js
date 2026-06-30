import dotenv from 'dotenv';
dotenv.config();
import { fetchStockInvestorTrend } from '../lib/kisCore.js';

(async () => {
    try {
        console.log("📡 Fetching Samsung Electronics (005930) Investor Trend...");
        const result = await fetchStockInvestorTrend("005930");
        console.log("\n[Result Summary]:", result.rawSummary);
        console.log("\n[Detailed Stats]:", JSON.stringify(result.stats, null, 2));
    } catch (e) {
        console.error(e);
    }
})();
