import dotenv from 'dotenv';
dotenv.config();
import { getAccessToken, KIS_BASE_URL, getKisHeaders, kisRequest } from '../lib/kisCore.js';

(async () => {
    try {
        const token = await getAccessToken();
        const symbol = '005930';
        const res = await kisRequest({
            method: 'get',
            url: `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/daily-short-sale`,
            params: {
                FID_COND_MRKT_DIV_CODE: 'J',
                FID_INPUT_ISCD: symbol,
                FID_INPUT_DATE_1: new Date(Date.now() - 7 * 86400000).toISOString().slice(0,10).replace(/-/g,''),
                FID_INPUT_DATE_2: new Date().toISOString().slice(0,10).replace(/-/g,'')
            },
            headers: {
                ...getKisHeaders('FHPST04830000'),
                'authorization': `Bearer ${token}`
            }
        });
        console.log("Full KIS Response data:", JSON.stringify(res.data, null, 2));
    } catch (e) {
        console.error("Failed:", e.message);
    }
})();
