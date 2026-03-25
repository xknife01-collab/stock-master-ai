import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const KIS_BASE_URL = 'https://openapi.koreainvestment.com:9443';
const APP_KEY = process.env.VITE_KIS_APP_KEY;
const APP_SECRET = process.env.VITE_KIS_APP_SECRET;

async function testGainerRanking() {
    try {
        console.log('Fetching token...');
        const tokenRes = await axios.post(`${KIS_BASE_URL}/oauth2/tokenP`, {
            grant_type: 'client_credentials',
            appkey: APP_KEY,
            appsecret: APP_SECRET
        });
        const token = tokenRes.data.access_token;
        console.log('Token fetched.');

        console.log(`\nTesting Gainer Ranking (FHPST01700000)...`);
        try {
            const res = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/ranking/fluctuation`, {
                params: {
                    FID_COND_MRKT_DIV_CODE: 'J',
                    FID_COND_SCR_DIV_CODE: '20170',
                    FID_INPUT_ISCD: '0000', // 0000 for total
                    FID_RANK_SORT_CLS_CODE: '0', 
                    FID_INPUT_CNT_1: '0',
                    FID_PRC_CLS_CODE: '0',
                    FID_INPUT_PBMS_1: '0',
                    FID_BLNG_CLS_CODE: '0'
                },
                headers: {
                    'authorization': `Bearer ${token}`,
                    'appkey': APP_KEY,
                    'appsecret': APP_SECRET,
                    'tr_id': 'FHPST01700000'
                }
            });
            console.log(`Response:`, res.data.rt_cd === '0' ? 'SUCCESS' : `FAILED: ${res.data.msg1}`);
            if (res.data.output?.[0]) {
                console.log('First result:', res.data.output[0]);
            }
        } catch (e) {
            console.log(`Error:`, e.response?.data || e.message);
        }

    } catch (e) {
        console.error('Test failed:', e.response?.data || e.message);
    }
}

testGainerRanking();
