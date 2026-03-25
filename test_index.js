import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const KIS_BASE_URL = 'https://openapi.koreainvestment.com:9443';
const APP_KEY = process.env.VITE_KIS_APP_KEY;
const APP_SECRET = process.env.VITE_KIS_APP_SECRET;

async function testIndexChart() {
    try {
        console.log('Fetching token...');
        const tokenRes = await axios.post(`${KIS_BASE_URL}/oauth2/tokenP`, {
            grant_type: 'client_credentials',
            appkey: APP_KEY,
            appsecret: APP_SECRET
        });
        const token = tokenRes.data.access_token;
        console.log('Token fetched.');

        const tests = [
            { name: 'KOSPI', symbol: '0001' },
            { name: 'KOSDAQ', symbol: '1001' }
        ];

        for (const test of tests) {
            console.log(`\nTesting Index Chart for ${test.name} (${test.symbol})...`);
            try {
                const res = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-index-time-itemchartprice`, {
                    params: {
                        FID_COND_MRKT_DIV_CODE: 'U', // U for Index
                        FID_INPUT_ISCD: test.symbol,
                        FID_INPUT_HOUR_1: '153000',
                        FID_PW_DATA_INCU_YN: 'Y'
                    },
                    headers: {
                        'authorization': `Bearer ${token}`,
                        'appkey': APP_KEY,
                        'appsecret': APP_SECRET,
                        'tr_id': 'FHKUP03500100'
                    }
                });
                console.log(`Response for ${test.name}:`, res.data.rt_cd === '0' ? 'SUCCESS' : `FAILED: ${res.data.msg1}`);
                if (res.data.output2?.[0]) {
                    console.log('First point:', res.data.output2[0]);
                }
            } catch (e) {
                console.log(`Error for ${test.name}:`, e.response?.data || e.message);
            }
        }

    } catch (e) {
        console.error('Test failed:', e.response?.data || e.message);
    }
}

testIndexChart();
