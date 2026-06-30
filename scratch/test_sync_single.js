import dotenv from 'dotenv';
dotenv.config();
import { syncSingleStock } from '../lib/stockSync.js';
import supabase from '../lib/supabaseClient.js';

async function run() {
    const symbol = '000660'; // SK Hynix
    console.log(`Running syncSingleStock for ${symbol}...`);
    const result = await syncSingleStock(symbol);
    console.log("Sync Result keys:", Object.keys(result));
    console.log("Investor Stats:", result.advanced?.investor);
}

run().catch(console.error);
