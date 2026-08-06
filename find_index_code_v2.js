import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const KIS_BASE_URL = 'https://openapi.koreainvestment.com:9443';

async function findCorrectCode() {
    const tokenObj = JSON.parse(fs.readFileSync('./kis_token.json', 'utf8'));
    const token = tokenObj.accessToken;

    const codes = ['001', '101', '301', '0001', '1001', '2001'];
    
    for (const code of codes) {
        try {
            const res = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-index-price`, {
                params: { 
                    FID_COND_MRKT_DIV_CODE: 'U', 
                    FID_INPUT_ISCD: code,
                    FID_ETC_CLS_CODE: ''
                },
                headers: {
                    'authorization': `Bearer ${token}`,
                    'appkey': process.env.VITE_KIS_APP_KEY,
                    'appsecret': process.env.VITE_KIS_APP_SECRET,
                    'tr_id': 'FHPUP02100000',
                    'custtype': 'P'
                }
            });
            const name = res.data.output?.bstp_nm;
            const price = res.data.output?.bstp_nmix_prpr;
            console.log(`Code ${code}: Name=${name}, Price=${price}`);
        } catch (e) {
            console.log(`Code ${code}: Error ${e.message}`);
        }
        await new Promise(r => setTimeout(r, 200));
    }
}
findCorrectCode();
