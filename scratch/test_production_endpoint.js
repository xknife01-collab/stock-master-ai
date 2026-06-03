import axios from 'axios';

async function test() {
    try {
        const response = await axios.get('https://stock-master-ai.onrender.com/api/stock-detail/detail/000660');
        console.log("PRODUCTION STATUS:", response.status);
        console.log("PRODUCTION RESPONSE DATA KEYS:", Object.keys(response.data));
        if (response.data.fundamental) {
            console.log("PRODUCTION ADVANCED DATA:", response.data.fundamental.advanced);
        } else {
            console.log("No fundamental key found.");
        }
    } catch (e) {
        console.error("Production Error:", e.response?.status || e.message, e.response?.data);
    }
}

test();
