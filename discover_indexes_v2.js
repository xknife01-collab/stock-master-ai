import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const KIS_BASE_URL = 'https://openapi.koreainvestment.com:9443';

async function discover() {
    const tokenRes = await axios.post(`${KIS_BASE_URL}/oauth2/tokenP`, {
        grant_type: 'client_credentials',
        appkey: process.env.VITE_KIS_APP_KEY,
        appsecret: process.env.VITE_KIS_APP_SECRET
    });
    const token = tokenRes.data.access_token;
    
    const codes = ['0001', '1001', '0002', '101', '201'];
    for (const code of codes) {
        try {
            const res = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-index-price`, {
                params: { FID_COND_MRKT_DIV_CODE: 'U', FID_INPUT_ISCD: code },
                headers: {
                    'authorization': `Bearer ${token}`,
                    'appkey': process.env.VITE_KIS_APP_KEY,
                    'appsecret': process.env.VITE_KIS_APP_SECRET,
                    'tr_id': 'FHPUP02100000'
                }
            });
            const d = res.data.output;
            console.log(`Code ${code}: Name=${d?.bstp_nm}, Price=${d?.bstp_nmix_prpr}, Change=${d?.bstp_nmix_prdy_ctrt}`);
        } catch (e) {
            console.log(`Code ${code}: Error ${e.message}`);
        }
    }
}
discover();
