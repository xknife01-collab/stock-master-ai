import dotenv from 'dotenv';
dotenv.config();
import { kisRequest, KIS_BASE_URL, getKisHeaders } from '../lib/kisCore.js';

(async () => {
    try {
        const symbol = "005930";
        const response = await kisRequest({
            method: 'get',
            url: `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-investor`,
            params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol },
            isBackground: false,
            headers: getKisHeaders('FHKST01010900')
        });
        
        console.log("rt_cd:", response.data.rt_cd);
        console.log("msg1:", response.data.msg1);
        console.log("Raw Output (top 5):", response.data.output?.slice(0, 5));
    } catch (e) {
        console.error(e);
    }
})();
