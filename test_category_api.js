import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const KIS_BASE_URL = 'https://openapi.koreainvestment.com:9443';

async function testCategory() {
    const tokenObj = JSON.parse(fs.readFileSync('./kis_token.json', 'utf8'));
    const token = tokenObj.accessToken;

    try {
        const res = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-index-category-price`, {
            params: { 
                FID_COND_MRKT_DIV_CODE: 'U', 
                FID_INPUT_ISCD: '0001',
                FID_COND_SCR_DIV_CODE: '20214',
                FID_MRKT_CLS_CODE: 'K',
                FID_BLNG_CLS_CODE: '0'
            },
            headers: {
                'authorization': `Bearer ${token}`,
                'appkey': process.env.VITE_KIS_APP_KEY,
                'appsecret': process.env.VITE_KIS_APP_SECRET,
                'tr_id': 'FHPUP02140000',
                'custtype': 'P'
            }
        });
        console.log('--- Full Response Output for Category 0001 ---');
        console.log(JSON.stringify(res.data.output1, null, 2));
        if (res.data.output2) {
             console.log('First Item in Output2:');
             console.log(JSON.stringify(res.data.output2[0], null, 2));
        }
    } catch (e) {
        console.error(e.message);
    }
}
testCategory();
