import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const KIS_BASE_URL = 'https://openapi.koreainvestment.com:9443';

async function testIndexCodes() {
    try {
        const tokenRes = await axios.post(`${KIS_BASE_URL}/oauth2/tokenP`, {
            grant_type: 'client_credentials',
            appkey: process.env.VITE_KIS_APP_KEY,
            appsecret: process.env.VITE_KIS_APP_SECRET
        });
        const token = tokenRes.data.access_token;
        console.log('Token fetched.');

        const codes = ['001', '009', '013', '1001'];
        for (const code of codes) {
            console.log(`\nTesting Index Code: ${code}...`);
            const res = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-index-price`, {
                params: {
                    fid_cond_mrkt_div_code: code === '1001' ? 'U' : 'U',
                    fid_input_iscd: code
                },
                headers: {
                    'authorization': `Bearer ${token}`,
                    'appkey': process.env.VITE_KIS_APP_KEY,
                    'appsecret': process.env.VITE_KIS_APP_SECRET,
                    'tr_id': 'FHPST01300000'
                }
            });
            console.log(`Status for ${code}: ${res.status}`);
            console.log(`Body for ${code}:`, JSON.stringify(res.data.output));
        }
    } catch (e) {
        console.error('Test failed:', e.response?.data || e.message);
    }
}
testIndexCodes();
