import dotenv from 'dotenv';
dotenv.config();
import { syncSingleStock } from '../lib/stockSync.js';

(async () => {
    try {
        console.log("Forcing sync for Samsung Electronics (005930)...");
        const freshData = await syncSingleStock('005930', false, true);
        console.log("Sync complete!");
        console.log("Result Investor Details:", JSON.stringify(freshData.advanced?.investor, null, 2));
    } catch (err) {
        console.error("Sync Error:", err.message);
    }
    process.exit(0);
})();
