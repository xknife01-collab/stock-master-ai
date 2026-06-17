import axios from 'axios';

console.log("⚡ Starting verification: Calling /api/ai/pulse?force=true...");
const start = Date.now();

axios.get('http://localhost:5000/api/ai/pulse?force=true', { timeout: 60000 })
    .then(res => {
        const duration = ((Date.now() - start) / 1000).toFixed(2);
        console.log(`✅ Success! Response received in ${duration} seconds.`);
        console.log("Status:", res.status);
        console.log("Signal keys:", Object.keys(res.data || {}));
        if (res.data?.aiSignal) {
            console.log("AI Signal Summary:");
            console.log("- Stress Score:", res.data.aiSignal.stressScore);
            console.log("- Top Picks Count:", res.data.aiSignal.topPicks?.length || 0);
            console.log("- Top Picks:", res.data.aiSignal.topPicks?.map(p => `${p.name} (${p.code})`) || []);
        } else {
            console.log("No AI Signal found in response:", res.data);
        }
    })
    .catch(err => {
        const duration = ((Date.now() - start) / 1000).toFixed(2);
        console.error(`❌ Request failed in ${duration} seconds:`, err.message);
        if (err.response) {
            console.error("Response data:", err.response.data);
        }
    });
