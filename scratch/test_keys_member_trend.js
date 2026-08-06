import dotenv from 'dotenv';
dotenv.config();
import { KIS_KEYS, KIS_BASE_URL, getAccessToken } from '../lib/kisCore.js';
import axios from 'axios';

const testKey = async (keyIndex) => {
    try {
        const keyInfo = KIS_KEYS[keyIndex];
        if (!keyInfo) {
            console.log(`❌ Key ${keyIndex} is not configured.`);
            return;
        }
        const token = await getAccessToken(keyIndex);
        const response = await axios({
            method: 'get',
            url: `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-member`,
            params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: '005930' },
            headers: {
                'authorization': `Bearer ${token}`,
                'appkey': keyInfo.appkey,
                'appsecret': keyInfo.appsecret,
                'tr_id': 'FHKST01010600'
            },
            timeout: 5000
        });
        console.log(`✅ Key ${keyIndex} Succeeded! glob_ntby_qty:`, response.data?.output?.[0]?.glob_ntby_qty);
    } catch (err) {
        console.error(`❌ Key ${keyIndex} Failed:`, err.response?.data || err.message);
    }
};

(async () => {
    console.log("Testing Key 0...");
    await testKey(0);
    console.log("\nTesting Key 1...");
    await testKey(1);
    process.exit(0);
})();
