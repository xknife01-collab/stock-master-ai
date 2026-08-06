import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const KIS_BASE_URL = 'https://openapi.koreainvestment.com:9443';

async function testStandardPrice() {
    const tokenObj = JSON.parse(fs.readFileSync('./kis_token.json', 'utf8'));
    const token = tokenObj.accessToken;

    try {
        const res = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-index-price`, {
            params: { 
                FID_COND_MRKT_DIV_CODE: 'U', 
                FID_INPUT_ISCD: '0001'
            },
            headers: {
                'authorization': `Bearer ${token}`,
                'appkey': process.env.VITE_KIS_APP_KEY,
                'appsecret': process.env.VITE_KIS_APP_SECRET,
                'tr_id': 'FHKUP03500100',
                'custtype': 'P'
            }
        });
        console.log('--- Full Response for FHKUP03500100 ---');
        console.log(JSON.stringify(res.data, null, 2));
    } catch (e) {
        console.error(e.message);
    }
}
testStandardPrice();
