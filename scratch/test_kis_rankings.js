import dotenv from 'dotenv';
dotenv.config();

import axios from 'axios';
import { KIS_BASE_URL, getKisHeaders, getAccessToken } from '../lib/kisCore.js';

async function testRankings() {
    console.log("=== Testing KIS Foreign/Institution Rankings ===");
    try {
        const token = await getAccessToken();

        const runs = [
            { label: "Foreign Buy", investor: "9000", type: "buy" },
            { label: "Foreign Sell", investor: "9000", type: "sell" },
            { label: "Institution Buy", investor: "1000", type: "buy" },
            { label: "Institution Sell", investor: "1000", type: "sell" }
        ];

        for (const item of runs) {
            console.log(`\n--- Fetching ${item.label} ---`);
            const params = {
                FID_COND_MRKT_DIV_CODE: 'V', 
                FID_COND_SCR_DIV_CODE: '16449',
                FID_INPUT_ISCD: '0000', 
                FID_DIV_CLS_CODE: '1',
                FID_RANK_SORT_CLS_CODE: item.type === 'buy' ? '0' : '1',
                FID_ETC_CLS_CODE: item.investor === '9000' ? '1' : '2'
            };
            console.log("Params:", params);

            try {
                const response = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/foreign-institution-total`, {
                    params: params,
                    headers: { ...getKisHeaders('FHPTJ04400000'), 'authorization': `Bearer ${token}` },
                    timeout: 5000
                });
                console.log(`Response rt_cd: ${response.data?.rt_cd}, msg1: ${response.data?.msg1}`);
                if (response.data?.output && response.data.output.length > 0) {
                    console.log(`Successfully fetched ${response.data.output.length} items.`);
                    console.log("First item:", response.data.output[0]);
                } else {
                    console.log("❌ Response output empty:", response.data);
                }
            } catch (err) {
                console.error(`❌ Error: ${err.message}`);
                if (err.response) {
                    console.error("Response:", err.response.data);
                }
            }
            // Sleep to avoid rate limit
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    } catch (e) {
        console.error("General error:", e.message);
    }
}

testRankings();
