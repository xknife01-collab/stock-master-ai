import router from '../routes/stockApi.js';
import dotenv from 'dotenv';
dotenv.config();

function mockRes(resolve, reject) {
    return {
        statusCode: 200,
        status: function(code) {
            this.statusCode = code;
            return this;
        },
        json: function(data) {
            resolve({ statusCode: this.statusCode, data });
        },
        send: function(msg) {
            resolve({ statusCode: this.statusCode, data: msg });
        }
    };
}

async function testDetail(symbol) {
    console.log(`\n🔍 Testing GET /detail/${symbol}...`);
    const route = router.stack.find(s => s.route && s.route.path === '/detail/:symbol');
    if (!route) {
        console.error("Could not find /detail/:symbol route");
        return;
    }
    const handler = route.route.stack[route.route.stack.length - 1].handle;
    
    const req = { params: { symbol }, query: {} };
    const p = new Promise((resolve, reject) => {
        const res = mockRes(resolve, reject);
        handler(req, res).catch(reject);
    });
    
    const t0 = Date.now();
    const result = await p;
    console.log(`Duration: ${Date.now() - t0}ms`);
    console.log(`Status: ${result.statusCode}`);
    
    if (result.data && result.data.fundamental) {
        const f = result.data.fundamental;
        console.log(`Name: ${f.name}`);
        console.log(`Sector: ${f.sector}`);
        console.log(`PER: ${f.per}, PBR: ${f.pbr}, ROE: ${f.roe}`);
        if (f.advanced) {
            const inv = f.advanced.investor;
            console.log(`Investor Info:`);
            console.log(` - isRealtime: ${inv?.isRealtime}`);
            console.log(` - isTodayData: ${inv?.isTodayData}`);
            console.log(` - foreign1D: ${inv?.foreign1D}, organ1D: ${inv?.organ1D}, personal1D: ${inv?.personal1D}`);
            console.log(` - dailyHistory length: ${inv?.dailyHistory?.length || 0}`);
            if (inv?.dailyHistory?.length > 0) {
                console.log(` - Latest History Date: ${inv.dailyHistory[0].date}`);
            }
        }
    } else {
        console.log(`Data:`, result.data);
    }
}

async function run() {
    try {
        // 1. 삼성전자 테스트 (정상 캐시/KIS 동기화)
        await testDetail('005930');
        
        // 2. 파마리서치 테스트 (정상 캐시/KIS 동기화)
        await testDetail('214450');
        
        // 3. 존재하지 않는 더미 기호 테스트 (디재스터 복구 플레이스홀더 테스트)
        await testDetail('999999');
        
        console.log("\n✅ Detail local endpoint tests completed.");
        process.exit(0);
    } catch (err) {
        console.error("Error during execution:", err);
        process.exit(1);
    }
}

run();
