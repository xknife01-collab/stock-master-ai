import dotenv from 'dotenv';
import axios from 'axios';
import { getAccessToken, getKisHeaders, KIS_BASE_URL } from '../lib/kisCore.js';

dotenv.config();

async function testIndex() {
    try {
        const token = await getAccessToken();
        const response = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-index-price`, {
            params: { 
                FID_COND_MRKT_DIV_CODE: 'U', 
                FID_INPUT_ISCD: '0001',
                FID_ETC_CLS_CODE: ''
            },
            headers: {
                ...getKisHeaders('FHPUP02100000'),
                'authorization': `Bearer ${token}`
            }
        });
        console.log('KOSPI RAW OUTPUT:', JSON.stringify(response.data, null, 2));
    } catch (e) {
        console.error('Test index query failed:', e.message, e.response?.data);
    }
}
testIndex();
