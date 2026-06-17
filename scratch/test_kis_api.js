import dotenv from 'dotenv';
dotenv.config();
import { fetchStockFullDetailFromKIS } from '../lib/kisCore.js';

async function test() {
    console.log("Testing single stock fetch for SK Hynix (000660)...");
    try {
        const result = await fetchStockFullDetailFromKIS('000660');
        console.log("✅ SUCCESS!", result.fundamental?.price);
    } catch (e) {
        console.error("❌ FAILED:", e.message);
    }
}

test();
