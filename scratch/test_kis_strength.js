import axios from 'axios';
import { getAccessToken, getKisHeaders, KIS_BASE_URL, kisRequest } from '../lib/kisCore.js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    const token = await getAccessToken();
    const commonHeaders = { ...getKisHeaders(''), 'authorization': `Bearer ${token}` };
    const symbol = '056090'; // 시지메드텍
    
    console.log("1. Inquire Price:");
    const priceRes = await kisRequest({
        method: 'get',
        url: `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-price`,
        params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol },
        headers: { ...commonHeaders, 'tr_id': 'FHKST01010100' }
    });
    console.log("Price Output:", priceRes.data.output);
    
    console.log("\n2. Inquire CCNL (Volume Strength):");
    const ccnlRes = await kisRequest({
        method: 'get',
        url: `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-ccnl`,
        params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol },
        headers: { ...commonHeaders, 'tr_id': 'FHKST01010300' }
    });
    console.log("CCNL Output (First row):", ccnlRes.data.output?.[0]);
}

run();
