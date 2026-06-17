import dotenv from 'dotenv';
dotenv.config();
import { KIS_BASE_URL, getAccessToken, getKisHeaders, kisRequest } from '../lib/kisCore.js';

(async () => {
    const token = await getAccessToken();
    const symbol = '005930';
    const commonHeaders = getKisHeaders('');
    const res = await kisRequest({
        method: 'get',
        url: `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice`,
        params: {
            FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol,
            FID_INPUT_DATE_1: '20260601',
            FID_INPUT_DATE_2: '20260616',
            FID_PERIOD_DIV_CODE: 'D', FID_ORG_ADJ_PRC: '1'
        },
        headers: { ...commonHeaders, 'tr_id': 'FHKST03010100', 'authorization': `Bearer ${token}` }
    });
    console.log("Daily API Output2 first item:", res.data?.output2?.[0]);
    process.exit(0);
})();
