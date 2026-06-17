import dotenv from 'dotenv';
dotenv.config();

// Ensure force recommend is false to see true quant filters in action
process.env.FORCE_RECOMMEND = 'false';

import { executeHourlyPulse } from '../routes/aiApi.js';
import fs from 'fs';

(async () => {
    console.log("Removing cached ai_cache.json to force a fresh real-time pulse...");
    try {
        if (fs.existsSync('ai_cache.json')) {
            fs.unlinkSync('ai_cache.json');
            console.log("Deleted ai_cache.json.");
        }
    } catch (err) {
        console.warn("Could not delete ai_cache.json:", err.message);
    }

    console.log("Starting fresh AI pulse execution...");
    try {
        const result = await executeHourlyPulse(true);
        console.log("Pulse execution completed successfully!");
        console.log("Recommended Stock:", result.data.stock);
        console.log("Symbol:", result.data.symbol);
        console.log("Theme:", result.data.theme);
        console.log("Short Term Picks:", result.data.shortTermPicks);
        console.log("Long Term Picks:", result.data.longTermPicks);
    } catch (e) {
        console.error("Execution failed:", e);
    }
    process.exit(0);
})();
