import dotenv from 'dotenv';
dotenv.config();
import { fetchStockInvestorTrend } from '../lib/kisCore.js';

(async () => {
    const res = await fetchStockInvestorTrend("000660");
    console.log("KIS fetchStockInvestorTrend result:", JSON.stringify(res, null, 2));
    process.exit(0);
})();
