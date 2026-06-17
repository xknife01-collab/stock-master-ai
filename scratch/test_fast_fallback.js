import axios from 'axios';

async function runTest() {
    console.log("🚀 Testing Local Stock API Endpoints for Caching & Latency...");

    const symbols = ['000270', '005930']; // Kia, Samsung
    const ranges = ['1D', '1M'];

    for (const symbol of symbols) {
        console.log(`\n------------------ [Symbol: ${symbol}] ------------------`);
        
        // 1. Test Price API
        const priceStart = Date.now();
        try {
            const res = await axios.get(`http://localhost:5000/api/stock/${symbol}`);
            const duration = Date.now() - priceStart;
            console.log(`✅ [Price API] Status: ${res.status}, Time: ${duration}ms`);
            console.log(`   Price: ${res.data.price}원, Name: ${res.data.name}`);
        } catch (e) {
            console.error(`❌ [Price API Fail] ${symbol}:`, e.message);
        }

        // 2. Test History API for each range
        for (const range of ranges) {
            const histStart = Date.now();
            try {
                const res = await axios.get(`http://localhost:5000/api/stock/history/${symbol}?range=${range}`);
                const duration = Date.now() - histStart;
                console.log(`✅ [History API - ${range}] Status: ${res.status}, Time: ${duration}ms, Items: ${res.data.length}`);
                if (res.data.length > 0) {
                    console.log(`   First Point: ${JSON.stringify(res.data[0])}`);
                    console.log(`   Last Point: ${JSON.stringify(res.data[res.data.length - 1])}`);
                }
            } catch (e) {
                console.error(`❌ [History API Fail - ${range}] ${symbol}:`, e.message);
            }
        }
    }
    
    // 3. Test Dashboard API
    console.log(`\n------------------ [Dashboard API] ------------------`);
    const dashStart = Date.now();
    try {
        const res = await axios.get(`http://localhost:5000/api/dashboard`);
        const duration = Date.now() - dashStart;
        console.log(`✅ [Dashboard API] Status: ${res.status}, Time: ${duration}ms`);
        console.log(`   Sectors Count: ${res.data.sectors?.length || 0}`);
        console.log(`   Themes Count: ${res.data.themes?.length || 0}`);
        console.log(`   Top Stocks Category count: ${res.data.topStocks?.length || 0}`);
    } catch (e) {
        console.error(`❌ [Dashboard API Fail]:`, e.message);
    }
}

runTest();
