import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const KIS_BASE_URL = 'https://openapi.koreainvestment.com:9443';

async function testFluctuation() {
    try {
        const tokenRes = await axios.post(`${KIS_BASE_URL}/oauth2/tokenP`, {
            grant_type: 'client_credentials',
            appkey: process.env.VITE_KIS_APP_KEY,
            appsecret: process.env.VITE_KIS_APP_SECRET
        });
        const token = tokenRes.data.access_token;
        console.log('Token fetched.');

        const tests = [
            { name: 'Fluctuation', url: '/uapi/domestic-stock/v1/ranking/fluctuation', tr: 'FHPST01700000' },
            { name: 'Volume', url: '/uapi/domestic-stock/v1/ranking/volume', tr: 'FHPST01710000' }
        ];

        for (const test of tests) {
            console.log(`\nTesting ${test.name} (${test.url})...`);
            try {
                const res = await axios.get(`${KIS_BASE_URL}${test.url}`, {
                    params: {
                        FID_COND_MRKT_DIV_CODE: 'J',
                        FID_COND_SCR_DIV_CODE: test.tr.substring(5, 10), // Example: 01700
                        FID_INPUT_ISCD: '0000',
                        FID_RANK_SORT_CLS_CODE: '0',
                        FID_INPUT_CNT_1: '0',
                        FID_PRC_CLS_CODE: '0',
                        FID_INPUT_PBMS_1: '0',
                        FID_BLNG_CLS_CODE: '0',
                        FID_DIFF_VOL1: '0',
                        FID_INPUT_PRICE_1: '0',
                        FID_INPUT_PRICE_2: '0'
                    },
                    headers: {
                        'authorization': `Bearer ${token}`,
                        'appkey': process.env.VITE_KIS_APP_KEY,
                        'appsecret': process.env.VITE_KIS_APP_SECRET,
                        'tr_id': test.tr
                    }
                });
                console.log(`Response Code:`, res.data.rt_cd === '0' ? 'SUCCESS' : `FAILED: ${res.data.msg1}`);
                if (res.data.output?.[0]) {
                    console.log('Sample data:', res.data.output[0]);
                }
            } catch (e) {
                console.log(`Error:`, e.response?.data || e.message);
            }
        }
    } catch (e) {
        console.error('Test failed:', e.response?.data || e.message);
    }
}

testFluctuation();
