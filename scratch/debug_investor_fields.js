import axios from 'axios';
import dotenv from 'dotenv';
import { KIS_BASE_URL, ensureToken, getKisHeaders, getAccessToken } from '../lib/kisCore.js';

dotenv.config();

async function run() {
    try {
        const token = await getAccessToken();
        const response = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-investor`, {
            params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: '005930' },
            headers: {
                ...getKisHeaders('FHKST01010900'),
                'authorization': `Bearer ${token}`
            }
        });
        
        console.log("rt_cd:", response.data.rt_cd);
        console.log("msg1:", response.data.msg1);
        if (response.data.output && response.data.output[0]) {
            console.log("SAMPLE ROW KEYS:", Object.keys(response.data.output[0]));
            console.log("SAMPLE ROW VALUES:", response.data.output[0]);
        } else {
            console.log("No output data found.");
        }
    } catch (e) {
        console.error("Error:", e.message);
    }
}

run();
