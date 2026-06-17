import dotenv from 'dotenv';
dotenv.config();

import axios from 'axios';
import { KIS_BASE_URL, getKisHeaders, getAccessToken } from '../lib/kisCore.js';

async function testIndices() {
    console.log("=== Testing KIS index price endpoint ===");
    try {
        const token = await getAccessToken();
        const codes = [
            { name: 'KOSPI', code: '0001' },
            { name: 'KOSDAQ', code: '1001' },
            { name: 'KOSPI200', code: '2001' }
        ];

        for (const item of codes) {
            console.log(`\nFetching ${item.name} (Code: ${item.code})...`);
            try {
                const response = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-index-price`, {
                    params: { 
                        FID_COND_MRKT_DIV_CODE: 'U', 
                        FID_INPUT_ISCD: item.code,
                        FID_ETC_CLS_CODE: ''
                    },
                    headers: { ...getKisHeaders('FHPUP02100000'), 'authorization': `Bearer ${token}` },
                    timeout: 5000
                });
                console.log(`Response status: ${response.status}`);
                console.log(`Response rt_cd: ${response.data?.rt_cd}, msg1: ${response.data?.msg1}`);
                console.log(`Output:`, response.data?.output);
            } catch (err) {
                console.error(`❌ Error fetching ${item.name}:`, err.message);
                if (err.response) {
                    console.error("Response data:", err.response.data);
                }
            }
        }
    } catch (e) {
        console.error("General error:", e.message);
    }
}

testIndices();
