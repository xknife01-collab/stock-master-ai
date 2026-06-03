import axios from 'axios';
import dotenv from 'dotenv';
import { getAccessToken, getKisHeaders, KIS_BASE_URL } from '../lib/kisCore.js';

dotenv.config();

async function run() {
    try {
        const token = await getAccessToken();
        const headers = {
            'authorization': `Bearer ${token}`,
            'appkey': process.env.VITE_KIS_APP_KEY,
            'appsecret': process.env.VITE_KIS_APP_SECRET,
            'custtype': 'P'
        };

        console.log('📡 [Querying FHKST01010100 - inquire-price]...');
        const priceRes = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-price`, {
            params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: '007660' },
            headers: { ...headers, tr_id: 'FHKST01010100' }
        });

        console.log('Output keys from inquire-price:', Object.keys(priceRes.data.output || {}));
        console.log('tday_rltv in inquire-price:', priceRes.data.output?.tday_rltv);
        console.log('vol_power in inquire-price:', priceRes.data.output?.vol_power);

        console.log('\n📡 [Querying FHKST01010300 - inquire-ccnl]...');
        const ccnlRes = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-ccnl`, {
            params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: '007660' },
            headers: { ...headers, tr_id: 'FHKST01010300' }
        });

        const outputArray = ccnlRes.data.output || [];
        console.log('Output length from inquire-ccnl:', outputArray.length);
        if (outputArray.length > 0) {
            console.log('First item keys in inquire-ccnl:', Object.keys(outputArray[0]));
            console.log('First item tday_rltv in inquire-ccnl:', outputArray[0].tday_rltv);
            console.log('First item ccnl_power in inquire-ccnl:', outputArray[0].ccnl_power);
        }
    } catch (e) {
        console.error('Error running test:', e.message);
    }
}

run();
