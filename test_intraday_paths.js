import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const KIS_BASE_URL = 'https://openapi.koreainvestment.com:9443';

async function testIntradayPath() {
    try {
        const tokenRes = await axios.post(`${KIS_BASE_URL}/oauth2/tokenP`, {
            grant_type: 'client_credentials',
            appkey: process.env.VITE_KIS_APP_KEY,
            appsecret: process.env.VITE_KIS_APP_SECRET
        });
        const token = tokenRes.data.access_token;
        console.log('Token fetched.');

        const paths = [
            '/uapi/domestic-stock/v1/quotations/inquire-time-indexchartprice',
            '/uapi/domestic-stock/v1/quotations/inquire-index-time-itemchartprice'
        ];
        for (const path of paths) {
            try {
                const res = await axios.get(`${KIS_BASE_URL}${path}`, {
                    params: { FID_COND_MRKT_DIV_CODE: 'U', FID_INPUT_ISCD: '001', FID_INPUT_HOUR_1: '153000', FID_PW_DATA_INCU_YN: 'Y' },
                    headers: {
                        'authorization': `Bearer ${token}`,
                        'appkey': process.env.VITE_KIS_APP_KEY,
                        'appsecret': process.env.VITE_KIS_APP_SECRET,
                        'tr_id': 'FHKUP03500100'
                    }
                });
                console.log(`Path ${path}: Status ${res.status}, msg1: ${res.data.msg1}`);
            } catch (e) {
                console.log(`Path ${path}: ERROR ${e.message}`);
            }
        }
    } catch (e) {
        console.error('Test failed:', e.message);
    }
}
testIntradayPath();
