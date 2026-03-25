import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const KIS_BASE_URL = 'https://openapi.koreainvestment.com:9443';

async function testIndex() {
    try {
        const tokenRes = await axios.post(`${KIS_BASE_URL}/oauth2/tokenP`, {
            grant_type: 'client_credentials',
            appkey: process.env.VITE_KIS_APP_KEY,
            appsecret: process.env.VITE_KIS_APP_SECRET
        });
        const token = tokenRes.data.access_token;
        
        console.log('Testing FHPST01300000 for 0001...');
        const res = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-index-price`, {
            params: { fid_cond_mrkt_div_code: 'U', fid_input_iscd: '0001' },
            headers: {
                'authorization': `Bearer ${token}`,
                'appkey': process.env.VITE_KIS_APP_KEY,
                'appsecret': process.env.VITE_KIS_APP_SECRET,
                'tr_id': 'FHPST01300000'
            }
        });
        console.log('Response Keys:', Object.keys(res.data));
        console.log('Output:', JSON.stringify(res.data.output, null, 2));
    } catch (e) {
        console.error(e.response?.data || e.message);
    }
}
testIndex();
