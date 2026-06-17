import dotenv from 'dotenv';
dotenv.config();
import { getAccessToken, KIS_BASE_URL, getKisHeaders, kisRequest } from '../lib/kisCore.js';

async function testShort() {
    const token = await getAccessToken();
    const commonHeaders = { ...getKisHeaders(''), 'authorization': `Bearer ${token}` };
    
    console.log("Querying daily-short-sale for 000270...");
    const res = await kisRequest({
        method: 'get',
        url: `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/daily-short-sale`,
        params: {
            FID_COND_MRKT_DIV_CODE: 'J',
            FID_INPUT_ISCD: '000270',
            FID_INPUT_DATE_1: new Date(Date.now() - 5 * 86400000).toISOString().slice(0,10).replace(/-/g,''),
            FID_INPUT_DATE_2: new Date().toISOString().slice(0,10).replace(/-/g,'')
        },
        headers: { ...commonHeaders, 'tr_id': 'FHPST04830000' }
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
        res.data.output2.forEach((row, i) => {
            console.log(`output2[${i}]:`, row);
        });
    }
}
testShort();
