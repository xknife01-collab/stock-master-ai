import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const KIS_BASE_URL = 'https://openapi.koreainvestment.com:9443';

async function testTimeChart() {
    const tokenObj = JSON.parse(fs.readFileSync('./kis_token.json', 'utf8'));
    const token = tokenObj.accessToken;

    try {
        const res = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-time-indexchartprice`, {
            params: { 
                FID_COND_MRKT_DIV_CODE: 'U', 
                FID_INPUT_ISCD: '0001',
                FID_INPUT_HOUR_1: '60',
                FID_PW_DATA_INCU_YN: 'Y',
                FID_ETC_CLS_CODE: ''
            },
            headers: {
                'authorization': `Bearer ${token}`,
                'appkey': process.env.VITE_KIS_APP_KEY,
                'appsecret': process.env.VITE_KIS_APP_SECRET,
                'tr_id': 'FHKUP03500200',
                'custtype': 'P'
            }
        });
        console.log('--- Full Response Output for FHKUP03500200 (0001) ---');
        console.log('Rows in output2:', res.data.output2?.length);
        if (res.data.output2?.length > 0) {
            console.log('Last Item (Today Close):', res.data.output2[0]);
        }
    } catch (e) {
        console.error(e.message);
    }
}
testTimeChart();
