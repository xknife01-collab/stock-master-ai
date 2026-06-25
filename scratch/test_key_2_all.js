import dotenv from 'dotenv';
dotenv.config();
import axios from 'axios';
import { getAccessToken, KIS_BASE_URL } from '../lib/kisCore.js';

async function testAll() {
    const token = await getAccessToken(1);
    const commonHeaders = {
        'authorization': `Bearer ${token}`,
        'appkey': process.env.VITE_KIS_APP_KEY_2,
        'appsecret': process.env.VITE_KIS_APP_SECRET_2,
        'custtype': 'P'
    };

    const endpoints = [
        { name: 'price', url: '/uapi/domestic-stock/v1/quotations/inquire-price', tr: 'FHKST01010100', params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: '000660' } },
        { name: 'ratio', url: '/uapi/domestic-stock/v1/finance/financial-ratio', tr: 'FHHST31060000', params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: '000660', FID_DIV_CLS_CODE: '0' } },
        { name: 'income', url: '/uapi/domestic-stock/v1/finance/income-statement', tr: 'FHHST31030000', params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: '000660', FID_DIV_CLS_CODE: '0' } },
        { name: 'ccnl', url: '/uapi/domestic-stock/v1/quotations/inquire-ccnl', tr: 'FHKST01010300', params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: '000660' } },
        { name: 'short', url: '/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice', tr: 'FHPST04830000', params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: '000660', FID_PERIOD_DIV_CODE: 'D', FID_ORG_ADJ_PRC: 'Y' } },
        { name: 'consensus', url: '/uapi/domestic-stock/v1/finance/financial-consensus', tr: 'FHPST04760000', params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: '000660' } }
    ];

    for (const ep of endpoints) {
        try {
            console.log(`Testing ${ep.name}...`);
            const res = await axios({
                method: 'get',
                url: `${KIS_BASE_URL}${ep.url}`,
                params: ep.params,
                headers: { ...commonHeaders, 'tr_id': ep.tr }
            });
            console.log(`✅ ${ep.name} Success: rt_cd=${res.data?.rt_cd}, msg=${res.data?.msg1}`);
        } catch (e) {
            console.error(`❌ ${ep.name} Failed! status=${e.response?.status}, msg=${e.response?.data?.msg1 || e.message}`);
        }
    }
}

testAll();
