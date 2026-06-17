import { fetchStockInvestorTrend } from '../lib/kisCore.js';

(async () => {
    try {
        const symbol = "000270"; // Kia
        console.log(`Calling fetchStockInvestorTrend for ${symbol}...`);
        const res = await fetchStockInvestorTrend(symbol);
        console.log("Parsed Stats:", JSON.stringify(res?.stats, null, 2));
    } catch (e) {
        console.error(e);
    }
})();
