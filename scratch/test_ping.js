import axios from 'axios';

console.log("Checking /api/ai/history...");
axios.get('http://localhost:5000/api/ai/history')
    .then(res => {
        console.log("✅ Server is active! Status:", res.status);
        console.log("History records count:", res.data?.length || 0);
    })
    .catch(err => {
        console.error("❌ Failed to contact server:", err.message);
    });
