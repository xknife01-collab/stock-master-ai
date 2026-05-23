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

/**
 * 실시간 주가 조회 공통 유틸리티
 */
export const fetchStockPrice = async (symbol) => {
    try {
        const token = await getAccessToken();
        const response = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-price`, {
            params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol },
            headers: {
                ...getKisHeaders('FHKST01010100'),
                'authorization': `Bearer ${token}`
            }
        });
        
        if (response.data.rt_cd !== '0' || !response.data.output) {
            console.error(`Price fetch error for ${symbol}: ${response.data.msg1}`);
            return null;
        }

        return {
            price: parseInt(response.data.output.stck_prpr),
            change: response.data.output.prdy_ctrt
        };
    } catch (e) {
        console.error(`Price fetch failed for ${symbol}:`, e.message);
        return null;
    }
};

/**
 * 하락 리스크 및 펀던멘털 분석을 위한 종합 데이터 수집
 */
export const fetchStockAnalytics = async (symbol) => {
    try {
        const token = await getAccessToken();
        const commonHeaders = { ...getKisHeaders(''), 'authorization': `Bearer ${token}` };

        const [financials, technicals] = await Promise.all([
            // 재무 제표 (수익성성 확인용)
            axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/finance/income-statement`, {
                params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol, FID_DIV_CLS_CODE: '0' },
                headers: { ...commonHeaders, 'tr_id': 'FHKST66430200' }
            }),
            // 최근 15거래일 일자별 시세 (추세 및 거래량 확인용)
            axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice`, {
                params: {
                    FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol,
                    FID_INPUT_DATE_1: new Date(Date.now() - 250 * 86400000).toISOString().slice(0,10).replace(/-/g,''),
                    FID_INPUT_DATE_2: new Date().toISOString().slice(0,10).replace(/-/g,''),
                    FID_PERIOD_DIV_CODE: 'D', FID_ORG_ADJ_PRC: '1'
                },
                headers: { ...commonHeaders, 'tr_id': 'FHKST03010100' }
            })
        ]);

        const financeData = (financials.data.output || []).slice(0, 3).map(it => ({
            period: it.stac_yymm,
            revenue: it.sale_account,
            profit: it.op_prfi
        }));

        const priceData = (technicals.data.output2 || []).slice(0, 60).map(it => ({
            date: it.stck_bsop_date,
            close: it.stck_clpr,
            vol: it.acml_vol
        }));

        return { financeData, priceData };
    } catch (e) {
        console.warn(`Analytics fetch failed for ${symbol}:`, e.message);
        return null;
    }
};

/**
 * 특정 종목의 외국인/기관 매매 추이 조회 (FHKST01010900)
 */
export const fetchStockInvestorTrend = async (symbol) => {
    try {
        const token = await getAccessToken();
        const response = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-investor`, {
            params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol },
            headers: {
                ...getKisHeaders('FHKST01010900'),
                'authorization': `Bearer ${token}`
            }
        });
        
        if (response.data.rt_cd !== '0' || !response.data.output) {
            return "데이터 없음";
        }

        // 최근 3거래일치 요약
        return response.data.output.slice(0, 3).map(it => 
            `${it.stck_bsop_date}: [외인:${it.frgn_ntby_qty}, 기관:${it.orgn_ntby_qty}, 개인:${it.pru_ntby_qty}]`
        ).join(' | ');
    } catch (e) {
        console.warn(`Investor trend fetch failed for ${symbol}:`, e.message);
        return "데이터 불러오기 실패";
    }
};

/**
 * 전종목 순위 조회 (상승률, 거래량, 거래대금 등)
 * trId: FHPST01700000(상승), FHPST01710000(거래량/대금)
 */
export const fetchMarketRankings = async (type = 'GAIN') => {
    try {
        const token = await getAccessToken();
        let trId = 'FHPST01720000'; // 기본 상승률
        let urlPath = '/uapi/domestic-stock/v1/ranking/fluctuation';
        let params = {
            FID_COND_MRKT_DIV_CODE: 'J',
            FID_COND_SCR_DIV_CODE: '20172',
            FID_INPUT_ISCD: '0000',
            FID_RANK_SORT_CLS_CODE: '0',
            FID_INPUT_CNT_1: '0',
            FID_PRC_CLS_CODE: '1',
            FID_INPUT_PBMS_1: '0',
            FID_BLNG_CLS_CODE: '0',
            FID_DIV_CLS_CODE: '0',
            FID_TRGT_CLS_CODE: '0',
            FID_TRGT_EXLS_CLS_CODE: '0',
            FID_PRC_RANGE_CLS_CODE: '0',
            FID_INPUT_PRICE_1: '0',
            FID_INPUT_PRICE_2: '0',
            FID_VOL_CNT: '0'
        };

        if (type === 'VOLUME' || type === 'VALUE') {
            trId = 'FHPST01710000';
            urlPath = '/uapi/domestic-stock/v1/quotations/volume-rank';
            params = {
                FID_COND_MRKT_DIV_CODE: 'J',
                FID_COND_SCR_DIV_CODE: '20171',
                FID_INPUT_ISCD: '0000',
                FID_DIV_CLS_CODE: '0',
                FID_BLNG_CLS_CODE: '0',
                FID_TRGT_CLS_CODE: '0',
                FID_TRGT_EXLS_CLS_CODE: '0',
                FID_INPUT_PRICE_1: '0',
                FID_INPUT_PRICE_2: '0',
                FID_VOL_CNT: '0',
                FID_INPUT_DATE_1: '',
                FID_RANK_SORT_CLS_CODE: type === 'VALUE' ? '1' : '0' // 0:거래량, 1:거래대금순
            };
        }

        const response = await axios.get(`${KIS_BASE_URL}${urlPath}`, {
            params,
            headers: { ...getKisHeaders(trId), 'authorization': `Bearer ${token}` }
        });

        if (response.data.rt_cd !== '0' || !response.data.output) return [];
        return response.data.output.slice(0, 15).map(it => ({
            name: it.hts_kor_isnm,
            code: it.mksc_shrn_iscd,
            price: it.stck_prpr,
            change: it.prdy_ctrt,
            volume: it.acml_vol,
            value: it.acml_tr_pbmn // 거래대금
        }));
    } catch (e) {
        console.warn(`Ranking(${type}) fetch failed:`, e.message);
        return [];
    }
};


/**
 * 주식 당일 분봉 조회 (FHKST03010200)
 * 1분 단위 당일 추이 확인용
 */
export const fetchIntradayMinChart = async (symbol) => {
    try {
        const token = await getAccessToken();
        const response = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-time-itemchartprice`, {
            params: {
                FID_COND_MRKT_DIV_CODE: 'J',
                FID_INPUT_ISCD: symbol,
                FID_ETC_CLS_CODE: '',
                FID_PW_DATA_INCU_YN: 'N' // 과거 데이터 포함 여부 (N: 당일만)
            },
            headers: {
                ...getKisHeaders('FHKST01010100'), // 기본 공통 헤더 활용 가능 혹은 명시적 TR_ID
                'tr_id': 'FHKST03010200',
                'authorization': `Bearer ${token}`
            }
        });

        if (response.data.rt_cd !== '0' || !response.data.output2) return [];

        // 데이터 역순(최신순)으로 올 수 있으므로 정렬 필요할 수 있음
        return response.data.output2.map(it => ({
            date: `${it.stck_cntg_hour.slice(0,2)}:${it.stck_cntg_hour.slice(2,4)}`,
            price: parseInt(it.stck_prpr),
            vol: parseInt(it.cntg_vol)
        })).reverse(); // 시간순 정렬
    } catch (e) {
        console.warn(`Intraday min chart fetch failed for ${symbol}:`, e.message);
        return [];
    }
};

/**
 * 조건검색 결과 조회 (HHPST03110301)
 */
export const fetchConditionResult = async (seq, userId = process.env.KIS_USER_ID || 'dummy_id') => {
    try {
        const token = await getAccessToken();
        const response = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/condition-search`, {
            params: {
                user_id: userId,
                seq: seq
            },
            headers: { ...getKisHeaders('FHKST03030001'), 'authorization': `Bearer ${token}` }
        });

        if (response.data.rt_cd !== '0' || !response.data.output) return [];
        return response.data.output.slice(0, 10).map(it => ({
            name: it.name,
            code: it.code,
            price: it.price,
            change: it.chgrate
        }));
    } catch (e) {
        console.warn(`Condition(${seq}) fetch failed:`, e.message);
        return [];
    }
};
