import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const KIS_BASE_URL = 'https://openapi.koreainvestment.com:9443';

async function testInvestorRanking() {
    try {
        const tokenRes = await axios.post(`${KIS_BASE_URL}/oauth2/tokenP`, {
            grant_type: 'client_credentials',
            appkey: process.env.VITE_KIS_APP_KEY,
            appsecret: process.env.VITE_KIS_APP_SECRET
        });
        const token = tokenRes.data.access_token;
        console.log('Token fetched.');

        const tests = [
            { name: 'Investor Ranking', url: '/uapi/domestic-stock/v1/ranking/investor', tr: 'FHPST01710000' }
        ];

        for (const test of tests) {
            console.log(`\nTesting ${test.name} (${test.url})...`);
            try {
                const res = await axios.get(`${KIS_BASE_URL}${test.url}`, {
                    params: {
                        FID_COND_MRKT_DIV_CODE: 'J',
                        FID_COND_SCR_DIV_CODE: '20171',
                        FID_INPUT_ISCD: '0000',
                        FID_RANK_SORT_CLS_CODE: '0', // 0: Net Buy
                        FID_RANK_SORT_CLS_CODE2: '0', // 0: Foreign
                        FID_PRC_CLS_CODE: '0',
                        FID_INPUT_CNT_1: '0',
                        FID_INPUT_PBMS_1: '0',
                        FID_BLNG_CLS_CODE: '0'
                    },
                    headers: {
                        'authorization': `Bearer ${token}`,
                        'appkey': process.env.VITE_KIS_APP_KEY,
                        'appsecret': process.env.VITE_KIS_APP_SECRET,
                        'tr_id': test.tr
                    }
                });
                console.log(`Status for ${test.url}: ${res.status}`);
                if (res.data.output?.[0]) console.log('Sample data:', res.data.output[0]);
            } catch (e) {
                console.log(`Status for ${test.url}: ${e.response?.status || e.message}`, e.response?.data);
            }
        }
    } catch (e) {
        console.error('Test failed:', e.message);
    }
}

testInvestorRanking();
