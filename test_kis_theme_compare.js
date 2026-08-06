import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const KIS_BASE_URL = 'https://openapi.koreainvestment.com:9443';

const getAccessToken = async () => {
    try {
        const response = await axios.post(`${KIS_BASE_URL}/oauth2/tokenP`, {
            grant_type: 'client_credentials',
            appkey: process.env.VITE_KIS_APP_KEY,
            appsecret: process.env.VITE_KIS_APP_SECRET
        });
        return response.data.access_token;
    } catch (error) {
        console.error('Token Error:', error.response?.data || error.message);
        return null;
    }
};

const testThemeRanking = async (token) => {
    console.log('\n--- Testing Theme Ranking (FHPST01700000) ---');
    try {
        const response = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/theme-ranking`, {
            params: {
                FID_COND_MRKT_DIV_CODE: 'J',
                FID_COND_SCR_DIV_CODE: '20176',
                FID_INPUT_ISCD: '0000'
            },
            headers: {
                'authorization': `Bearer ${token}`,
                'appkey': process.env.VITE_KIS_APP_KEY,
                'appsecret': process.env.VITE_KIS_APP_SECRET,
                'tr_id': 'FHPST01700000',
                'custtype': 'P'
            }
        });
        console.log('Status Code:', response.status);
        console.log('Return Code:', response.data.rt_cd);
        console.log('Message:', response.data.msg1);
        if (response.data.output) {
            console.log('Sample Output (first 3):', response.data.output.slice(0, 3));
        } else {
            console.log('Output is empty');
        }
    } catch (error) {
        console.error('Theme Ranking Error:', error.response?.data || error.message);
    }
};

const testIndexCategoryPrice = async (token) => {
    console.log('\n--- Testing Index Category Price (FHPUP02140000) ---');
    try {
        // Based on user URL and my research
        const response = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-index-category-price`, {
            params: {
                FID_COND_MRKT_DIV_CODE: 'U',
                FID_INPUT_ISCD: '0001', // KOSPI
                FID_COND_SCR_DIV_CODE: '20214',
                FID_MRKT_CLS_CODE: 'K',
                FID_BLNG_CLS_CODE: '0'
            },
            headers: {
                'authorization': `Bearer ${token}`,
                'appkey': process.env.VITE_KIS_APP_KEY,
                'appsecret': process.env.VITE_KIS_APP_SECRET,
                'tr_id': 'FHPUP02140000',
                'custtype': 'P'
            }
        });
        console.log('Status Code:', response.status);
        console.log('Return Code:', response.data.rt_cd);
        console.log('Message:', response.data.msg1);
        if (response.data.output2) {
            console.log('Sample Output2 (first 3):', response.data.output2.slice(0, 3));
        } else {
            console.log('Output2 is empty');
        }
    } catch (error) {
        console.error('Index Category Price Error:', error.response?.data || error.message);
    }
};

const main = async () => {
    const token = await getAccessToken();
    if (!token) return;
    await testThemeRanking(token);
    await testIndexCategoryPrice(token);
};

main();
