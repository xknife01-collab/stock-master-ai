import dotenv from 'dotenv';
import axios from 'axios';
import { getAccessToken, getKisHeaders, KIS_BASE_URL } from '../lib/kisCore.js';

dotenv.config();

async function testIndex() {
    try {
        const token = await getAccessToken();
        const codes = ['0001', '1001', '2001'];
        for (const code of codes) {
            const response = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-index-price`, {
                params: { 
                    FID_COND_MRKT_DIV_CODE: 'U', 
                    FID_INPUT_ISCD: code,
                    FID_ETC_CLS_CODE: ''
                },
                headers: {
                    ...getKisHeaders('FHPUP02100000'),
                    'authorization': `Bearer ${token}`
                }
            });
            const d = response.data.output;
            console.log(`Code ${code}: Name=${d?.bstp_nm}, Price=${d?.bstp_nmix_prpr}, Change=${d?.bstp_nmix_prdy_ctrt}`);
        }
    } catch (e) {
        console.error('Test index query failed:', e.message, e.response?.data);
    }
}
testIndex();
