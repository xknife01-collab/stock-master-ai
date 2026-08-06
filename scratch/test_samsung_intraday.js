import dotenv from 'dotenv';
dotenv.config();
import { fetchStockIntradayInvestorEstimate, fetchStockMemberTrend } from '../lib/kisCore.js';

(async () => {
    try {
        console.log("Calling fetchStockIntradayInvestorEstimate('005930')...");
        const intraday = await fetchStockIntradayInvestorEstimate('005930', true, false);
        console.log("Intraday Result:", intraday);

        console.log("Calling fetchStockMemberTrend('005930')...");
        const memberTrend = await fetchStockMemberTrend('005930', false);
        console.log("Member Trend Result:", memberTrend);
    } catch (err) {
        console.error("Error:", err.message);
    }
    process.exit(0);
})();
