import { fetchStockFullDetailFromKIS } from '../lib/kisCore.js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    const res = await fetchStockFullDetailFromKIS('320000', null, true);
    console.log("Symbol:", res.symbol);
    console.log("Name:", res.fundamental?.name);
    console.log("Price:", res.fundamental?.price);
    console.log("Strength:", res.advanced?.strength);
    console.log("Disparity 1/5/20:", res.advanced?.disparity1, res.advanced?.disparity5, res.advanced?.disparity20);
    process.exit(0);
}

run();
