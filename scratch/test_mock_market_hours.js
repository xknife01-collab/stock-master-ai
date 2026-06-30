import dotenv from 'dotenv';
dotenv.config();
import { fetchStockFullDetailFromKIS } from '../lib/kisCore.js';

async function run() {
    // Mock Date.now to 2026-06-30 11:00:00 KST (Tuesday, June 30)
    const mockTime = new Date('2026-06-30T02:00:00Z').getTime();
    const originalNow = Date.now;
    Date.now = () => mockTime;

    console.log("Mocked Time (UTC+9):", new Date(Date.now() + 9*60*60*1000).toISOString());

    const symbol = '000660';
    console.log("Fetching detail with mocked market-open hours...");
    const res = await fetchStockFullDetailFromKIS(symbol);
    console.log("Mocked Investor Stats:", res.advanced?.investor);

    // Restore original Date.now
    Date.now = originalNow;
}

run().catch(console.error);
