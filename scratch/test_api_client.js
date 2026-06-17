import axios from 'axios';

async function run() {
    const symbol = '000660'; // SK Hynix
    const url = `http://localhost:5000/api/stock/history/${symbol}?range=1D`;
    
    console.log(`\n🚀 Sending request to backend history API: ${url}`);
    
    const startTime = Date.now();
    try {
        const response = await axios.get(url);
        const duration = Date.now() - startTime;
        
        console.log(`✅ Request succeeded in ${duration}ms!`);
        console.log(`- Status code: ${response.status}`);
        console.log(`- Data points returned: ${response.data.length}`);
        if (response.data.length > 0) {
            console.log(`- First point:`, response.data[0]);
            console.log(`- Last point:`, response.data[response.data.length - 1]);
        }
        
        if (duration < 100) {
            console.log(`🥇 Blazing fast! Served under 100ms: ${duration}ms`);
        } else {
            console.warn(`⚠️ Took longer than 100ms: ${duration}ms`);
        }
    } catch (e) {
        console.error(`❌ Request failed:`, e.message);
        if (e.response) {
            console.error(`- Response status: ${e.response.status}`);
            console.error(`- Response data:`, e.response.data);
        }
    }
}

run();
