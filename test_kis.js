import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const KIS_BASE_URL = 'https://openapi.koreainvestment.com:9443';
const APP_KEY = process.env.VITE_KIS_APP_KEY;
const APP_SECRET = process.env.VITE_KIS_APP_SECRET;

async function test() {
    try {
        console.log('Fetching token...');
        const tokenRes = await axios.post(`${KIS_BASE_URL}/oauth2/tokenP`, {
            grant_type: 'client_credentials',
            appkey: APP_KEY,
            appsecret: APP_SECRET
        });
        const token = tokenRes.data.access_token;
        console.log('Token fetched successfully.');

        const symbol = '005930'; // Samsung Electronics

        console.log(`Trying chart for ${symbol}...`);
        try {
            const res = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice`, {
                params: {
                    FID_COND_MRKT_DIV_CODE: 'J',
                    FID_INPUT_ISCD: symbol,
                    FID_INPUT_DATE_1: '20230101',
                    FID_INPUT_DATE_2: new Date().toISOString().slice(0, 10).replace(/-/g, ''),
                    FID_PERIOD_DIV_CODE: 'D',
                    FID_ORG_ADJ_PRC: '0'
                },
                headers: {
                    'authorization': `Bearer ${token}`,
                    'appkey': APP_KEY,
                    'appsecret': APP_SECRET,
                    'tr_id': 'FHKST03010100'
                }
            });
            console.log('Chart API Response:', JSON.stringify(res.data, null, 2).substring(0, 500) + '...');
            if (res.data.rt_cd === '0') {
                console.log('Chart API: SUCCESS');
            } else {
                console.log('Chart API: FAILED with rt_cd', res.data.rt_cd, res.data.msg1);
            }
        } catch (e) {
            console.log('Chart API: ERROR', e.response?.data || e.message);
        }

    } catch (e) {
        console.error('Test failed:', e.response?.data || e.message);
    }
}

test();
