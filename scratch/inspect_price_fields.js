import dotenv from 'dotenv';
dotenv.config();
import { KIS_BASE_URL, getAccessToken, getKisHeaders, kisRequest } from '../lib/kisCore.js';

(async () => {
    const token = await getAccessToken();
    const symbol = '005930';
    const commonHeaders = getKisHeaders('');
    const res = await kisRequest({
        method: 'get',
        url: `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-price`,
        params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol },
        headers: { ...commonHeaders, 'tr_id': 'FHKST01010100', 'authorization': `Bearer ${token}` }
    });
    console.log("Price API Output:", res.data?.output);
    process.exit(0);
})();
