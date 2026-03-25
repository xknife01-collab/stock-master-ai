import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

export const KIS_BASE_URL = 'https://openapi.koreainvestment.com:9443';

let accessToken = '';
let tokenExpires = 0;
let fetchingTokenPromise = null;

const tokenPath = './kis_token.json';

// 초기 로딩: 파일에서 토큰 복구
try {
    if (import.meta.url) {
        const fs = await import('fs');
        if (fs.existsSync(tokenPath)) {
            const saved = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
            if (saved.accessToken && saved.tokenExpires > Date.now()) {
                accessToken = saved.accessToken;
                tokenExpires = saved.tokenExpires;
                console.log('📦 KIS Token restored from file');
            }
        }
    }
} catch (e) { /* ignore */ }

/**
 * KIS Access Token 발급 함수
 */
export const getAccessToken = async () => {
    if (fetchingTokenPromise) return fetchingTokenPromise;

    if (accessToken && Date.now() < tokenExpires - 60000) {
        return accessToken;
    }

    fetchingTokenPromise = (async () => {
        try {
            console.log('🔄 KIS Access Token 발급을 시도합니다...');
            const response = await axios.post(`${KIS_BASE_URL}/oauth2/tokenP`, {
                grant_type: 'client_credentials',
                appkey: process.env.VITE_KIS_APP_KEY,
                appsecret: process.env.VITE_KIS_APP_SECRET
            });

            accessToken = response.data.access_token;
            tokenExpires = Date.now() + ((response.data.expires_in - 60) * 1000);
            
            // 파일에 저장
            const fs = await import('fs');
            fs.writeFileSync(tokenPath, JSON.stringify({ accessToken, tokenExpires }), 'utf8');
            
            console.log('✅ KIS Access Token 발급 성공');
            return accessToken;
        } catch (error) {
            console.error('❌ Token 발급 에러:', error.response?.data || error.message);
            if (error.response?.data?.error_code === 'EGW00133' && accessToken) {
                console.warn('⚠️ 토큰 발급 빈도 초과, 기존 토큰 사용 (만료 시간 임시 연장)');
                tokenExpires = Date.now() + (300 * 1000);
                return accessToken;
            }
            throw error;
        } finally {
            fetchingTokenPromise = null;
        }
    })();

    return fetchingTokenPromise;
};

/**
 * 전역에서 사용할 수 있는 accessToken getter
 */
export const getCurrentToken = () => accessToken;

/**
 * 미들웨어: 토근 만료 시 자동 갱신
 */
export const ensureToken = async (req, res, next) => {
    if (!accessToken || Date.now() >= tokenExpires - 60000) {
        console.log('[Middleware] Renewing KIS Access Token...');
        try {
            await getAccessToken();
        } catch (error) {
            console.error('❌ KIS Authentication failed:', error.message);
            return res.status(500).json({ error: 'Failed to authenticate with KIS', details: error.message });
        }
    }
    // 하위 라우터에서 토큰을 쉽게 쓸 수 있도록 req에 넣을 수도 있지만, 
    // 여기서는 export된 변수를 직접 쓰거나 이 함수를 통해 강제 확인만 함.
    next();
};

/**
 * KIS API 호출용 공통 헤더 생성 유틸리티
 */
export const getKisHeaders = (trId) => ({
    'authorization': `Bearer ${accessToken}`,
    'appkey': process.env.VITE_KIS_APP_KEY,
    'appsecret': process.env.VITE_KIS_APP_SECRET,
    'tr_id': trId,
    'custtype': 'P'
});
