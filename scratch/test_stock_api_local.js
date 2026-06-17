import router from '../routes/stockApi.js';
import dotenv from 'dotenv';
dotenv.config();

// Helper to mock req and res
function mockRes(resolve, reject) {
    return {
        status: function(code) {
            this.statusCode = code;
            return this;
        },
        json: function(data) {
            resolve({ statusCode: this.statusCode || 200, data });
        },
        send: function(msg) {
            resolve({ statusCode: this.statusCode || 200, data: msg });
        }
    };
}

async function testPrice(symbol) {
    console.log(`\n🔍 Testing GET /${symbol} (Current Price)...`);
    const route = router.stack.find(s => s.route && s.route.path === '/:symbol');
    if (!route) {
        console.error("Could not find /:symbol route");
        return;
    }
    const handler = route.route.stack[0].handle;
    
    const req = { params: { symbol } };
    const p = new Promise((resolve, reject) => {
        const res = mockRes(resolve, reject);
        handler(req, res).catch(reject);
    });
    
    const t0 = Date.now();
    const result = await p;
    console.log(`Duration: ${Date.now() - t0}ms`);
    console.log(`Status: ${result.statusCode}`);
    console.log(`Data:`, result.data);
}

async function testHistory(symbol, range) {
    console.log(`\n📊 Testing GET /history/${symbol}?range=${range}...`);
    const route = router.stack.find(s => s.route && s.route.path === '/history/:symbol');
    if (!route) {
        console.error("Could not find /history/:symbol route");
        return;
    }
    const handler = route.route.stack[0].handle;
    
    const req = { params: { symbol }, query: { range } };
    const p = new Promise((resolve, reject) => {
        const res = mockRes(resolve, reject);
        handler(req, res).catch(reject);
    });
    
    const t0 = Date.now();
    const result = await p;
    console.log(`Duration: ${Date.now() - t0}ms`);
    console.log(`Status: ${result.statusCode}`);
    console.log(`Data count: ${Array.isArray(result.data) ? result.data.length : 'Not an array'}`);
    if (Array.isArray(result.data) && result.data.length > 0) {
        console.log(`First point:`, result.data[0]);
        console.log(`Last point:`, result.data[result.data.length - 1]);
    } else {
        console.log(`Data:`, result.data);
    }
}

async function run() {
    try {
        // Test Samsung (should have cache hit)
        await testPrice('005930');
        
        // Test HPSP history 1D (should have cache hit)
        await testHistory('403870', '1D');
        
        // Test a non-existent cache symbol to verify sync single stock on demand
        // Let's use Kia (000270) or another symbol
        await testPrice('000270');
        await testHistory('000270', '1M');
        
        console.log("\n✅ Local Route Handler verification completed.");
        process.exit(0);
    } catch (err) {
        console.error("Error during execution:", err);
        process.exit(1);
    }
}

run();
