import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const KIS_BASE_URL = 'https://openapi.koreainvestment.com:9443';
const APP_KEY = process.env.VITE_KIS_APP_KEY;
const APP_SECRET = process.env.VITE_KIS_APP_SECRET;

async function testRankings() {
    try {
        console.log('Fetching token...');
        const tokenRes = await axios.post(`${KIS_BASE_URL}/oauth2/tokenP`, {
            grant_type: 'client_credentials',
            appkey: APP_KEY,
            appsecret: APP_SECRET
        });
        const token = tokenRes.data.access_token;
        console.log('Token fetched.');

        const tests = [
            { name: 'Sector Ranking', url: '/uapi/domestic-stock/v1/ranking/sector', tr: 'FHPST01740000' },
            { name: 'Theme Ranking', url: '/uapi/domestic-stock/v1/ranking/theme', tr: 'FHPST01760000' }
        ];

        for (const test of tests) {
            console.log(`\nTesting ${test.name}...`);
            try {
                const res = await axios.get(`${KIS_BASE_URL}${test.url}`, {
                    params: {
                        FID_COND_MRKT_DIV_CODE: 'J',
                        FID_COND_SCR_DIV_CODE: '20174' // Example for Sector Ranking screen
                    },
                    headers: {
                        'authorization': `Bearer ${token}`,
                        'appkey': APP_KEY,
                        'appsecret': APP_SECRET,
                        'tr_id': test.tr
                    }
                });
                console.log(`Response for ${test.name}:`, res.data.rt_cd === '0' ? 'SUCCESS' : `FAILED: ${res.data.msg1}`);
                if (res.data.output?.[0]) {
                    console.log('First result:', res.data.output[0]);
                }
            } catch (e) {
                console.log(`Error for ${test.name}:`, e.response?.data || e.message);
            }
        }
    } catch (e) {
        console.error('Test failed:', e.response?.data || e.message);
    }
}

testRankings();
