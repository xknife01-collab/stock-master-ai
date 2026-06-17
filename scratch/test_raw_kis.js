import dotenv from 'dotenv';
dotenv.config();
import { getAccessToken, getKisHeaders, kisRequest, KIS_BASE_URL } from '../lib/kisCore.js';

async function testStockRaw(symbol, name) {
    const token = await getAccessToken();
    const commonHeaders = { ...getKisHeaders(''), 'authorization': `Bearer ${token}` };
    
    console.log(`========================================`);
    console.log(`[RAW KIS TEST] ${name} (${symbol})`);
    console.log(`========================================`);
    
    // 1. inquire-price
    try {
        const priceRes = await kisRequest({
            method: 'get',
            url: `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-price`,
            params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol },
            headers: { ...commonHeaders, 'tr_id': 'FHKST01010100' }
        });
        console.log("1. inquire-price output:");
        console.log(JSON.stringify(priceRes?.data?.output, null, 2));
    } catch (e) {
        console.error("inquire-price failed:", e.message);
    }
    
    // 2. inquire-ccnl
    try {
        const ccnlRes = await kisRequest({
            method: 'get',
            url: `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-ccnl`,
            params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol },
            headers: { ...commonHeaders, 'tr_id': 'FHKST01010300' }
        });
        console.log("2. inquire-ccnl output (first 3 ticks):");
        console.log(JSON.stringify(ccnlRes?.data?.output?.slice(0, 3), null, 2));
    } catch (e) {
        console.error("inquire-ccnl failed:", e.message);
    }
}

async function run() {
    await testStockRaw('000660', 'SK Hynix');
    await testStockRaw('007660', 'Isu Petasys');
}

run();
