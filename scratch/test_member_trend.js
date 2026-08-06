import dotenv from 'dotenv';
dotenv.config();
import { KIS_KEYS, KIS_BASE_URL, getAccessToken } from '../lib/kisCore.js';
import axios from 'axios';

(async () => {
    try {
        const keyInfo = KIS_KEYS[0];
        const token = await getAccessToken(0);
        const symbol = '090430';

        const response = await axios({
            method: 'get',
            url: `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-member`,
            params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol },
            headers: {
                'authorization': `Bearer ${token}`,
                'appkey': keyInfo.appkey,
                'appsecret': keyInfo.appsecret,
                'tr_id': 'FHKST01010600'
            },
            timeout: 5000
        });

        console.log("Raw KIS member trend response:");
        console.log(JSON.stringify(response.data, null, 2));
    } catch (err) {
        console.error("HTTP Error:", err.message);
    }
    process.exit(0);
})();
