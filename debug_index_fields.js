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
        
        const res = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-daily-indexchartprice`, {
            params: {
                FID_COND_MRKT_DIV_CODE: 'U',
                FID_INPUT_ISCD: '0001',
                FID_INPUT_DATE_1: '20240101',
                FID_INPUT_DATE_2: '20260323',
                FID_PERIOD_DIV_CODE: 'D',
                FID_ORG_ADJ_PRC: '0'
            },
            headers: {
                'authorization': `Bearer ${token}`,
                'appkey': process.env.VITE_KIS_APP_KEY,
                'appsecret': process.env.VITE_KIS_APP_SECRET,
                'tr_id': 'FHKUP03500100'
            }
        });
        console.log('Output1 Keys:', Object.keys(res.data.output1));
        console.log('Output1:', res.data.output1);
    } catch (e) { console.error(e.message); }
}
testIndex();
