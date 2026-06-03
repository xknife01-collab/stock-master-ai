import axios from 'axios';

async function test() {
    try {
        const response = await axios.get('http://localhost:5000/api/stock-detail/detail/000660');
        console.log("STATUS:", response.status);
        console.log("RESPONSE DATA KEYS:", Object.keys(response.data));
        if (response.data.fundamental) {
            console.log("FUNDAMENTAL KEYS:", Object.keys(response.data.fundamental));
            console.log("ADVANCED DATA:", response.data.fundamental.advanced);
        } else {
            console.log("No fundamental key found.");
        }
    } catch (e) {
        console.error("Error:", e.response?.status || e.message, e.response?.data);
    }
}

test();
