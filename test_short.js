import axios from 'axios';
import dotenv from 'dotenv';
import { getAccessToken, KIS_BASE_URL, getKisHeaders } from './lib/kisCore.js';

dotenv.config();

async function testShortSale() {
    const token = await getAccessToken();
    const symbol = '005930';
    try {
        const res = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/daily-short-sale`, {
            params: {
                FID_COND_MRKT_DIV_CODE: 'J',
                FID_INPUT_ISCD: symbol,
                FID_INPUT_DATE_1: '20260301',
                FID_INPUT_DATE_2: '20260328'
            },
            headers: { ...getKisHeaders('FHPST04830000'), 'authorization': `Bearer ${token}` }
        });
        console.log('--- SHORT SALE (FHPST04830000) ---');
        console.log(JSON.stringify(res.data.output?.[0] || {}, null, 2));

        const res2 = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/daily-credit-balance`, {
            params: {
                FID_COND_MRKT_DIV_CODE: 'J',
                FID_INPUT_ISCD: symbol,
                FID_INPUT_DATE_1: '20260301',
                FID_INPUT_DATE_2: '20260328'
            },
            headers: { ...getKisHeaders('FHPST04760000'), 'authorization': `Bearer ${token}` }
        });
        console.log('--- CREDIT BALANCE (FHPST04760000) ---');
        console.log(JSON.stringify(res2.data.output?.[0] || {}, null, 2));
    } catch (e) {
        console.error(e.response?.data || e.message);
    }
}

testShortSale();
