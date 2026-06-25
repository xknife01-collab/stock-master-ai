import dotenv from 'dotenv';
dotenv.config();
import axios from 'axios';
import { getAccessToken, KIS_BASE_URL, getKisHeaders } from '../lib/kisCore.js';

(async () => {
    try {
        const token = await getAccessToken();
        const response = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/psearch-result`, {
            params: {
                user_id: process.env.KIS_USER_ID || 'dummy_id',
                seq: '0'
            },
            headers: { ...getKisHeaders('HHKST03900300'), 'authorization': `Bearer ${token}` }
        });
        console.log("Raw Response Keys:", Object.keys(response.data));
        console.log("rt_cd:", response.data.rt_cd);
        console.log("msg_cd:", response.data.msg_cd);
        console.log("msg1:", response.data.msg1);
        if (response.data.output) {
            console.log("Output is array?", Array.isArray(response.data.output));
            console.log("Output Length:", response.data.output.length);
            console.log("First Output item:", response.data.output[0]);
        } else {
            console.log("No response.data.output found.");
        }
        console.log("Full data:", JSON.stringify(response.data, null, 2).slice(0, 1000));
    } catch (e) {
        console.error("Error:", e.message);
    }
})();
