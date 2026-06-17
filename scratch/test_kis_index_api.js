import axios from 'axios';
import { KIS_BASE_URL, getKisHeaders, getAccessToken } from '../lib/kisCore.js';

async function test() {
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
        console.log(`\nCode: ${code}`);
        console.log(JSON.stringify(response.data?.output, null, 2));
    }
}

test().catch(console.error);
