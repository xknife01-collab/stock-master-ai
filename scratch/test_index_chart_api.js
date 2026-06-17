import axios from 'import-fresh';
import axiosOriginal from 'axios';
import { KIS_BASE_URL, getKisHeaders, getAccessToken } from '../lib/kisCore.js';

async function test() {
    const token = await getAccessToken();
    const response = await axiosOriginal.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-time-indexchartprice`, {
        params: { 
            FID_COND_MRKT_DIV_CODE: 'U', 
            FID_INPUT_ISCD: '0001',
            FID_INPUT_HOUR_1: '', 
            FID_PW_DATA_INCU_YN: 'N',
            FID_ETC_CLS_CODE: ''
        },
        headers: {
            ...getKisHeaders('FHKUP03500200'),
            'authorization': `Bearer ${token}`
        }
    });
    console.log("CHART RAW OUTPUT (first 5 items):");
    console.log(response.data?.output2?.slice(0, 5));
}

test().catch(console.error);
