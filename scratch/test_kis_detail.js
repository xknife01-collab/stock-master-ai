import { fetchStockFullDetailFromKIS } from '../lib/kisCore.js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    console.log("Fetching detail from KIS for 320000...");
    const res = await fetchStockFullDetailFromKIS('320000', null, true);
    console.log("Result:", JSON.stringify(res, null, 2));
    process.exit(0);
}

run();
