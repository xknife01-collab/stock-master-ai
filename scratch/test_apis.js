import dotenv from 'dotenv';
dotenv.config();
import { KIS_BASE_URL, getAccessToken, getKisHeaders, kisRequest } from '../lib/kisCore.js';

(async () => {
    try {
        const token = await getAccessToken();
        const symbol = '005930';
        const commonHeaders = getKisHeaders('');

        const endpoints = [
            {
                name: 'price',
                url: `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-price`,
                params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol },
                tr_id: 'FHKST01010100'
            },
            {
                name: 'ratio',
                url: `${KIS_BASE_URL}/uapi/domestic-stock/v1/finance/financial-ratio`,
                params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol, FID_DIV_CLS_CODE: '0' },
                tr_id: 'FHKST66430300'
            },
            {
                name: 'ccnl',
                url: `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-ccnl`,
                params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol },
                tr_id: 'FHKST01010300'
            },
            {
                name: 'short',
                url: `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/daily-short-sale`,
                params: {
                    FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol,
                    FID_INPUT_DATE_1: '20260501',
                    FID_INPUT_DATE_2: '20260616'
                },
                tr_id: 'FHPST04830000'
            },
            {
                name: 'credit',
                url: `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/daily-credit-balance`,
                params: {
                    FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol,
                    FID_INPUT_DATE_1: '20260501',
                    FID_INPUT_DATE_2: '20260616',
                    FID_COND_SCR_DIV_CODE: '20476'
                },
                tr_id: 'FHPST04760000'
            },
            {
                name: 'daily',
                url: `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice`,
                params: {
                    FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol,
                    FID_INPUT_DATE_1: '20260501',
                    FID_INPUT_DATE_2: '20260616',
                    FID_PERIOD_DIV_CODE: 'D', FID_ORG_ADJ_PRC: '1'
                },
                tr_id: 'FHKST03010100'
            }
        ];

        for (const ep of endpoints) {
            try {
                console.log(`\n--- Testing ${ep.name} ---`);
                const res = await kisRequest({
                    method: 'get',
                    url: ep.url,
                    params: ep.params,
                    headers: { ...commonHeaders, 'tr_id': ep.tr_id, 'authorization': `Bearer ${token}` }
                });
                console.log(`Success ${ep.name}: status=${res.status}, rt_cd=${res.data?.rt_cd}, msg1=${res.data?.msg1}`);
            } catch (err) {
                console.error(`Error ${ep.name}: status=${err.response?.status}, message=${err.message}`);
                if (err.response?.data) {
                    console.error('Response data:', JSON.stringify(err.response.data, null, 2));
                }
            }
        }
    } catch (e) {
        console.error('Token or other error:', e);
    }
})();
