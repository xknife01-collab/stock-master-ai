import dotenv from 'dotenv';
dotenv.config();

import { KIS_BASE_URL, getKisHeaders, getAccessToken, kisRequest } from '../lib/kisCore.js';

(async () => {
    try {
        console.log("🚀 Testing direct KIS API financial calls for Samsung (005930)...");
        const token = await getAccessToken();
        const commonHeaders = getKisHeaders('');
        
        console.log("\n1. Calling financial-ratio (FHKST66430300)...");
        try {
            const tok1 = await getAccessToken();
            console.log("Token used for first request:", tok1.slice(0, 20) + "...");
            const ratioRes = await kisRequest({
                method: 'get',
                url: `${KIS_BASE_URL}/uapi/domestic-stock/v1/finance/financial-ratio`,
                params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: '005930', FID_DIV_CLS_CODE: '0' },
                headers: { ...commonHeaders, 'tr_id': 'FHKST66430300', 'authorization': `Bearer ${tok1}` }
            });
            console.log("Status Code:", ratioRes.status);
            console.log("Response Data Output:", JSON.stringify(ratioRes.data.output?.[0] || ratioRes.data, null, 2));
        } catch (e) {
            console.error("ratioRes Error:", e.message, e.response?.data);
        }

        console.log("\n2. Calling income-statement (FHKST66430200)...");
        try {
            const tok2 = await getAccessToken();
            console.log("Token used for second request:", tok2.slice(0, 20) + "...");
            const incomeRes = await kisRequest({
                method: 'get',
                url: `${KIS_BASE_URL}/uapi/domestic-stock/v1/finance/income-statement`,
                params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: '005930', FID_DIV_CLS_CODE: '0' },
                headers: { ...commonHeaders, 'tr_id': 'FHKST66430200', 'authorization': `Bearer ${tok2}` }
            });
            console.log("Status Code:", incomeRes.status);
            console.log("Response Data Output:", JSON.stringify(incomeRes.data.output?.slice(0, 2) || incomeRes.data, null, 2));
        } catch (e) {
            console.error("incomeRes Error:", e.message, e.response?.data);
        }
    } catch (e) {
        console.error("Outer Error:", e);
    }
})();
