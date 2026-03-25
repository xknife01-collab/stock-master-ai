import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const KIS_BASE_URL = 'https://openapi.koreainvestment.com:9443';
const APP_KEY = process.env.VITE_KIS_APP_KEY;
const APP_SECRET = process.env.VITE_KIS_APP_SECRET;

async function testIntradayChart() {
    try {
        console.log('Fetching token...');
        const tokenRes = await axios.post(`${KIS_BASE_URL}/oauth2/tokenP`, {
            grant_type: 'client_credentials',
            appkey: APP_KEY,
            appsecret: APP_SECRET
        });
        const token = tokenRes.data.access_token;
        console.log('Token fetched.');

        const symbol = '005930';
        console.log(`\nTesting Intraday Chart for ${symbol}...`);
        try {
            const res = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-time-itemchartprice`, {
                params: {
                    FID_COND_MRKT_DIV_CODE: 'J',
                    FID_INPUT_ISCD: symbol,
                    FID_INPUT_HOUR_1: '153000',
                    FID_PW_DATA_INCU_YN: 'Y'
                },
                headers: {
                    'authorization': `Bearer ${token}`,
                    'appkey': APP_KEY,
                    'appsecret': APP_SECRET,
                    'tr_id': 'FHKST03010200'
                }
            });
            console.log(`Response:`, res.data.rt_cd === '0' ? 'SUCCESS' : `FAILED: ${res.data.msg1}`);
            if (res.data.output2?.[0]) {
                console.log('Sample data (latest):', res.data.output2[0]);
            }
        } catch (e) {
            console.log(`Error:`, e.response?.data || e.message);
        }

    } catch (e) {
        console.error('Test failed:', e.response?.data || e.message);
    }
}

testIntradayChart();
