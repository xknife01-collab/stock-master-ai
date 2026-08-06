import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const KIS_BASE_URL = 'https://openapi.koreainvestment.com:9443';

async function testAllRankings() {
    try {
        const tokenRes = await axios.post(`${KIS_BASE_URL}/oauth2/tokenP`, {
            grant_type: 'client_credentials',
            appkey: process.env.VITE_KIS_APP_KEY,
            appsecret: process.env.VITE_KIS_APP_SECRET
        });
        const token = tokenRes.data.access_token;
        console.log('Token fetched.');

        const tests = [
            { name: 'Sector Ranking', url: '/uapi/domestic-stock/v1/ranking/industry', tr: 'FHPST01740000', params: { FID_COND_MRKT_DIV_CODE: 'J', FID_COND_SCR_DIV_CODE: '20174', FID_INPUT_ISCD: '0000', FID_RANK_SORT_CLS_CODE: '0' } },
            { name: 'Theme Ranking', url: '/uapi/domestic-stock/v1/ranking/theme', tr: 'FHPST01760000', params: { FID_COND_MRKT_DIV_CODE: 'J', FID_COND_SCR_DIV_CODE: '20176', FID_INPUT_ISCD: '0000', FID_RANK_SORT_CLS_CODE: '0' } },
            { name: 'Net Buy/Sell', url: '/uapi/domestic-stock/v1/ranking/net-buy-sell', tr: 'FHPST01710000', params: { FID_COND_MRKT_DIV_CODE: 'J', FID_COND_SCR_DIV_CODE: '20171', FID_RANK_SORT_CLS_CODE: '0', FID_RANK_SORT_CLS_CODE2: '0', FID_INPUT_ISCD: '0000', FID_PRC_CLS_CODE: '0', FID_INPUT_CNT_1: '0', FID_INPUT_PBMS_1: '0' } }
        ];

        for (const test of tests) {
            console.log(`\nTesting ${test.name} (${test.url})...`);
            try {
                const res = await axios.get(`${KIS_BASE_URL}${test.url}`, {
                    params: test.params,
                    headers: {
                        'authorization': `Bearer ${token}`,
                        'appkey': process.env.VITE_KIS_APP_KEY,
                        'appsecret': process.env.VITE_KIS_APP_SECRET,
                        'tr_id': test.tr
                    }
                });
                console.log(`Response:`, res.data.rt_cd === '0' ? 'SUCCESS' : `FAILED: ${res.data.msg1}`);
                if (res.data.output?.[0]) {
                    console.log('Sample data:', res.data.output[0]);
                } else if (res.data.output1?.[0]) {
                    console.log('Sample data (output1):', res.data.output1[0]);
                }
            } catch (e) {
                console.log(`Error:`, e.response?.data || e.message);
            }
        }
    } catch (e) {
        console.error('Test failed:', e.response?.data || e.message);
    }
}

testAllRankings();
