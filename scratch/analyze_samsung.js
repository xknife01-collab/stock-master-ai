import { fetchStockFullDetailFromKIS, fetchStockIntradayInvestorEstimate } from '../lib/kisCore.js';
import dotenv from 'dotenv';
dotenv.config();

(async () => {
    try {
        console.log("Fetching Samsung Electronics (005930) details...");
        const detail = await fetchStockFullDetailFromKIS('005930', null, false);
        const estimate = await fetchStockIntradayInvestorEstimate('005930');

        console.log("\n=================== SAMSUNG ELECTRONICS (005930) DETAIL ===================");
        console.log("Price:", detail?.fundamental?.price);
        console.log("Change Rate (%):", detail?.fundamental?.change);
        console.log("Sector:", detail?.fundamental?.sector);
        
        console.log("\n------------------- Technical Indicators -------------------");
        console.log("RSI:", detail?.advanced?.technical?.rsi);
        console.log("MA5:", detail?.advanced?.technical?.ma5);
        console.log("MA20:", detail?.advanced?.technical?.ma20);
        console.log("MA60:", detail?.advanced?.technical?.ma60);
        console.log("MA Alignment:", detail?.advanced?.technical?.maAlignment);
        console.log("Bollinger Bands:", JSON.stringify(detail?.advanced?.technical?.bollinger, null, 2));

        console.log("\n------------------- Advanced Data -------------------");
        console.log("Short Ratio:", detail?.advanced?.shortRatio);
        console.log("Strength (체결강도):", detail?.advanced?.strength);
        console.log("Strength Acceleration:", detail?.advanced?.strengthAcceleration);
        console.log("Transaction Value (거래대금):", detail?.advanced?.transactionValue);
        console.log("Volume Rate (거래량 대비):", detail?.advanced?.volumeRate);
        console.log("Investor Trend (isRealtime):", detail?.advanced?.investor?.isRealtime);
        console.log("Investor Buy/Sell:", JSON.stringify(detail?.advanced?.investor, null, 2));

        console.log("\n=================== INTRADAY ESTIMATE ===================");
        console.log("Estimate:", JSON.stringify(estimate, null, 2));

    } catch (e) {
        console.error("Failed to run analysis:", e);
    }
})();
