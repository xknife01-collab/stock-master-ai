import axios from 'axios';

async function test() {
    console.log("📡 Querying stock daily history for 005930 (Samsung Electronics)...");
    try {
        const res = await axios.get('http://localhost:5000/api/stock/history/005930?range=1M');
        console.log("✅ Response received successfully!");
        console.log("Data count:", res.data.length);
        if (res.data.length > 0) {
            console.log("First item:", res.data[0]);
            console.log("Last item:", res.data[res.data.length - 1]);
        }
    } catch (e) {
        console.error("❌ Test Failed:", e.message);
    }
}

test();
