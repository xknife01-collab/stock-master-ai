import axios from 'axios';
import dotenv from 'dotenv';
import { getAccessToken, KIS_BASE_URL, getKisHeaders } from '../lib/kisCore.js';

dotenv.config();

const runTest = async () => {
    try {
        const token = await getAccessToken();
        console.log('Token retrieved:', token ? 'SUCCESS' : 'FAILED');

        const gainerRes = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/ranking/fluctuation`, {
            params: {
                FID_COND_MRKT_DIV_CODE: 'J',
                FID_COND_SCR_DIV_CODE: '20172',
                FID_INPUT_ISCD: '0000',
                FID_RANK_SORT_CLS_CODE: '0',
                FID_INPUT_CNT_1: '0',
                FID_PRC_CLS_CODE: '1',
                FID_INPUT_PBMS_1: '0',
                FID_BLNG_CLS_CODE: '0',
                FID_DIV_CLS_CODE: '0',
                FID_TRGT_CLS_CODE: '0',
                FID_TRGT_EXLS_CLS_CODE: '0',
                FID_PRC_RANGE_CLS_CODE: '0',
                FID_INPUT_PRICE_1: '0',
                FID_INPUT_PRICE_2: '0',
                FID_VOL_CNT: '0'
            },
            headers: {
                ...getKisHeaders('FHPST01720000'),
                'authorization': `Bearer ${token}`
            }
        });

        console.log('API Status:', gainerRes.status);
        console.log('Response RT_CD:', gainerRes.data.rt_cd);
        console.log('Response MSG:', gainerRes.data.msg1);
        console.log('Response Output length:', gainerRes.data.output?.length || 0);
        console.log('Response Output sample:', gainerRes.data.output?.slice(0, 3));
    } catch (e) {
        console.error('Test execution failed:', e.message);
        if (e.response) {
            console.error('Response data:', e.response.data);
        }
    }
};

runTest();
