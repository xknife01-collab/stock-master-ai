import dotenv from 'dotenv';
dotenv.config();
import fs from 'fs';
import { fetchStockIntradayInvestorEstimate } from '../lib/kisCore.js';

async function run() {
    console.log("Testing fetchStockIntradayInvestorEstimate for SK Hynix (000660)...");
    const res = await fetchStockIntradayInvestorEstimate('000660');
    console.log("Result:", res);
}

run().catch(console.error);
