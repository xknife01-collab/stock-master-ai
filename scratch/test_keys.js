import dotenv from 'dotenv';
dotenv.config();
import { KIS_KEYS, KIS_BASE_URL, getAccessToken, kisRateLimiter } from '../lib/kisCore.js';
import axios from 'axios';

(async () => {
    console.log("KIS_BASE_URL:", KIS_BASE_URL);
    console.log("Registered Keys count:", KIS_KEYS.length);

    for (let idx = 0; idx < KIS_KEYS.length; idx++) {
        console.log(`\n--- Key Index ${idx} 테스트 ---`);
        try {
            const keyInfo = KIS_KEYS[idx];
            console.log("App Key:", keyInfo.appkey.substring(0, 8) + "...");
            const token = await getAccessToken(idx);
            console.log("Got Token:", token.substring(0, 10) + "...");

            const response = await axios({
                method: 'get',
                url: `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-price`,
                params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: '090430' },
                headers: {
                    'authorization': `Bearer ${token}`,
                    'appkey': keyInfo.appkey,
                    'appsecret': keyInfo.appsecret,
                    'tr_id': 'FHKST01010100'
                },
                timeout: 5000
            });
            console.log("✅ 성공! 현재가:", response.data?.output?.stck_prpr);
        } catch (err) {
            console.error(`❌ Key Index ${idx} 실패!`);
            console.error("Error Status:", err.response?.status);
            console.error("Error Data:", JSON.stringify(err.response?.data || err.message));
        }
    }
    process.exit(0);
})();
