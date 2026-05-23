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
 * RSI, 이동평균선(5/20/60), 볼린저 밴드를 계산하는 보조 함수
 */
export const calculateTechnicalIndicators = (priceData) => {
    if (!priceData || priceData.length < 20) {
        return { rsi: '-', ma5: 0, ma20: 0, ma60: 0, maAlignment: '데이터 부족', bollinger: null };
    }
    
    // KIS는 최신 날짜가 0번 인덱스이므로, 수학 연산을 위해 과거 날짜순(chronological)으로 정렬
    const prices = priceData.map(p => parseFloat(p.close)).reverse().filter(p => !isNaN(p) && p > 0);
    const n = prices.length;
    if (n < 20) {
        return { rsi: '-', ma5: 0, ma20: 0, ma60: 0, maAlignment: '데이터 부족', bollinger: null };
    }
    
    const currentPrice = prices[n - 1];
    
    // 1. 단순이동평균 (SMA) 계산기
    const getSMA = (arr, periods) => {
        if (arr.length < periods) return 0;
        const slice = arr.slice(-periods);
        return slice.reduce((a, b) => a + b, 0) / periods;
    };
    
    const ma5 = getSMA(prices, 5);
    const ma20 = getSMA(prices, 20);
    const ma60 = n >= 60 ? getSMA(prices, 60) : getSMA(prices, n); // 60일 미만이면 전체 데이터 기준
    
    let maAlignment = '혼조세';
    if (ma5 > ma20 && ma20 > ma60) maAlignment = '정배열 (강력한 추세 상승)';
    else if (ma5 < ma20 && ma20 < ma60) maAlignment = '역배열 (하락 추세 지속)';
    
    // 2. 14일 RSI (상대강도지수) 계산
    let rsi = '-';
    if (n >= 15) {
        let gains = 0;
        let losses = 0;
        for (let i = n - 14; i < n; i++) {
            const diff = prices[i] - prices[i - 1];
            if (diff > 0) gains += diff;
            else losses -= diff;
        }
        const avgGain = gains / 14;
        const avgLoss = losses / 14;
        if (avgLoss === 0) {
            rsi = 100;
        } else {
            const rs = avgGain / avgLoss;
            rsi = parseFloat((100 - (100 / (1 + rs))).toFixed(1));
        }
    }
    
    // 3. 20일 기준 볼린저 밴드 (표준편차 2배수) 계산
    let bollinger = null;
    if (n >= 20) {
        const slice20 = prices.slice(-20);
        const sma20 = ma20;
        const variance = slice20.reduce((sum, val) => sum + Math.pow(val - sma20, 2), 0) / 20;
        const stdDev = Math.sqrt(variance);
        
        const upper = sma20 + (2 * stdDev);
        const lower = sma20 - (2 * stdDev);
        const width = upper - lower;
        const positionPercent = width > 0 ? parseFloat((((currentPrice - lower) / width) * 100).toFixed(1)) : 50;
        
        let interpretation = '밴드 안정 구간';
        if (currentPrice >= upper) interpretation = '상한선 이탈 돌파 (단기 과열 또는 강력한 밴드워크 상승)';
        else if (currentPrice <= lower) interpretation = '하한선 이탈 (단기 과매도/과락 상태)';
        else if (positionPercent > 80) interpretation = '상한선 접근 (추격 매수 부담 구간)';
        else if (positionPercent < 20) interpretation = '하한선 근접 (단기 지지선 반등 가능 영역)';
        
        bollinger = {
            upper: Math.round(upper),
            middle: Math.round(sma20),
            lower: Math.round(lower),
            positionPercent,
            interpretation
        };
    }
    
    return {
        rsi,
        ma5: Math.round(ma5),
        ma20: Math.round(ma20),
        ma60: Math.round(ma60),
        maAlignment,
        bollinger
    };
};

/**
 * 하락 리스크 및 펀던멘털 분석을 위한 종합 데이터 수집
 */
export const fetchStockAnalytics = async (symbol) => {
    try {
        const token = await getAccessToken();
        const commonHeaders = { ...getKisHeaders(''), 'authorization': `Bearer ${token}` };

        const [financials, technicals] = await Promise.all([
            // 재무 제표 (수익성 확인용)
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

        // 기술적 분석 지표 계산 실행
        const technicalIndicators = calculateTechnicalIndicators(priceData);

        return { financeData, priceData, technicalIndicators };
    } catch (e) {
        console.warn(`Analytics fetch failed for ${symbol}:`, e.message);
        return null;
    }
};

/**
 * 특정 종목의 외국인/기관 매매 추이 조회 (FHKST01010900)
 * 5일/20일 누적 순매수 수량 및 연속 매수 일수를 정량 분석하여 리턴합니다.
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
        
        if (response.data.rt_cd !== '0' || !response.data.output || !Array.isArray(response.data.output)) {
            return { rawSummary: "데이터 없음", stats: null };
        }

        const data = response.data.output;

        // 최근 3거래일치 단순 요약
        const rawSummary = data.slice(0, 3).map(it => 
            `${it.stck_bsop_date}: [외인:${it.frgn_ntby_qty}, 기관:${it.orgn_ntby_qty}, 개인:${it.pru_ntby_qty}]`
        ).join(' | ');

        // 1. 5일 누적 수급 계산
        let foreign5D = 0;
        let organ5D = 0;
        for (let i = 0; i < Math.min(5, data.length); i++) {
            foreign5D += parseInt(data[i].frgn_ntby_qty) || 0;
            organ5D += parseInt(data[i].orgn_ntby_qty) || 0;
        }

        // 2. 20일 누적 수급 계산
        let foreign20D = 0;
        let organ20D = 0;
        for (let i = 0; i < Math.min(20, data.length); i++) {
            foreign20D += parseInt(data[i].frgn_ntby_qty) || 0;
            organ20D += parseInt(data[i].orgn_ntby_qty) || 0;
        }

        // 3. 연속 순매수 일수 계산 (오늘부터 역산하여 순매수가 양수(+)인 기간)
        let foreignConsecutiveDays = 0;
        for (let i = 0; i < data.length; i++) {
            const qty = parseInt(data[i].frgn_ntby_qty) || 0;
            if (qty > 0) foreignConsecutiveDays++;
            else break;
        }

        let organConsecutiveDays = 0;
        for (let i = 0; i < data.length; i++) {
            const qty = parseInt(data[i].orgn_ntby_qty) || 0;
            if (qty > 0) organConsecutiveDays++;
            else break;
        }

        return {
            rawSummary,
            stats: {
                foreign5D,
                organ5D,
                foreign20D,
                organ20D,
                foreignConsecutiveDays,
                organConsecutiveDays
            }
        };
    } catch (e) {
        console.warn(`Investor trend fetch failed for ${symbol}:`, e.message);
        return { rawSummary: "데이터 불러오기 실패", stats: null };
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
