import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const KIS_BASE_URL = 'https://openapi.koreainvestment.com:9443';

async function test() {
    try {
        console.log('🔄 Getting token...');
        const tokenRes = await axios.post(`${KIS_BASE_URL}/oauth2/tokenP`, {
            grant_type: 'client_credentials',
            appkey: process.env.VITE_KIS_APP_KEY,
            appsecret: process.env.VITE_KIS_APP_SECRET
        });
        const token = tokenRes.data.access_token;

        console.log('🔄 Fetching KOSPI (0001)...');
        const res = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-index-price`, {
            params: { 
                FID_COND_MRKT_DIV_CODE: 'U', 
                FID_INPUT_ISCD: '0001',
                FID_ETC_CLS_CODE: ''
            },
            headers: {
                'authorization': `Bearer ${token}`,
                'appkey': process.env.VITE_KIS_APP_KEY,
                'appsecret': process.env.VITE_KIS_APP_SECRET,
                'tr_id': 'FHPUP02100000',
                'custtype': 'P'
            }
        });
        console.log('Response:', JSON.stringify(res.data, null, 2));
    } catch (e) {
        console.error('❌ Error:', e.response?.data || e.message);
    }
}

test();
