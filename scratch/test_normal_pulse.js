import dotenv from 'dotenv';
dotenv.config();

process.env.FORCE_RECOMMEND = 'false';

import { executeHourlyPulse } from '../routes/aiApi.js';

(async () => {
    console.log("Starting real AI pulse execution with FORCE_RECOMMEND=false (normal mode)...");
    try {
        const result = await executeHourlyPulse(true);
        console.log("Result:", JSON.stringify(result, null, 2));
    } catch (e) {
        console.error("Execution failed:", e);
    }
})();
