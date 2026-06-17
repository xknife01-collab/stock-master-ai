import fs from 'fs';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const KIS_BASE_URL = 'https://openapi.koreainvestment.com:9443';

async function testIndex() {
    try {
        const saved = JSON.parse(fs.readFileSync('./kis_token.json', 'utf8'));
        const token = saved.accessToken;
        
        const response = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-index-price`, {
            params: { 
                FID_COND_MRKT_DIV_CODE: 'U', 
                FID_INPUT_ISCD: '0001',
                FID_ETC_CLS_CODE: ''
            },
            headers: {
                'authorization': `Bearer ${token}`,
                'appkey': process.env.VITE_KIS_APP_KEY,
                'appsecret': process.env.VITE_KIS_APP_SECRET,
                'tr_id': 'FHPUP02100000'
            }
        });
        console.log('KOSPI RAW OUTPUT:', response.data);
    } catch (e) {
        console.error('Test index query failed:', e.message, e.response?.data);
    }
}
testIndex();
