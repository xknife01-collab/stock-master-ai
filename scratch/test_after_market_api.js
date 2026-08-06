import dotenv from 'dotenv';
dotenv.config();

import { KIS_BASE_URL, getAccessToken, getKisHeaders, kisRequest } from '../lib/kisCore.js';

(async () => {
    try {
        const token = await getAccessToken();
        console.log("Trying FHPST02300400 with inquire-overtime-asking-price:");
        try {
            const response = await kisRequest({
                method: 'get',
                url: `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-overtime-asking-price`,
                params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: '000270' },
                headers: {
                    ...getKisHeaders('FHPST02300400'),
                    'authorization': `Bearer ${token}`
                }
            });
            console.log("FHPST02300400 Response Data:", JSON.stringify(response.data, null, 2));
        } catch (e1) {
            console.error("FHPST02300400 error:", e1.message);
        }
    } catch (e) {
        console.error(e);
    }
})();
