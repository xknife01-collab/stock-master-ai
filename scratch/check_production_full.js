import axios from 'axios';

async function check() {
    try {
        const response = await axios.get('https://stock-master-ai.onrender.com/api/ai/history');
        console.log("HISTORY COUNT:", response.data.length);
        response.data.slice(0, 10).forEach((entry, idx) => {
             console.log(`[${idx}] Time: ${entry.time} | Theme: ${entry.prediction?.theme} | Stock: ${entry.prediction?.stock}`);
        });
    } catch (e) {
        console.error("Error:", e.message);
    }
}

check();
