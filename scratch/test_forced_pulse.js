import axios from 'axios';

async function test() {
    try {
        console.log("Triggering forced pulse on production server...");
        const start = Date.now();
        const response = await axios.get('https://stock-master-ai.onrender.com/api/ai/pulse?force=true', { timeout: 90000 });
        const duration = ((Date.now() - start) / 1000).toFixed(1);
        console.log(`Done in ${duration} seconds.`);
        console.log("RESPONSE KEYS:", Object.keys(response.data));
        console.log("time:", response.data.time);
        console.log("error:", response.data.error || "None");
        console.log("data:", JSON.stringify(response.data.data, null, 2));
    } catch (e) {
        console.error("HTTP Error:", e.message);
        if (e.response) {
            console.error("Response data:", e.response.data);
        }
    }
}

test();
