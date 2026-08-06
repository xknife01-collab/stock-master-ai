import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const KIS_BASE_URL = 'https://openapi.koreainvestment.com:9443';

async function verifyIndexCodes() {
    try {
        const tokenRes = await axios.post(`${KIS_BASE_URL}/oauth2/tokenP`, {
            grant_type: 'client_credentials',
            appkey: process.env.VITE_KIS_APP_KEY,
            appsecret: process.env.VITE_KIS_APP_SECRET
        });
        const token = tokenRes.data.access_token;
        console.log('Token fetched.');

        const tests = [
            { code: '0001', market: 'U' },
            { code: '1001', market: 'U' },
            { code: '2001', market: 'U' },
            { code: '001', market: 'U' },
            { code: '101', market: 'U' },
            { code: '201', market: 'U' }
        ];

        for (const test of tests) {
            try {
                const res = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-index-price`, {
                    params: { fid_cond_mrkt_div_code: test.market, fid_input_iscd: test.code },
                    headers: {
                        'authorization': `Bearer ${token}`,
                        'appkey': process.env.VITE_KIS_APP_KEY,
                        'appsecret': process.env.VITE_KIS_APP_SECRET,
                        'tr_id': 'FHPST01300000'
                    }
                });
                if (res.data.output) {
                    console.log(`Code ${test.code}: ${res.data.output.bstp_nm || 'NO NAME'} -> Price: ${res.data.output.bstp_nm_prpr || 'NO PRICE'}`);
                } else {
                    console.log(`Code ${test.code}: NO OUTPUT. Body:`, JSON.stringify(res.data));
                }
            } catch (e) {
                console.log(`Code ${test.code}: ERROR ${e.message}`);
            }
        }
    } catch (e) {
        console.error('Master fetch failed:', e.message);
    }
}

verifyIndexCodes();
