import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const KIS_BASE_URL = 'https://openapi.koreainvestment.com:9443';

async function testV2() {
    try {
        const tokenRes = await axios.post(`${KIS_BASE_URL}/oauth2/tokenP`, {
            grant_type: 'client_credentials', appkey: process.env.VITE_KIS_APP_KEY, appsecret: process.env.VITE_KIS_APP_SECRET
        });
        const token = tokenRes.data.access_token;

        const codes = ['0001', '1001', '2001', '001', '101', '201'];
        for (const code of codes) {
            try {
                const res = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-time-indexchartprice`, {
                    params: { FID_COND_MRKT_DIV_CODE: 'U', FID_INPUT_ISCD: code, FID_INPUT_HOUR_1: '153000', FID_PW_DATA_INCU_YN: 'Y' },
                    headers: { 'authorization': `Bearer ${token}`, 'appkey': process.env.VITE_KIS_APP_KEY, 'appsecret': process.env.VITE_KIS_APP_SECRET, 'tr_id': 'FHKUP03500100' }
                });
                if (res.data.output2?.[0]) {
                    console.log(`Code ${code}: ${res.data.output1.bstp_nm} -> Price: ${res.data.output2[0].stck_prpr || res.data.output2[0].output_prpr}`);
                } else {
                    console.log(`Code ${code}: FAILED - ${res.data.msg1}`);
                }
            } catch (e) {
                console.log(`Code ${code}: ERROR ${e.message}`);
            }
        }
    } catch (e) { console.error(e.message); }
}
testV2();
