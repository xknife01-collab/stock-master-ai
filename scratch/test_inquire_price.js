import dotenv from 'dotenv';
dotenv.config();

import { KIS_BASE_URL, getAccessToken, getKisHeaders, kisRequest } from '../lib/kisCore.js';

(async () => {
    try {
        const token = await getAccessToken();
        const response = await kisRequest({
            method: 'get',
            url: `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-price`,
            params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: '005930' },
            headers: {
                ...getKisHeaders('FHKST01010100'),
                'authorization': `Bearer ${token}`
            }
        });
        
        console.log("Raw Response Data:", JSON.stringify(response.data, null, 2));
    } catch (e) {
        console.error(e);
    }
})();
