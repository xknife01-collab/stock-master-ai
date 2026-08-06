import dotenv from 'dotenv';
dotenv.config();
import { fetchStockFullDetailFromKIS } from '../lib/kisCore.js';

async function main() {
    const symbol = "032980";
    console.log(`📡 Running fetchStockFullDetailFromKIS for ${symbol}...`);
    try {
        const result = await fetchStockFullDetailFromKIS(symbol, null, false, false, true);
        if (result) {
            console.log("✅ Success!");
        } else {
            console.log("❌ Returned null.");
        }
    } catch (err) {
        console.error("🚨 Error caught in test:", err);
    }
}

main();
