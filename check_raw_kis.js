import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const KIS_BASE_URL = 'https://openapi.koreainvestment.com:9443';
const APP_KEY = process.env.VITE_KIS_APP_KEY;
const APP_SECRET = process.env.VITE_KIS_APP_SECRET;

async function checkRaw() {
    const tokenRes = await axios.post(`${KIS_BASE_URL}/oauth2/tokenP`, {
        grant_type: 'client_credentials',
        appkey: APP_KEY,
        appsecret: APP_SECRET
    });
    const token = tokenRes.data.access_token;
    
    const symbol = '005930';
    console.log('--- Testing Income Statement (FHKST66430200) ---');
    const res = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/finance/income-statement`, {
        params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol, FID_DIV_CLS_CODE: '0' },
        headers: { 
            'authorization': `Bearer ${token}`,
            'appkey': APP_KEY, 'appsecret': APP_SECRET,
            'tr_id': 'FHKST66430200'
        }
    });
    console.log(JSON.stringify(res.data.output?.slice(0, 2), null, 2));

    console.log('\n--- Testing Financial Ratio (FHKST66430300) ---');
    const res2 = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/finance/financial-ratio`, {
        params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol, FID_DIV_CLS_CODE: '0' },
        headers: { 
            'authorization': `Bearer ${token}`,
            'appkey': APP_KEY, 'appsecret': APP_SECRET,
            'tr_id': 'FHKST66430300'
        }
    });
    console.log(JSON.stringify(res2.data.output?.slice(0, 5), null, 2));
}
checkRaw().catch(console.error);
