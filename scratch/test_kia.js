import { syncSingleStock } from '../lib/stockSync.js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    console.log("Starting sync for Kia (000270)...");
    const res = await syncSingleStock('000270');
    console.log("Result:", JSON.stringify({
        name: res?.fundamental?.name,
        price: res?.fundamental?.price,
        shortRatio: res?.advanced?.shortRatio,
        transactionValue: res?.advanced?.transactionValue,
        creditBalance: res?.advanced?.creditBalance
    }, null, 2));
}

run();
