import axios from 'axios';

async function trigger() {
    console.log("📡 Triggering AI Pulse API (http://localhost:5000/api/ai/pulse?force=true)...");
    try {
        const res = await axios.get('http://localhost:5000/api/ai/pulse?force=true', { timeout: 120000 });
        console.log("\n✅ AI Pulse API Response Success!");
        console.log("Time:", res.data.time);
        console.log("\n--- Recommended Stocks ---");
        console.log(JSON.stringify(res.data.data, null, 2));
    } catch (e) {
        console.error("❌ API Trigger Failed:", e.message);
        if (e.response) {
            console.error("Status:", e.response.status);
            console.error("Data:", e.response.data);
        }
    }
}

trigger();
