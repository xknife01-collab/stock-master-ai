import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const KIS_BASE_URL = 'https://openapi.koreainvestment.com:9443';

async function testKisGainers() {
    try {
        const tokenRes = await axios.post(`${KIS_BASE_URL}/oauth2/tokenP`, {
            grant_type: 'client_credentials',
            appkey: process.env.VITE_KIS_APP_KEY,
            appsecret: process.env.VITE_KIS_APP_SECRET
        });
        const token = tokenRes.data.access_token;

        const res = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/ranking/fluctuation`, {
            params: {
                FID_COND_MRKT_DIV_CODE: 'J',
                FID_COND_SCR_DIV_CODE: '20172',
                FID_INPUT_ISCD: '0000',
                FID_RANK_SORT_CLS_CODE: '0', 
                FID_INPUT_CNT_1: '0',
                FID_PRC_CLS_CODE: '0',
                FID_INPUT_PBMS_1: '0',
                FID_BLNG_CLS_CODE: '0',
                FID_DIV_CLS_CODE: '0',
                FID_TRGT_CLS_CODE: '0',
                FID_TRGT_EXLS_CLS_CODE: '0',
                FID_PRC_RANGE_CLS_CODE: '0'
            },
            headers: {
                'authorization': `Bearer ${token}`,
                'appkey': process.env.VITE_KIS_APP_KEY,
                'appsecret': process.env.VITE_KIS_APP_SECRET,
                'tr_id': 'FHPST01720000',
                'custtype': 'P'
            }
        });

        console.log('RT_CD:', res.data.rt_cd);
        console.log('MSG:', res.data.msg1);
        if (res.data.output) {
            console.log('Total results:', res.data.output.length);
            res.data.output.slice(0, 5).forEach((it, idx) => {
                console.log(`${idx+1}. ${it.hts_kor_isnm} (${it.mksc_shrn_iscd}) : ${it.stck_prpr} (${it.prdy_ctrt}%)`);
            });
        }
    } catch (e) {
        console.error('Error:', e.response?.data || e.message);
    }
}
testKisGainers();
