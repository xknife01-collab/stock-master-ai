import dotenv from 'dotenv';
dotenv.config();
import axios from 'axios';
import { getAccessToken, KIS_BASE_URL, getKisHeaders } from '../lib/kisCore.js';

async function testKey2() {
    console.log("Testing Key 2 (Index 1)...");
    try {
        const token = await getAccessToken(1);
        console.log("Token for Key 2:", token.substring(0, 20) + "...");
        
        const response = await axios({
            method: 'get',
            url: `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-price`,
            params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: '000660' },
            headers: {
                'authorization': `Bearer ${token}`,
                'appkey': process.env.VITE_KIS_APP_KEY_2,
                'appsecret': process.env.VITE_KIS_APP_SECRET_2,
                'tr_id': 'FHKST01010100',
                'custtype': 'P'
            }
        });
        console.log("✅ Key 2 Success! Price:", response.data?.output?.stck_prpr);
    } catch (e) {
        console.error("❌ Key 2 Failed!");
        if (e.response) {
            console.error("Status:", e.response.status);
            console.error("Data:", e.response.data);
        } else {
            console.error("Error Message:", e.message);
        }
    }
}

testKey2();
