import { executeHourlyPulse } from '../routes/aiApi.js';
import dotenv from 'dotenv';
dotenv.config();

console.log("⚡ Starting dual-frequency cache test...");
const start = Date.now();

// Calling executeHourlyPulse(false) should hit the 10-minute cache we just generated
executeHourlyPulse(false)
    .then(res => {
        const duration = ((Date.now() - start) / 1000).toFixed(2);
        console.log(`\n✅ Cache test completed in ${duration}s!`);
        console.log("Time:", res.time);
        console.log("Market Open:", res.marketOpen);
        if (res.data) {
            console.log("Theme:", res.data.theme);
            console.log("Recommended Stock:", res.data.stock);
            console.log("Number of candidates:", res.data.candidates ? res.data.candidates.length : 0);
            
            // Check veto status for Isu Petasys and Alteogen in the response
            if (res.data.candidates) {
                const isu = res.data.candidates.find(c => c.code === '007660');
                const alteogen = res.data.candidates.find(c => c.code === '196170');
                if (isu) {
                    console.log(`이수페타시스 (007660) VETOed: ${isu.isVetoed}, Reason: ${isu.vetoReason}`);
                }
                if (alteogen) {
                    console.log(`알테오젠 (196170) VETOed: ${alteogen.isVetoed}, Reason: ${alteogen.vetoReason}`);
                }
            }
        }
        process.exit(0);
    })
    .catch(err => {
        console.error("\n❌ Cache test failed:", err.message);
        process.exit(1);
    });
