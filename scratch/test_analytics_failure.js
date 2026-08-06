import dotenv from 'dotenv';
dotenv.config();
import { KIS_BASE_URL, getAccessToken, getKisHeaders, kisRequest } from '../lib/kisCore.js';

async function main() {
    try {
        const token = await getAccessToken(0);
        const symbol = "032980"; // KOSDAQ stock
        const commonHeaders = { ...getKisHeaders(''), 'authorization': `Bearer ${token}` };

        console.log("=== Testing Individual KIS Analytics Endpoints ===");

        // Test 1: income-statement
        console.log("\n1. Testing income-statement (FHKST66430200)...");
        try {
            const res = await kisRequest({
                method: 'get',
                url: `${KIS_BASE_URL}/uapi/domestic-stock/v1/finance/income-statement`,
                params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol, FID_DIV_CLS_CODE: '0' },
                headers: { ...commonHeaders, 'tr_id': 'FHKST66430200' }
            });
            console.log("✅ Success! Status:", res.status, "Data size:", JSON.stringify(res.data).length);
        } catch (e) {
            console.error("❌ Failed income-statement:", e.message);
            if (e.response) console.error("Response data:", e.response.data);
        }

        // Test 2: inquire-daily-itemchartprice
        console.log("\n2. Testing inquire-daily-itemchartprice (FHKST03010100)...");
        try {
            const res = await kisRequest({
                method: 'get',
                url: `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice`,
                params: {
                    FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol,
                    FID_INPUT_DATE_1: new Date(Date.now() - 30 * 86400000).toISOString().slice(0,10).replace(/-/g,''),
                    FID_INPUT_DATE_2: new Date().toISOString().slice(0,10).replace(/-/g,''),
                    FID_PERIOD_DIV_CODE: 'D', FID_ORG_ADJ_PRC: '1'
                },
                headers: { ...commonHeaders, 'tr_id': 'FHKST03010100' }
            });
            console.log("✅ Success! Status:", res.status, "Data size:", JSON.stringify(res.data).length);
        } catch (e) {
            console.error("❌ Failed inquire-daily-itemchartprice:", e.message);
            if (e.response) console.error("Response data:", e.response.data);
        }

        // Test 3: inquire-ccnl
        console.log("\n3. Testing inquire-ccnl (FHKST01010300)...");
        try {
            const res = await kisRequest({
                method: 'get',
                url: `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-ccnl`,
                params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol },
                headers: { ...commonHeaders, 'tr_id': 'FHKST01010300' }
            });
            console.log("✅ Success! Status:", res.status, "Data size:", JSON.stringify(res.data).length);
        } catch (e) {
            console.error("❌ Failed inquire-ccnl:", e.message);
            if (e.response) console.error("Response data:", e.response.data);
        }

        // Test 4: daily-short-sale
        console.log("\n4. Testing daily-short-sale (FHPST04830000)...");
        try {
            const res = await kisRequest({
                method: 'get',
                url: `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/daily-short-sale`,
                params: {
                    FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol,
                    FID_INPUT_DATE_1: new Date(Date.now() - 30 * 86400000).toISOString().slice(0,10).replace(/-/g,''),
                    FID_INPUT_DATE_2: new Date().toISOString().slice(0,10).replace(/-/g,'')
                },
                headers: { ...commonHeaders, 'tr_id': 'FHPST04830000' }
            });
            console.log("✅ Success! Status:", res.status, "Data size:", JSON.stringify(res.data).length);
        } catch (e) {
            console.error("❌ Failed daily-short-sale:", e.message);
            if (e.response) console.error("Response data:", e.response.data);
        }

    } catch (e) {
        console.error("General error:", e.message);
    }
}

main();
