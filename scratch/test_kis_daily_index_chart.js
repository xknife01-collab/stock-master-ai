import axiosOriginal from 'axios';
import { KIS_BASE_URL, getKisHeaders, getAccessToken } from '../lib/kisCore.js';

async function test() {
    const token = await getAccessToken();
    try {
        const response = await axiosOriginal.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-daily-indexchartprice`, {
            params: { 
                FID_COND_MRKT_DIV_CODE: 'U', 
                FID_INPUT_ISCD: '0001',
                FID_INPUT_DATE_1: '20240101',
                FID_INPUT_DATE_2: new Date().toISOString().slice(0,10).replace(/-/g,''),
                FID_PERIOD_DIV_CODE: 'D',
                FID_ORG_ADJ_PRC: '0',
                FID_ETC_CLS_CODE: ''
            },
            headers: {
                ...getKisHeaders('FHKUP03500100'),
                'authorization': `Bearer ${token}`
            }
        });
        console.log("DAILY CHART RAW OUTPUT (first 5 items):");
        console.log(response.data?.output2?.slice(0, 5));
        console.log("Response rt_cd:", response.data?.rt_cd, "msg:", response.data?.msg1);
    } catch (e) {
        console.error("Daily chart request failed:", e.message);
    }
}

test().catch(console.error);
