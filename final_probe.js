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

        const codes = ['0001', '1001', '2001', '0101', '101', '201'];
        for (const code of codes) {
            try {
                const res = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-index-price`, {
                    params: { fid_cond_mrkt_div_code: 'U', fid_input_iscd: code },
                    headers: {
                        'authorization': `Bearer ${token}`,
                        'appkey': process.env.VITE_KIS_APP_KEY,
                        'appsecret': process.env.VITE_KIS_APP_SECRET,
                        'tr_id': 'FHPST01300000'
                    }
                });
                if (res.data.output) {
                    console.log(`Code ${code}: ${res.data.output.bstp_nm} -> Price: ${res.data.output.bstp_nm_prpr}`);
                } else {
                    console.log(`Code ${code}: FAILED - ${res.data.msg1}`);
                }
            } catch (e) {
                console.log(`Code ${code}: ERROR ${e.message}`);
            }
        }
    } catch (e) {
        console.error('Master check failed:', e.message);
    }
}

testIndexCodes();
