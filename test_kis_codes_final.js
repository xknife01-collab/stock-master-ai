import axios from 'axios';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config();

const KIS_BASE_URL = 'https://openapi.koreainvestment.com:9443';
const tokenPath = path.join(__dirname, 'kis_token.json');

async function test() {
    let token = '';
    if (fs.existsSync(tokenPath)) {
        const tObj = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
        token = tObj.access_token;
    } else {
        const res = await axios.post(`${KIS_BASE_URL}/oauth2/tokenP`, {
            grant_type: 'client_credentials',
            appkey: process.env.VITE_KIS_APP_KEY,
            appsecret: process.env.VITE_KIS_APP_SECRET
        });
        token = res.data.access_token;
    }

    const priceTr = 'FHPUP02100000';
    const chartTr = 'FHKUP03500200';
    const codes = ['2001', '101', '0002', '001', '1001'];

    console.log('--- Testing Index Price (FHPUP02100000) ---');
    for (const code of codes) {
        try {
            const res = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-index-price`, {
                params: { FID_COND_MRKT_DIV_CODE: 'U', FID_INPUT_ISCD: code },
                headers: {
                    'authorization': `Bearer ${token}`,
                    'appkey': process.env.VITE_KIS_APP_KEY,
                    'appsecret': process.env.VITE_KIS_APP_SECRET,
                    'tr_id': priceTr
                }
            });
            console.log(`[Price] Code ${code}: Name=${res.data.output?.bstp_nm}, Price=${res.data.output?.bstp_nmix_prpr}`);
        } catch (e) { console.log(`[Price] Code ${code}: Fail ${e.message}`); }
        await new Promise(r => setTimeout(r, 200));
    }

    console.log('\n--- Testing Index Chart (FHKUP03500200) ---');
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
                    'tr_id': chartTr
                }
            });
            const lastRow = res.data.output2?.[0];
            console.log(`[Chart] Code ${code}: Rows=${res.data.output2?.length}, LastPrice=${lastRow?.bstp_nmix_prpr}`);
        } catch (e) { console.log(`[Chart] Code ${code}: Fail ${e.message}`); }
        await new Promise(r => setTimeout(r, 200));
    }
}
test();
