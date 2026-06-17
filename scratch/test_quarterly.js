import dotenv from 'dotenv';
dotenv.config();

import { KIS_BASE_URL, getKisHeaders, getAccessToken, kisRequest } from '../lib/kisCore.js';

(async () => {
    try {
        console.log("🚀 Testing KIS API quarterly calls for HPSP (403870)...");
        const token = await getAccessToken();
        const commonHeaders = getKisHeaders('');
        
        console.log("\n1. Calling financial-ratio with FID_DIV_CLS_CODE: '1' (Quarterly)...");
        try {
            const ratioRes = await kisRequest({
                method: 'get',
                url: `${KIS_BASE_URL}/uapi/domestic-stock/v1/finance/financial-ratio`,
                params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: '403870', FID_DIV_CLS_CODE: '1' },
                headers: { ...commonHeaders, 'tr_id': 'FHKST66430300', 'authorization': `Bearer ${token}` }
            });
            console.log("Status Code:", ratioRes.status);
            console.log("Response Data Output (first 2 items):", JSON.stringify(ratioRes.data.output?.slice(0, 2) || ratioRes.data, null, 2));
        } catch (e) {
            console.error("ratioRes Error:", e.message, e.response?.data);
        }

        console.log("\n2. Calling income-statement with FID_DIV_CLS_CODE: '1' (Quarterly)...");
        try {
            const incomeRes = await kisRequest({
                method: 'get',
                url: `${KIS_BASE_URL}/uapi/domestic-stock/v1/finance/income-statement`,
                params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: '403870', FID_DIV_CLS_CODE: '1' },
                headers: { ...commonHeaders, 'tr_id': 'FHKST66430200', 'authorization': `Bearer ${token}` }
            });
            console.log("Status Code:", incomeRes.status);
            console.log("Response Data Output (first 3 items):", JSON.stringify(incomeRes.data.output?.slice(0, 3) || incomeRes.data, null, 2));
        } catch (e) {
            console.error("incomeRes Error:", e.message, e.response?.data);
        }
    } catch (e) {
        console.error("Outer Error:", e);
    }
})();
