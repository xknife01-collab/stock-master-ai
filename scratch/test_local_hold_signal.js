import { executeHourlyPulse } from '../routes/aiApi.js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    console.log("Starting local test of executeHourlyPulse(true)...");
    try {
        const result = await executeHourlyPulse(true);
        console.log("TEST SUCCESSFUL!");
        console.log("RESULT TIME:", result.time);
        console.log("RESULT DATA:", JSON.stringify(result.data, null, 2));
    } catch (e) {
        console.error("TEST FAILED WITH ERROR:", e.stack || e.message);
    }
    process.exit(0);
}

run();
