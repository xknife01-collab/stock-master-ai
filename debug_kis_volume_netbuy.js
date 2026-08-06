import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const KIS_BASE_URL = 'https://openapi.koreainvestment.com:9443';

async function testVolumeAsNetBuy() {
    try {
        const tokenRes = await axios.post(`${KIS_BASE_URL}/oauth2/tokenP`, {
            grant_type: 'client_credentials',
            appkey: process.env.VITE_KIS_APP_KEY,
            appsecret: process.env.VITE_KIS_APP_SECRET
        });
        const token = tokenRes.data.access_token;
        console.log('Token fetched.');

        console.log('Testing /uapi/domestic-stock/v1/ranking/volume with FHPST01710000...');
        const res = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/ranking/volume`, {
            params: {
                FID_COND_MRKT_DIV_CODE: 'J',
                FID_COND_SCR_DIV_CODE: '20171',
                FID_INPUT_ISCD: '0000',
                FID_RANK_SORT_CLS_CODE: '0', // Net Buy
                FID_PRC_CLS_CODE: '0',
                FID_INPUT_CNT_1: '0',
                FID_INPUT_PBMS_1: '0',
                FID_BLNG_CLS_CODE: '0',
                FID_VOL_CNT: '0',
                FID_TRGT_CLS_CODE: '0',
                FID_TRGT_EXLS_CLS_CODE: '0'
            },
            headers: {
                'authorization': `Bearer ${token}`,
                'appkey': process.env.VITE_KIS_APP_KEY,
                'appsecret': process.env.VITE_KIS_APP_SECRET,
                'tr_id': 'FHPST01710000'
            }
        });
        console.log('Status:', res.status);
        console.log('Body:', JSON.stringify(res.data));
    } catch (e) {
        console.log('Error:', e.response?.data || e.message);
    }
}
testVolumeAsNetBuy();
