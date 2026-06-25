import { executeHourlyPulse } from '../routes/aiApi.js';
import dotenv from 'dotenv';
dotenv.config();

console.log("📡 Starting direct pulse execution in console...");
const start = Date.now();

executeHourlyPulse(true)
    .then(res => {
        const duration = ((Date.now() - start) / 1000).toFixed(2);
        console.log(`\n✅ Direct Pulse execution Success in ${duration}s!`);
        console.log("Time:", res.time);
        console.log("Signal keys:", Object.keys(res.data || {}));
        if (res.data) {
            console.log("\n--- Recommended Stock ---");
            console.log(`Stock: ${res.data.stock} (${res.data.symbol})`);
            console.log(`Theme: ${res.data.theme} (Prob: ${res.data.themeProb})`);
            console.log("Short Term Picks:", JSON.stringify(res.data.shortTermPicks, null, 2));
        }
        process.exit(0);
    })
    .catch(err => {
        console.error("\n❌ Direct Pulse execution Failed:", err.message);
        process.exit(1);
    });
