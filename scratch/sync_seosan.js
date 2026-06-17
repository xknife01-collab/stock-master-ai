import dotenv from 'dotenv';
dotenv.config();
import { syncSingleStock } from '../lib/stockSync.js';

(async () => {
    console.log("Triggering sync for HPSP (403870)...");
    const res = await syncSingleStock('403870');
    console.log("Result:", JSON.stringify(res, null, 2));
    process.exit(0);
})();
