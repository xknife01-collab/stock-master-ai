import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const KIS_BASE_URL = 'https://openapi.koreainvestment.com:9443';

async function discover() {
    try {
        const tokenRes = await axios.post(`${KIS_BASE_URL}/oauth2/tokenP`, {
            grant_type: 'client_credentials',
            appkey: process.env.VITE_KIS_APP_KEY,
            appsecret: process.env.VITE_KIS_APP_SECRET
        });
        const token = tokenRes.data.access_token;
        console.log('Token fetched.');

        const paths = [
            { path: '/uapi/domestic-stock/v1/ranking/fluctuation', tr: 'FHPST01700000' },
            { path: '/uapi/domestic-stock/v1/quotations/volume-rank', tr: 'FHPST01710000' },
            { path: '/uapi/domestic-stock/v1/ranking/large-cap', tr: 'FHPST01720000' },
            { path: '/uapi/domestic-stock/v1/ranking/industry', tr: 'FHPST01740000' },
            { path: '/uapi/domestic-stock/v1/ranking/investor', tr: 'FHPST01760000' },
            { path: '/uapi/domestic-stock/v1/ranking/net-buy-sell', tr: 'FHPST01760000' },
            { path: '/uapi/domestic-stock/v1/ranking/expected-updown', tr: 'FHPST01770000' }
        ];

        for (const it of paths) {
            console.log(`\nTesting ${it.path}...`);
            try {
                const res = await axios.get(`${KIS_BASE_URL}${it.path}`, {
                    params: {
                        FID_COND_MRKT_DIV_CODE: 'J',
                        FID_COND_SCR_DIV_CODE: it.tr.substring(5, 10),
                        FID_INPUT_ISCD: '0000',
                        FID_RANK_SORT_CLS_CODE: '0',
                        FID_INPUT_CNT_1: '0',
                        FID_PRC_CLS_CODE: '0',
                        FID_INPUT_PBMS_1: '0',
                        FID_BLNG_CLS_CODE: '0',
                        FID_TRGT_CLS_CODE: '0',
                        FID_TRGT_EXTNS_CLS_CODE: '0',
                        FID_VOL_CNT: '0',
                        FID_DIFF_VOL1: '0',
                        FID_INPUT_PRICE_1: '0',
                        FID_INPUT_PRICE_2: '0'
                    },
                    headers: {
                        'authorization': `Bearer ${token}`,
                        'appkey': process.env.VITE_KIS_APP_KEY,
                        'appsecret': process.env.VITE_KIS_APP_SECRET,
                        'tr_id': it.tr
                    }
                });
                console.log(`Success! Status: ${res.status}`);
            } catch (e) {
                console.log(`Failed: ${e.response?.status || e.message}`);
                if (e.response?.status === 403) console.log('Wait, maybe it is a permission issue?');
            }
        }
    } catch (e) {
        console.error('Discovery failed:', e.message);
    }
}
discover();
