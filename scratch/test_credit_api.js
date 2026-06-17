import dotenv from 'dotenv';
dotenv.config();
import { getAccessToken, KIS_BASE_URL, getKisHeaders, kisRequest } from '../lib/kisCore.js';

async function testCredit() {
    const token = await getAccessToken();
    const commonHeaders = { ...getKisHeaders(''), 'authorization': `Bearer ${token}` };
    
    console.log("Querying daily-credit-balance for 000270...");
    const res = await kisRequest({
        method: 'get',
        url: `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/daily-credit-balance`,
        params: {
            FID_COND_MRKT_DIV_CODE: 'J',
            FID_INPUT_ISCD: '000270',
            FID_INPUT_DATE_1: new Date(Date.now() - 5 * 86400000).toISOString().slice(0,10).replace(/-/g,''),
            FID_INPUT_DATE_2: new Date().toISOString().slice(0,10).replace(/-/g,''),
            FID_COND_SCR_DIV_CODE: '20476'
        },
        headers: { ...commonHeaders, 'tr_id': 'FHPST04760000' }
    });
    
    console.log("Keys in response data:", Object.keys(res.data));
    if (res.data.output) {
        console.log("output length:", res.data.output.length);
        console.log("output[0]:", res.data.output[0]);
    }
    if (res.data.output1) {
        console.log("output1 length:", res.data.output1.length);
        console.log("output1[0]:", res.data.output1[0]);
    }
    if (res.data.output2) {
        console.log("output2 length:", res.data.output2.length);
        console.log("output2[0]:", res.data.output2[0]);
    }
}
testCredit();
