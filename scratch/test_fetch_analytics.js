import dotenv from 'dotenv';
dotenv.config();
import { fetchStockAnalytics } from '../lib/kisCore.js';

async function main() {
    const symbol = "032980";
    console.log(`📡 Calling fetchStockAnalytics for ${symbol}...`);
    const result = await fetchStockAnalytics(symbol);
    if (result) {
        console.log("✅ Success! Result technicalIndicators:", result.technicalIndicators);
        console.log("Strength:", result.strength);
        console.log("ShortRatio:", result.shortRatio);
    } else {
        console.log("❌ Failed to fetch analytics.");
    }
}

main();
