import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const KIS_BASE_URL = 'https://openapi.koreainvestment.com:9443';

async function BruteForceURI() {
    try {
        const tokenRes = await axios.post(`${KIS_BASE_URL}/oauth2/tokenP`, {
            grant_type: 'client_credentials',
            appkey: process.env.VITE_KIS_APP_KEY,
            appsecret: process.env.VITE_KIS_APP_SECRET
        });
        const token = tokenRes.data.access_token;
        console.log('Token fetched.');

        const paths = [
            '/uapi/domestic-stock/v1/ranking/fluctuation',
            '/uapi/domestic-stock/v1/ranking/volume',
            '/uapi/domestic-stock/v1/ranking/industry',
            '/uapi/domestic-stock/v1/ranking/sector',
            '/uapi/domestic-stock/v1/ranking/category',
            '/uapi/domestic-stock/v1/ranking/theme',
            '/uapi/domestic-stock/v1/quotations/inquire-index-price',
            '/uapi/domestic-stock/v1/quotations/inquire-daily-indexchartprice'
        ];

        for (const path of paths) {
            console.log(`\nTesting ${path}...`);
            try {
                const res = await axios.get(`${KIS_BASE_URL}${path}`, {
                    params: {
                        FID_COND_MRKT_DIV_CODE: 'J',
                        FID_COND_SCR_DIV_CODE: '20170', // Example
                        FID_INPUT_ISCD: '0001', // Example
                        FID_RANK_SORT_CLS_CODE: '0',
                        FID_INPUT_CNT_1: '0',
                        FID_PRC_CLS_CODE: '0',
                        FID_INPUT_PBMS_1: '0',
                        FID_BLNG_CLS_CODE: '0',
                        FID_DIV_CLS_CODE: '0',
                        FID_INPUT_DATE_1: '20230101',
                        FID_INPUT_DATE_2: '20240323',
                        FID_PERIOD_DIV_CODE: 'D',
                        FID_ORG_ADJ_PRC: '0'
                    },
                    headers: {
                        'authorization': `Bearer ${token}`,
                        'appkey': process.env.VITE_KIS_APP_KEY,
                        'appsecret': process.env.VITE_KIS_APP_SECRET,
                        'tr_id': 'FHPST01700000' // Using fluctuation TR as a test for paths
                    }
                });
                console.log(`Status for ${path}: ${res.status}`);
            } catch (e) {
                console.log(`Status for ${path}: ${e.response?.status || e.message}`);
            }
        }
    } catch (e) {
        console.error('Test failed:', e.message);
    }
}

BruteForceURI();
