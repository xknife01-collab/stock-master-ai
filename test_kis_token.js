import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const KIS_BASE_URL = 'https://openapi.koreainvestment.com:9443';

const testKIS = async () => {
    try {
        console.log('🔄 KIS Access Token 발급 시도...');
        console.log('Key:', process.env.VITE_KIS_APP_KEY);
        const response = await axios.post(`${KIS_BASE_URL}/oauth2/tokenP`, {
            grant_type: 'client_credentials',
            appkey: process.env.VITE_KIS_APP_KEY,
            appsecret: process.env.VITE_KIS_APP_SECRET
        });
        console.log('✅ 성공:', response.data);
    } catch (error) {
        console.error('❌ 실패:', error.response?.data || error.message);
        
        console.log('🔄 모의투자 URL로 재시도...');
        const vtsUrl = 'https://openapivts.koreainvestment.com:29443';
        try {
            const vtsResp = await axios.post(`${vtsUrl}/oauth2/tokenP`, {
                grant_type: 'client_credentials',
                appkey: process.env.VITE_KIS_APP_KEY,
                appsecret: process.env.VITE_KIS_APP_SECRET
            });
            console.log('✅ 모의투자 성공:', vtsResp.data);
            console.log('!!! 사용자의 키는 모의투자용입니다. URL을 변경해야 합니다.');
        } catch (vtsError) {
            console.error('❌ 모의투자도 실패:', vtsError.response?.data || vtsError.message);
        }
    }
};

testKIS();
