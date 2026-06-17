import axios from 'axios';

async function check() {
    try {
        console.log("📡 Querying backend /api/stock/history/KOSPI?range=1D...");
        const res = await axios.get('http://localhost:5000/api/stock/history/KOSPI?range=1D');
        console.log(`✅ Success! Received ${res.data?.length} points.`);
        console.log("Sample points:", res.data?.slice(0, 10));
    } catch (e) {
        console.error("❌ Request failed:", e.message, e.response?.data);
    }
}

check();
