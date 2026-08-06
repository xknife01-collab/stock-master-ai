import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const KIS_BASE_URL = 'https://openapi.koreainvestment.com:9443';

async function testChart() {
    const tokenObj = JSON.parse(fs.readFileSync('./kis_token.json', 'utf8'));
    const token = tokenObj.accessToken;

    const codes = ['101', '001', '301', '2001', '0001', '1001'];
    
    for (const code of codes) {
        try {
            const res = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-time-indexchartprice`, {
                params: {
                    FID_COND_MRKT_DIV_CODE: 'U',
                    FID_INPUT_ISCD: code,
                    FID_INPUT_HOUR_1: '60',
                    FID_PW_DATA_INCU_YN: 'Y'
                },
                headers: {
                    'authorization': `Bearer ${token}`,
                    'appkey': process.env.VITE_KIS_APP_KEY,
                    'appsecret': process.env.VITE_KIS_APP_SECRET,
                    'tr_id': 'FHKUP03500200',
                    'custtype': 'P',
                    'content-type': 'application/json; charset=utf-8'
                }
            });
            console.log(`Code ${code}: Rows=${res.data.output2?.length || 0}, Msg=${res.data.msg1}`);
        } catch (e) {
            console.log(`Code ${code}: Error ${e.response?.data?.msg1 || e.message}`);
        }
        await new Promise(r => setTimeout(r, 200));
    }
}
testChart();
