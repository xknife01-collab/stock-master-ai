import axios from 'axios';
import dotenv from 'dotenv';
import supabase from './supabaseClient.js';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import iconv from 'iconv-lite';

dotenv.config();

const isVirtual = process.env.VITE_KIS_APP_KEY && process.env.VITE_KIS_APP_KEY.startsWith('PS');
export const KIS_BASE_URL = isVirtual 
    ? 'https://openapivts.koreainvestment.com:29443' 
    : 'https://openapi.koreainvestment.com:9443';

let accessToken = '';
let tokenExpires = 0;
let fetchingTokenPromise = null;

const tokenPath = './kis_token.json';
const __dirname = path.resolve();
const localStockMasterPath = path.join(__dirname, 'kis_stock_master.json');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const clearLocalTokenCache = () => {
    accessToken = '';
    tokenExpires = 0;
    fetchingTokenPromise = null;
    try {
        if (fs.existsSync(tokenPath)) {
            fs.unlinkSync(tokenPath);
        }
        console.log('🗑️ [KIS Cache] Local token file cache deleted.');
    } catch (e) {
        console.warn('⚠️ [KIS Cache] Failed to delete local token file:', e.message);
    }
};

export const invalidateSharedToken = async () => {
    clearLocalTokenCache();
    if (supabase) {
        try {
            const { error } = await supabase
                .from('stock_master_map')
                .delete()
                .eq('name', '__kis_token__');
            if (error) {
                console.error('❌ [Supabase] Failed to delete shared token in Supabase:', error.message);
            } else {
                console.log('🗑️ [Supabase] Invalidated shared KIS token in Cloud DB');
            }
        } catch (e) {
            console.error('❌ [Supabase] Error deleting shared token in Supabase:', e.message);
        }
    }
};

/**
 * KIS API 호출용 자동 재시도 및 백오프 적용 공통 요청 래퍼
 */
export const kisRequest = async (config, retries = 3, delayMs = 2500) => {
    if (!config.timeout) {
        config.timeout = 10000; // 10초 타임아웃
    }
    
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await axios(config);
            const data = response.data;
            
            if (data && data.rt_cd && data.rt_cd !== '0') {
                const msg = data.msg1 || '';
                const msgCd = data.msg_cd || '';
                
                const isRateLimit = msgCd === 'EGW00133' || 
                                    msg.includes('초과') || 
                                    msg.includes('제한') || 
                                    msg.includes('TPS') || 
                                    msg.includes('과부하');
                                    
                if (isRateLimit) {
                    if (attempt < retries) {
                        console.warn(`⚠️ [KIS API Rate Limit] Attempt ${attempt}/${retries} failed. Msg: ${msg}. Retrying in ${delayMs}ms...`);
                        await delay(delayMs);
                        continue;
                    }
                }
                
                // Throw KIS API Error
                throw new Error(`[KIS API Error] rt_cd: ${data.rt_cd}, msg_cd: ${msgCd}, msg: ${msg}`);
            }
            return response;
        } catch (error) {
            const status = error.response?.status;
            const data = error.response?.data;
            const msgCd = data?.msg_cd || '';
            const msg1 = data?.msg1 || '';
            
            const isTokenExpired = msgCd === 'EGW00123' || msg1.includes('만료된 token') || msg1.includes('초과된 token');
            
            if (isTokenExpired) {
                console.warn(`🚨 [KIS API Token Expired] Token expired/invalidated (msg_cd: ${msgCd}, msg1: ${msg1}). Invalidating shared token and fetching fresh one...`);
                await invalidateSharedToken();
                
                if (!config.url.includes('/oauth2/tokenP')) {
                    try {
                        const newToken = await getAccessToken();
                        config.headers = config.headers || {};
                        config.headers['authorization'] = `Bearer ${newToken}`;
                        console.log(`✅ [KIS API Token Expired] Token successfully refreshed. Retrying request...`);
                        return await axios(config);
                    } catch (refreshErr) {
                        console.error(`❌ [KIS API Token Expired] Failed to refresh token during auto-recovery:`, refreshErr.message);
                    }
                }
            }
            
            const isRetryable = status === 429 || status >= 500 || error.code === 'ECONNABORTED' || error.message.includes('timeout') || error.message.includes('Network Error');
            
            if (isRetryable && attempt < retries) {
                console.warn(`⚠️ [KIS Network Error] Attempt ${attempt}/${retries} failed (${error.message}). Retrying in ${delayMs}ms...`);
                await delay(delayMs + (attempt * 1000));
                continue;
            }
            throw error;
        }
    }
};

/**
 * 한국투자증권 공식 KOSPI/KOSDAQ 종목코드 마스터 파일 다운로드 및 CP949 바이트 단위 파싱
 */
export const syncStockMasterFromKIS = async () => {
    const tmpDir = path.join(__dirname, 'tmp_mst');
    if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
    }

    const targets = [
        { name: 'KOSPI', url: 'https://new.real.download.dws.co.kr/common/master/kospi_code.mst.zip', file: 'kospi_code.mst', len: 289 },
        { name: 'KOSDAQ', url: 'https://new.real.download.dws.co.kr/common/master/kosdaq_code.mst.zip', file: 'kosdaq_code.mst', len: 283 }
    ];

    const stockMap = {};

    for (const target of targets) {
        try {
            const zipPath = path.join(tmpDir, `${target.file}.zip`);
            console.log(`📡 [KIS Master] Downloading ${target.name} master zip...`);
            const response = await axios({
                method: 'get',
                url: target.url,
                responseType: 'arraybuffer',
                timeout: 15000
            });
            fs.writeFileSync(zipPath, response.data);

            console.log(`📦 [KIS Master] Extracting ${target.name} zip...`);
            if (process.platform === 'win32') {
                const cmd = `powershell -Command "Expand-Archive -Force -Path '${zipPath}' -DestinationPath '${tmpDir}'"`;
                execSync(cmd);
            } else {
                const cmd = `unzip -o "${zipPath}" -d "${tmpDir}"`;
                execSync(cmd);
            }

            const mstFile = path.join(tmpDir, target.file);
            if (fs.existsSync(mstFile)) {
                const buffer = fs.readFileSync(mstFile);
                const recordLength = target.len;
                let count = 0;
                for (let offset = 0; offset < buffer.length; offset += recordLength) {
                    if (offset + recordLength > buffer.length) break;
                    
                    const record = buffer.slice(offset, offset + recordLength);
                    const codeBuf = record.slice(0, 9);
                    const nameBuf = record.slice(21, 61);

                    const code = iconv.decode(codeBuf, 'cp949').trim();
                    const name = iconv.decode(nameBuf, 'cp949').trim();

                    if (code.length === 6 && /^\d+$/.test(code) && name) {
                        const cleanedName = name.replace(/\s+/g, '');
                        stockMap[cleanedName] = code;
                        count++;
                    }
                }
                console.log(`✅ [KIS Master] Parsed ${count} stocks from ${target.name}`);
            }
        } catch (err) {
            console.error(`❌ [KIS Master] Failed to sync ${target.name}:`, err.message);
        }
    }

    if (Object.keys(stockMap).length > 0) {
        fs.writeFileSync(localStockMasterPath, JSON.stringify(stockMap, null, 2), 'utf8');
        console.log(`💾 [KIS Master] Saved ${Object.keys(stockMap).length} stock mappings to local cache file.`);
        return stockMap;
    }
    return null;
};

/**
 * 로컬 캐시 확인 후 KIS 마스터 파일 기반의 종목 코드 매핑 로드 및 동기화
 */
export const initKisStockMaster = async (stockMasterCache = {}) => {
    let stockMap = null;
    if (fs.existsSync(localStockMasterPath)) {
        try {
            const stats = fs.statSync(localStockMasterPath);
            const mtime = new Date(stats.mtime);
            const ageInHours = (Date.now() - mtime.getTime()) / (1000 * 60 * 60);
            
            console.log(`📦 [KIS Master] Local cache file exists (Age: ${ageInHours.toFixed(1)}h)`);
            stockMap = JSON.parse(fs.readFileSync(localStockMasterPath, 'utf8'));
            
            if (ageInHours > 24) {
                console.log(`🔄 [KIS Master] Local cache is stale (>24h). Triggering background update...`);
                syncStockMasterFromKIS().then(newMap => {
                    if (newMap) {
                        Object.assign(stockMasterCache, newMap);
                    }
                }).catch(err => console.error('Background KIS master sync failed:', err.message));
            }
        } catch (e) {
            console.error('Failed to read local stock master file, will re-download:', e.message);
        }
    }

    if (!stockMap) {
        console.log('🔄 [KIS Master] Local cache file missing. Downloading fresh copy...');
        stockMap = await syncStockMasterFromKIS();
    }

    if (stockMap) {
        Object.assign(stockMasterCache, stockMap);
        console.log(`⚡ [KIS Master] Loaded ${Object.keys(stockMap).length} symbols to in-memory map.`);
    }
};

// 초기 로딩: 파일에서 토큰 복구
try {
    if (fs.existsSync(tokenPath)) {
        const saved = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
        if (saved.accessToken && saved.tokenExpires > Date.now()) {
            accessToken = saved.accessToken;
            tokenExpires = saved.tokenExpires;
            console.log('📦 KIS Token restored from file');
        }
    }
} catch (e) { /* ignore */ }

/**
 * KIS Access Token 발급 함수
 */
export const getAccessToken = async () => {
    if (fetchingTokenPromise) return fetchingTokenPromise;

    // 1. 메모리 상의 토큰이 아직 유효한 경우 즉시 반환
    if (accessToken && Date.now() < tokenExpires - 60000) {
        return accessToken;
    }

    fetchingTokenPromise = (async () => {
        try {
            // 2. Supabase 클라우드 데이터베이스에서 공유된 토큰 조회 시도
            if (supabase) {
                try {
                    const { data, error } = await supabase
                        .from('stock_master_map')
                        .select('code')
                        .eq('name', '__kis_token__')
                        .maybeSingle();

                    if (!error && data && data.code) {
                        const saved = JSON.parse(data.code);
                        if (saved.accessToken && saved.tokenExpires > Date.now() + 60000) {
                            accessToken = saved.accessToken;
                            tokenExpires = saved.tokenExpires;
                            console.log('📡 [Supabase] KIS Token restored from Cloud DB (Shared)');
                            return accessToken;
                        }
                    }
                } catch (dbErr) {
                    console.error('⚠️ [Supabase] Failed to check shared KIS token:', dbErr.message);
                }
            }

            // 3. 클라우드 토큰도 없거나 만료된 경우에만 KIS API 직접 호출하여 발급
            console.log('🔄 KIS Access Token 발급을 시도합니다...');
            const response = await kisRequest({
                method: 'post',
                url: `${KIS_BASE_URL}/oauth2/tokenP`,
                data: {
                    grant_type: 'client_credentials',
                    appkey: process.env.VITE_KIS_APP_KEY,
                    appsecret: process.env.VITE_KIS_APP_SECRET
                }
            });

            accessToken = response.data.access_token;
            tokenExpires = Date.now() + ((response.data.expires_in - 60) * 1000);
            
            // 4. 로컬 파일 캐시에 저장
            try {
                fs.writeFileSync(tokenPath, JSON.stringify({ accessToken, tokenExpires }), 'utf8');
            } catch (fsErr) {
                // Read-only filesystem 환경 (예: Vercel) 대비 예외 처리
            }
            
            // 5. Supabase 클라우드 DB에 공유 토큰 저장
            if (supabase) {
                try {
                    await supabase
                        .from('stock_master_map')
                        .upsert({ name: '__kis_token__', code: JSON.stringify({ accessToken, tokenExpires }) }, { onConflict: 'name' });
                    console.log('💾 [Supabase] KIS Token saved to Cloud DB (Shared)');
                } catch (dbSaveErr) {
                    console.error('⚠️ [Supabase] Failed to save shared KIS token:', dbSaveErr.message);
                }
            }
            
            console.log('✅ KIS Access Token 발급 성공');
            return accessToken;
        } catch (error) {
            console.error('❌ Token 발급 에러:', error.response?.data || error.message);
            const errCode = error.response?.data?.error_code || '';
            const errMsg = error.response?.data?.error_description || error.message || '';
            
            if (errCode === 'EGW00133' || errMsg.includes('EGW00133') || errMsg.includes('초과')) {
                console.warn('⚠️ 토큰 발급 빈도 초과 감지. 타 프로세스 발급 완료 가능성이 있으므로 2초 대기 후 로컬/클라우드 캐시 재확인합니다...');
                await delay(2000);
                
                try {
                    if (fs.existsSync(tokenPath)) {
                        const saved = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
                        if (saved.accessToken && saved.tokenExpires > Date.now() + 10000) {
                            accessToken = saved.accessToken;
                            tokenExpires = saved.tokenExpires;
                            console.log('📦 KIS Token recovered from file after rate limit recovery');
                            return accessToken;
                        }
                    }
                } catch(e) {}
                
                if (supabase) {
                    try {
                        const { data, error: dbErr } = await supabase
                            .from('stock_master_map')
                            .select('code')
                            .eq('name', '__kis_token__')
                            .maybeSingle();

                        if (!dbErr && data && data.code) {
                            const saved = JSON.parse(data.code);
                            if (saved.accessToken && saved.tokenExpires > Date.now() + 10000) {
                                accessToken = saved.accessToken;
                                tokenExpires = saved.tokenExpires;
                                console.log('📡 [Supabase] KIS Token recovered from Cloud DB after rate limit recovery');
                                return accessToken;
                            }
                        }
                    } catch(e) {}
                }

                if (accessToken) {
                    console.warn('⚠️ 기존 토큰 재사용 강제 연장');
                    tokenExpires = Date.now() + (300 * 1000);
                    return accessToken;
                }
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
        const response = await kisRequest({
            method: 'get',
            url: `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-price`,
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
            change: response.data.output.prdy_ctrt,
            name: response.data.output.hstc_nm ? response.data.output.hstc_nm.trim() : null
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
        return { rsi: '-', ma5: 0, ma20: 0, ma60: 0, maAlignment: '데이터 부족', bollinger: null, disparity5: '-', disparity20: '-' };
    }
    
    const prices = priceData.map(p => parseFloat(p.close)).reverse().filter(p => !isNaN(p) && p > 0);
    const n = prices.length;
    if (n < 20) {
        return { rsi: '-', ma5: 0, ma20: 0, ma60: 0, maAlignment: '데이터 부족', bollinger: null, disparity5: '-', disparity20: '-' };
    }
    
    const currentPrice = prices[n - 1];
    
    const getSMA = (arr, periods) => {
        if (arr.length < periods) return 0;
        const slice = arr.slice(-periods);
        return slice.reduce((a, b) => a + b, 0) / periods;
    };
    
    const ma5 = getSMA(prices, 5);
    const ma20 = getSMA(prices, 20);
    const ma60 = n >= 60 ? getSMA(prices, 60) : getSMA(prices, n);
    
    let maAlignment = '혼조세';
    if (ma5 > ma20 && ma20 > ma60) maAlignment = '정배열 (강력한 추세 상승)';
    else if (ma5 < ma20 && ma20 < ma60) maAlignment = '역배열 (하락 추세 지속)';
    
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
    
    const disparity5 = ma5 > 0 ? parseFloat(((currentPrice / ma5) * 100).toFixed(2)) : '-';
    const disparity20 = ma20 > 0 ? parseFloat(((currentPrice / ma20) * 100).toFixed(2)) : '-';
    
    return {
        rsi,
        ma5: Math.round(ma5),
        ma20: Math.round(ma20),
        ma60: Math.round(ma60),
        maAlignment,
        bollinger,
        disparity5,
        disparity20
    };
};

/**
 * 하락 리스크 및 펀던멘털 분석을 위한 종합 데이터 수집
 */
export const fetchStockAnalytics = async (symbol) => {
    try {
        const token = await getAccessToken();
        const commonHeaders = { ...getKisHeaders(''), 'authorization': `Bearer ${token}` };

        const [financials, technicals, ccnlRes, shortRes] = await Promise.allSettled([
            kisRequest({
                method: 'get',
                url: `${KIS_BASE_URL}/uapi/domestic-stock/v1/finance/income-statement`,
                params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol, FID_DIV_CLS_CODE: '0' },
                headers: { ...commonHeaders, 'tr_id': 'FHKST66430200' }
            }),
            kisRequest({
                method: 'get',
                url: `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice`,
                params: {
                    FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol,
                    FID_INPUT_DATE_1: new Date(Date.now() - 250 * 86400000).toISOString().slice(0,10).replace(/-/g,''),
                    FID_INPUT_DATE_2: new Date().toISOString().slice(0,10).replace(/-/g,''),
                    FID_PERIOD_DIV_CODE: 'D', FID_ORG_ADJ_PRC: '1'
                },
                headers: { ...commonHeaders, 'tr_id': 'FHKST03010100' }
            }),
            kisRequest({
                method: 'get',
                url: `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-ccnl`,
                params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol },
                headers: { ...commonHeaders, 'tr_id': 'FHKST01010300' }
            }),
            kisRequest({
                method: 'get',
                url: `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/daily-short-sale`,
                params: {
                    FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol,
                    FID_INPUT_DATE_1: new Date(Date.now() - 30 * 86400000).toISOString().slice(0,10).replace(/-/g,''),
                    FID_INPUT_DATE_2: new Date().toISOString().slice(0,10).replace(/-/g,'')
                },
                headers: { ...commonHeaders, 'tr_id': 'FHPST04830000' }
            })
        ]);

        const val = (r) => r.status === 'fulfilled' ? r.value : null;

        const financialsVal = val(financials);
        const technicalsVal = val(technicals);
        const ccnlVal = val(ccnlRes);
        const shortVal = val(shortRes);

        const financeData = ((financialsVal?.data?.output) || []).slice(0, 3).map(it => ({
            period: it.stac_yymm,
            revenue: it.sale_account,
            profit: it.op_prfi
        }));

        const priceData = ((technicalsVal?.data?.output2) || []).slice(0, 60).map(it => ({
            date: it.stck_bsop_date,
            close: it.stck_clpr,
            vol: it.acml_vol
        }));

        const technicalIndicators = calculateTechnicalIndicators(priceData);
        const strength = ccnlVal?.data?.output?.[0]?.tday_rltv || '-';
        const shortRatio = shortVal?.data?.output2?.[0]?.ssts_vol_rlim || '-';

        return { financeData, priceData, technicalIndicators, strength, shortRatio };
    } catch (e) {
        console.warn(`Analytics fetch failed for ${symbol}:`, e.message);
        return null;
    }
};

// 개별 종목 수급 통계 파일 캐시 경로
const investorStatsCacheFilePath = './investor_stats_cache.json';

const getInvestorStatsFromCache = (symbol) => {
    try {
        if (fs.existsSync(investorStatsCacheFilePath)) {
            const cacheContent = fs.readFileSync(investorStatsCacheFilePath, 'utf8');
            const cacheObj = JSON.parse(cacheContent);
            return cacheObj[symbol] || null;
        }
    } catch (e) {
        console.warn("⚠️ [KIS Stats Cache] Failed to read investor stats cache:", e.message);
    }
    return null;
};

const saveInvestorStatsToCache = (symbol, stats) => {
    try {
        let cacheObj = {};
        if (fs.existsSync(investorStatsCacheFilePath)) {
            const cacheContent = fs.readFileSync(investorStatsCacheFilePath, 'utf8');
            cacheObj = JSON.parse(cacheContent) || {};
        }
        cacheObj[symbol] = {
            stats,
            updatedAt: Date.now()
        };
        fs.writeFileSync(investorStatsCacheFilePath, JSON.stringify(cacheObj, null, 2), 'utf8');
    } catch (e) {
        console.warn("⚠️ [KIS Stats Cache] Failed to write investor stats cache:", e.message);
    }
};

/**
 * 특정 종목의 외국인/기관 매매 추이 조회 (FHKST01010900)
 */
export const fetchStockInvestorTrend = async (symbol) => {
    try {
        const token = await getAccessToken();
        const response = await kisRequest({
            method: 'get',
            url: `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-investor`,
            params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol },
            headers: {
                ...getKisHeaders('FHKST01010900'),
                'authorization': `Bearer ${token}`
            }
        });
        
        if (response.data.rt_cd !== '0' || !response.data.output || !Array.isArray(response.data.output)) {
            console.warn(`⚠️ [KIS Trend] Invalid API response for ${symbol}. Trying local fallback cache.`);
            const cached = getInvestorStatsFromCache(symbol);
            if (cached) {
                return { rawSummary: "데이터 없음 (캐시 대체)", stats: cached.stats };
            }
            return { rawSummary: "데이터 없음", stats: null };
        }

        const data = response.data.output;
        const rawSummary = data.slice(0, 3).map(it => 
            `${it.stck_bsop_date}: [외인:${it.frgn_ntby_qty}, 기관:${it.orgn_ntby_qty}, 개인:${it.prsn_ntby_qty}]`
        ).join(' | ');

        let foreign1D = 0;
        let organ1D = 0;
        let personal1D = 0;

        const isTodayDataEmpty = !data[0] || 
            data[0].frgn_ntby_qty === '' || 
            data[0].frgn_ntby_qty === null || 
            data[0].frgn_ntby_qty === undefined || 
            data[0].frgn_ntby_qty.trim() === '';

        if (!isTodayDataEmpty) {
            foreign1D = parseInt(data[0].frgn_ntby_qty) || 0;
            organ1D = parseInt(data[0].orgn_ntby_qty) || 0;
            personal1D = parseInt(data[0].prsn_ntby_qty) || 0;
        } else if (data[1]) {
            foreign1D = parseInt(data[1].frgn_ntby_qty) || 0;
            organ1D = parseInt(data[1].orgn_ntby_qty) || 0;
            personal1D = parseInt(data[1].prsn_ntby_qty) || 0;
        }

        let foreign5D = 0;
        let organ5D = 0;
        let personal5D = 0;
        for (let i = 0; i < Math.min(5, data.length); i++) {
            foreign5D += parseInt(data[i].frgn_ntby_qty) || 0;
            organ5D += parseInt(data[i].orgn_ntby_qty) || 0;
            personal5D += parseInt(data[i].prsn_ntby_qty) || 0;
        }

        let foreign20D = 0;
        let organ20D = 0;
        let personal20D = 0;
        for (let i = 0; i < Math.min(20, data.length); i++) {
            foreign20D += parseInt(data[i].frgn_ntby_qty) || 0;
            organ20D += parseInt(data[i].orgn_ntby_qty) || 0;
            personal20D += parseInt(data[i].prsn_ntby_qty) || 0;
        }

        let foreignConsecutiveDays = 0;
        let foreignConsecutiveVolume = 0;
        for (let i = 0; i < data.length; i++) {
            const qty = parseInt(data[i].frgn_ntby_qty) || 0;
            if (qty > 0) {
                foreignConsecutiveDays++;
                foreignConsecutiveVolume += qty;
            } else break;
        }

        let organConsecutiveDays = 0;
        let organConsecutiveVolume = 0;
        for (let i = 0; i < data.length; i++) {
            const qty = parseInt(data[i].orgn_ntby_qty) || 0;
            if (qty > 0) {
                organConsecutiveDays++;
                organConsecutiveVolume += qty;
            } else break;
        }

        let personalConsecutiveDays = 0;
        let personalConsecutiveVolume = 0;
        for (let i = 0; i < data.length; i++) {
            const qty = parseInt(data[i].prsn_ntby_qty) || 0;
            if (qty > 0) {
                personalConsecutiveDays++;
                personalConsecutiveVolume += qty;
            } else break;
        }

        const stats = {
            isTodayData: !isTodayDataEmpty,
            foreign1D,
            organ1D,
            personal1D,
            foreign5D,
            organ5D,
            personal5D,
            foreign20D,
            organ20D,
            personal20D,
            foreignConsecutiveDays,
            foreignConsecutiveVolume,
            organConsecutiveDays,
            organConsecutiveVolume,
            personalConsecutiveDays,
            personalConsecutiveVolume
        };

        // 수집 성공 시 로컬 캐시에 저장
        saveInvestorStatsToCache(symbol, stats);

        return { rawSummary, stats };
    } catch (e) {
        console.warn(`⚠️ [KIS Trend] Error fetching investor trend for ${symbol}: ${e.message}. Trying local fallback cache.`);
        const cached = getInvestorStatsFromCache(symbol);
        if (cached) {
            return { rawSummary: "에러 발생 (캐시 대체)", stats: cached.stats };
        }
        throw e;
    }
};

/**
 * 전종목 순위 조회 (상승률, 거래량, 거래대금 등)
 */
export const fetchMarketRankings = async (type = 'GAIN') => {
    try {
        const token = await getAccessToken();
        let trId = 'FHPST01720000';
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
                FID_RANK_SORT_CLS_CODE: type === 'VALUE' ? '1' : '0'
            };
        }

        const response = await kisRequest({
            method: 'get',
            url: `${KIS_BASE_URL}${urlPath}`,
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
            value: it.acml_tr_pbmn
        }));
    } catch (e) {
        console.warn(`Ranking(${type}) fetch failed:`, e.message);
        return [];
    }
};

/**
 * 주식 당일 분봉 조회 (FHKST03010200)
 */
export const fetchIntradayMinChart = async (symbol) => {
    try {
        const token = await getAccessToken();
        const response = await kisRequest({
            method: 'get',
            url: `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-time-itemchartprice`,
            params: {
                FID_COND_MRKT_DIV_CODE: 'J',
                FID_INPUT_ISCD: symbol,
                FID_ETC_CLS_CODE: '',
                FID_PW_DATA_INCU_YN: 'N'
            },
            headers: {
                ...getKisHeaders('FHKST01010100'),
                'tr_id': 'FHKST03010200',
                'authorization': `Bearer ${token}`
            }
        });

        if (response.data.rt_cd !== '0' || !response.data.output2) return [];

        return response.data.output2.map(it => ({
            date: `${it.stck_cntg_hour.slice(0,2)}:${it.stck_cntg_hour.slice(2,4)}`,
            price: parseInt(it.stck_prpr),
            vol: parseInt(it.cntg_vol)
        })).reverse();
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
        const response = await kisRequest({
            method: 'get',
            url: `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/psearch-result`,
            params: {
                user_id: userId,
                seq: seq
            },
            headers: { ...getKisHeaders('HHKST03900300'), 'authorization': `Bearer ${token}` }
        });

        if (response.data.rt_cd !== '0' || !response.data.output) {
            throw new Error(response.data.msg1 || 'API Error');
        }
        return response.data.output.slice(0, 10).map(it => ({
            name: it.hts_kor_isnm || it.name,
            code: it.code || it.mksc_shrn_iscd,
            price: it.stck_prpr || it.price,
            change: it.prdy_ctrt || it.chgrate
        }));
    } catch (e) {
        console.warn(`Condition(${seq}) fetch failed, returning fallback candidates:`, e.message);
        
        // KIS API 에러 발생 시 정상 가동을 위한 고성능 대표주 Fallback 후보군 반환
        const dummyData = {
            '0': [ // 골든크로스 / 급등 후보군
                { code: '005930', name: '삼성전자' },
                { code: '000660', name: 'SK하이닉스' },
                { code: '042700', name: '한미반도체' },
                { code: '007660', name: '이수페타시스' },
                { code: '403870', name: 'HPSP' }
            ],
            '1': [ // 거래량 실린 상승 후보군
                { code: '089030', name: '테크윙' },
                { code: '058470', name: '리노공업' },
                { code: '000990', name: 'DB하이텍' },
                { code: '352820', name: '솔브레인' },
                { code: '067310', name: '하나마이크론' }
            ],
            '2': [ // 주도 테마 핵심주 후보군
                { code: '005930', name: '삼성전자' },
                { code: '000660', name: 'SK하이닉스' },
                { code: '042700', name: '한미반도체' },
                { code: '007660', name: '이수페타시스' },
                { code: '058470', name: '리노공업' }
            ]
        };
        return dummyData[seq] || dummyData['0'];
    }
};

/**
 * 특정 종목의 핵심 기술적 퀀트 데이터 조회
 */
export const fetchStockQuantMetrics = async (symbol) => {
    try {
        const token = await getAccessToken();
        const commonHeaders = { ...getKisHeaders(''), 'authorization': `Bearer ${token}` };

        const [technicals, ccnlRes, shortRes, investorRes] = await Promise.allSettled([
            kisRequest({
                method: 'get',
                url: `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice`,
                params: {
                    FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol,
                    FID_INPUT_DATE_1: new Date(Date.now() - 100 * 86400000).toISOString().slice(0,10).replace(/-/g,''),
                    FID_INPUT_DATE_2: new Date().toISOString().slice(0,10).replace(/-/g,''),
                    FID_PERIOD_DIV_CODE: 'D', FID_ORG_ADJ_PRC: '1'
                },
                headers: { ...commonHeaders, 'tr_id': 'FHKST03010100' }
            }),
            kisRequest({
                method: 'get',
                url: `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-ccnl`,
                params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol },
                headers: { ...commonHeaders, 'tr_id': 'FHKST01010300' }
            }),
            kisRequest({
                method: 'get',
                url: `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/daily-short-sale`,
                params: {
                    FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol,
                    FID_INPUT_DATE_1: new Date(Date.now() - 30 * 86400000).toISOString().slice(0,10).replace(/-/g,''),
                    FID_INPUT_DATE_2: new Date().toISOString().slice(0,10).replace(/-/g,'')
                },
                headers: { ...commonHeaders, 'tr_id': 'FHPST04830000' }
            }),
            kisRequest({
                method: 'get',
                url: `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-investor`,
                params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol },
                headers: { ...commonHeaders, 'tr_id': 'FHKST01010900' }
            })
        ]);

        const val = (r) => r.status === 'fulfilled' ? r.value : null;
        const technicalsVal = val(technicals);
        const ccnlVal = val(ccnlRes);
        const shortVal = val(shortRes);
        const investorVal = val(investorRes);

        const dailyPrices = (technicalsVal?.data?.output2 || []);
        let currentPrice = dailyPrices[0] ? parseInt(dailyPrices[0].stck_clpr || '0') : 0;
        
        // 현재가 0원 반환 방지
        if (currentPrice === 0) {
            const freshPrice = await fetchStockPrice(symbol);
            if (freshPrice) {
                currentPrice = freshPrice.price;
            }
        }

        const calcMA = (prices, n) => {
            const slice = prices.slice(0, n).map(it => parseInt(it.stck_clpr || '0')).filter(v => v > 0);
            return slice.length === 0 ? 0 : slice.reduce((a, b) => a + b, 0) / slice.length;
        };

        const ma5 = calcMA(dailyPrices, 5);
        const ma20 = calcMA(dailyPrices, 20);

        const disparity5 = ma5 > 0 ? parseFloat(((currentPrice / ma5) * 100).toFixed(2)) : 100;
        const disparity20 = ma20 > 0 ? parseFloat(((currentPrice / ma20) * 100).toFixed(2)) : 100;

        const strength = ccnlVal?.data?.output?.[0]?.tday_rltv ? parseFloat(ccnlVal.data.output[0].tday_rltv) : 100;
        const shortRatio = shortVal?.data?.output2?.[0]?.ssts_vol_rlim ? parseFloat(shortVal.data.output2[0].ssts_vol_rlim) : 0;

        const investorData = (investorVal?.data?.output || []);
        const foreign1D = investorData[0] ? (parseInt(investorData[0].frgn_ntby_qty) || 0) : 0;
        const organ1D = investorData[0] ? (parseInt(investorData[0].orgn_ntby_qty) || 0) : 0;
        const personal1D = investorData[0] ? (parseInt(investorData[0].prsn_ntby_qty) || 0) : 0;

        let foreign5D = 0;
        let organ5D = 0;
        let personal5D = 0;
        for (let i = 0; i < Math.min(5, investorData.length); i++) {
            foreign5D += parseInt(investorData[i].frgn_ntby_qty) || 0;
            organ5D += parseInt(investorData[i].orgn_ntby_qty) || 0;
            personal5D += parseInt(investorData[i].prsn_ntby_qty) || 0;
        }

        // 20일 ATR (Average True Range) 계산
        const calculateATR = (prices, period = 20) => {
            if (!prices || prices.length < period + 1) return 0;
            let trSum = 0;
            for (let i = 0; i < period; i++) {
                const high = parseFloat(prices[i].stck_hgpr || '0');
                const low = parseFloat(prices[i].stck_lwpr || '0');
                const prevClose = parseFloat(prices[i + 1]?.stck_clpr || prices[i].stck_opse_prc || '0');

                const tr1 = high - low;
                const tr2 = Math.abs(high - prevClose);
                const tr3 = Math.abs(low - prevClose);

                const tr = Math.max(tr1, tr2, tr3);
                trSum += tr;
            }
            return parseFloat((trSum / period).toFixed(2));
        };

        const atr = calculateATR(dailyPrices, 20);
        const atrPercent = currentPrice > 0 ? parseFloat(((atr / currentPrice) * 100).toFixed(2)) : 0;

        return {
            price: currentPrice,
            disparity5,
            disparity20,
            strength,
            shortRatio,
            investor1D: {
                foreign: foreign1D,
                organ: organ1D,
                personal: personal1D
            },
            investor5D: {
                foreign: foreign5D,
                organ: organ5D,
                personal: personal5D
            },
            atr,
            atrPercent
        };
    } catch (e) {
        console.warn(`Quant metrics fetch failed for ${symbol}:`, e.message);
        return null;
    }
};

/**
 * 30개 후보 종목 리스트의 지표들을 딜레이(250ms)를 주며 안전하게 일괄 수집
 */
export const fetchMultipleStockQuantMetrics = async (symbols) => {
    const results = {};
    for (const symbol of symbols) {
        const metrics = await fetchStockQuantMetrics(symbol);
        if (metrics) {
            results[symbol] = metrics;
        } else {
            results[symbol] = {
                price: 0,
                disparity5: 100,
                disparity20: 100,
                strength: 100,
                shortRatio: 0
            };
        }
        await delay(250); // 안전을 위해 160ms -> 250ms로 지연시간 상향
    }
    return results;
};

/**
 * 특정 종목의 재무 건전성 및 밸류에이션 정보 조회 (ROE, PER, PBR, 분기 영업이익)
 */
export const fetchStockFinancialsForVeto = async (symbol) => {
    try {
        const token = await getAccessToken();
        const commonHeaders = { ...getKisHeaders(''), 'authorization': `Bearer ${token}` };

        const [ratioRes, incomeRes, priceRes] = await Promise.allSettled([
            kisRequest({
                method: 'get',
                url: `${KIS_BASE_URL}/uapi/domestic-stock/v1/finance/financial-ratio`,
                params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol, FID_DIV_CLS_CODE: '0' },
                headers: { ...commonHeaders, 'tr_id': 'FHKST66430300' }
            }),
            kisRequest({
                method: 'get',
                url: `${KIS_BASE_URL}/uapi/domestic-stock/v1/finance/income-statement`,
                params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol, FID_DIV_CLS_CODE: '0' },
                headers: { ...commonHeaders, 'tr_id': 'FHKST66430200' }
            }),
            kisRequest({
                method: 'get',
                url: `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-price`,
                params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol },
                headers: { ...commonHeaders, 'tr_id': 'FHKST01010100' }
            })
        ]);

        const val = (r) => r.status === 'fulfilled' ? r.value : null;
        const ratioVal = val(ratioRes);
        const incomeVal = val(incomeRes);
        const priceVal = val(priceRes);

        const roeRaw = ratioVal?.data?.output?.[0]?.roe_val;
        const roe = roeRaw && roeRaw !== '-' ? parseFloat(roeRaw) : null;

        const perRaw = priceVal?.data?.output?.per;
        const per = perRaw && perRaw !== '-' ? parseFloat(perRaw) : null;
        
        const pbrRaw = priceVal?.data?.output?.pbr;
        const pbr = pbrRaw && pbrRaw !== '-' ? parseFloat(pbrRaw) : null;

        const debtRatioRaw = ratioVal?.data?.output?.[0]?.lblt_rate;
        const debtRatio = debtRatioRaw && debtRatioRaw !== '-' ? parseFloat(debtRatioRaw) : null;

        const opProfits = ((incomeVal?.data?.output) || []).slice(0, 3).map(it => parseFloat(it.op_prfi) || 0);

        return { roe, per, pbr, opProfits, debtRatio };
    } catch (e) {
        console.warn(`Financials for veto failed for ${symbol}:`, e.message);
        return null;
    }
};

/**
 * 지수(KOSPI: '0001', KOSDAQ: '1001')의 최근 일별 종가 데이터 조회
 */
export const fetchIndexDailyHistory = async (symbol) => {
    try {
        const token = await getAccessToken();
        const headers = { ...getKisHeaders('FHKUP03500100'), 'authorization': `Bearer ${token}` };
        
        const now = new Date();
        const endDateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
        
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 60);
        const startDateStr = startDate.toISOString().slice(0, 10).replace(/-/g, '');

        const response = await kisRequest({
            method: 'get',
            url: `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-daily-indexchartprice`,
            params: {
                FID_COND_MRKT_DIV_CODE: 'U',
                FID_INPUT_ISCD: symbol,
                FID_INPUT_DATE_1: startDateStr,
                FID_INPUT_DATE_2: endDateStr,
                FID_PERIOD_DIV_CODE: 'D',
                FID_ORG_ADJ_PRC: '0',
                FID_ETC_CLS_CODE: ''
            },
            headers
        });

        if (response.data && response.data.rt_cd === '0') {
            const output2 = response.data.output2 || [];
            return output2.slice().reverse().map(item => ({
                date: item.stck_bsop_date,
                price: parseFloat(item.bstp_nmix_clpr || item.bstp_nmix_prpr) || 0
            })).filter(p => p.price > 0);
        }
        return [];
    } catch (e) {
        console.warn(`[Index Fetch Error] Failed to fetch index ${symbol}:`, e.message);
        return [];
    }
};

// 장중 가집계 데이터 메모리 & 파일 캐시
const intradayCacheFilePath = './intraday_estimates_cache.json';
let intradayEstimatesCache = null;
let lastIntradayFetchTime = 0;
const INTRADAY_CACHE_TTL = 5 * 60 * 1000; // 5분 (ms)

// 파일 캐시에서 데이터 로드 시도
try {
    if (fs.existsSync(intradayCacheFilePath)) {
        const fileContent = fs.readFileSync(intradayCacheFilePath, 'utf8');
        const parsed = JSON.parse(fileContent);
        if (parsed && typeof parsed.data === 'object' && typeof parsed.timestamp === 'number') {
            intradayEstimatesCache = parsed.data;
            lastIntradayFetchTime = parsed.timestamp;
            console.log(`📦 [KIS Cache] Loaded ${Object.keys(intradayEstimatesCache).length} cached estimates from local file (Age: ${((Date.now() - lastIntradayFetchTime) / 60000).toFixed(1)}m)`);
        }
    }
} catch (e) {
    console.warn("⚠️ [KIS Cache] Failed to load local estimates cache file:", e.message);
}

/**
 * 특정 종목의 당일 실시간 장중 가집계 투자자별 매매동향 조회 (오늘 1일치)
 */
export const fetchStockIntradayInvestorEstimate = async (symbol) => {
    try {
        if (!intradayEstimatesCache || Date.now() - lastIntradayFetchTime > INTRADAY_CACHE_TTL) {
            console.log("🔄 [KIS Cache] Real-time intraday estimates cache expired or missing. Rebuilding...");
            const token = await getAccessToken();
            
            const fetchList = async (code, sort) => {
                try {
                    const res = await kisRequest({
                        method: 'get',
                        url: `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/foreign-institution-total`,
                        params: {
                            FID_COND_MRKT_DIV_CODE: 'V',
                            FID_COND_SCR_DIV_CODE: '16449',
                            FID_INPUT_ISCD: code,
                            FID_DIV_CLS_CODE: '0',
                            FID_RANK_SORT_CLS_CODE: sort,
                            FID_ETC_CLS_CODE: '0'
                        },
                        headers: { ...getKisHeaders('FHPTJ04400000'), 'authorization': `Bearer ${token}` }
                    });
                    return res.data?.output || [];
                } catch (e) {
                    console.warn(`⚠️ [KIS Cache] Failed to fetch list for ${code} (sort: ${sort}):`, e.message);
                    return [];
                }
            };

            const [kospiBuy, kospiSell, kosdaqBuy, kosdaqSell] = await Promise.all([
                fetchList('0001', '0'),
                fetchList('0001', '1'),
                fetchList('1001', '0'),
                fetchList('1001', '1')
            ]);

            const allEmpty = kospiBuy.length === 0 && kospiSell.length === 0 && kosdaqBuy.length === 0 && kosdaqSell.length === 0;
            if (allEmpty) {
                console.log("⚠️ [KIS Cache] API returned empty lists (off-hours or rate limited).");
                if (intradayEstimatesCache) {
                    console.log("👉 [KIS Cache] Retaining last known good estimates from cache.");
                    lastIntradayFetchTime = Date.now(); // 5분 후에 다시 시도하도록 설정
                } else {
                    console.log("👉 [KIS Cache] No previous cache exists. Initializing empty cache.");
                    intradayEstimatesCache = {};
                    lastIntradayFetchTime = Date.now();
                }
            } else {
                const newCache = {};
                const processItems = (items) => {
                    if (!Array.isArray(items)) return;
                    for (const item of items) {
                        const sym = item.mksc_shrn_iscd;
                        if (!sym) continue;
                        const foreign = parseInt(item.frgn_ntby_qty) || 0;
                        const organ = parseInt(item.orgn_ntby_qty) || 0;
                        const personal = -(foreign + organ);
                        newCache[sym] = { foreign, organ, personal };
                    }
                };

                processItems(kospiBuy);
                processItems(kospiSell);
                processItems(kosdaqBuy);
                processItems(kosdaqSell);

                intradayEstimatesCache = newCache;
                lastIntradayFetchTime = Date.now();
                console.log(`✅ [KIS Cache] Rebuilt complete. Cached ${Object.keys(newCache).length} stock estimates.`);

                // 파일에 동기화
                try {
                    fs.writeFileSync(intradayCacheFilePath, JSON.stringify({
                        timestamp: lastIntradayFetchTime,
                        data: intradayEstimatesCache
                    }, null, 2), 'utf8');
                    console.log("💾 [KIS Cache] Saved updated estimates to file.");
                } catch (e) {
                    console.warn("⚠️ [KIS Cache] Failed to save estimates cache file:", e.message);
                }
            }
        }

        const matched = intradayEstimatesCache[symbol];
        if (matched) {
            return matched;
        }
        return null;
    } catch (e) {
        console.warn(`Intraday investor estimate fetch failed for ${symbol}:`, e.message);
        return null;
    }
};

export function deepFindKey(obj, targetKey) {
    if (!obj || typeof obj !== 'object') return null;
    if (obj[targetKey] !== undefined && obj[targetKey] !== null) return obj[targetKey];
    if (Array.isArray(obj)) {
        for (const item of obj) {
            const res = deepFindKey(item, targetKey);
            if (res !== null) return res;
        }
    } else {
        for (const key in obj) {
            if (typeof obj[key] === 'object') {
                const res = deepFindKey(obj[key], targetKey);
                if (res !== null) return res;
            }
        }
    }
    return null;
}

/**
 * KIS API로부터 특정 종목의 모든 상세 정보(재무, 퀀트, 수급 등)를 조회하여 가공된 객체로 조립 반환
 */
export const fetchStockFullDetailFromKIS = async (symbol) => {
    const commonHeaders = getKisHeaders(''); // tr_id는 개별 호출에서 설정
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    try {
        const pricePromise = kisRequest({
            method: 'get',
            url: `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-price`,
            params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol },
            headers: { ...commonHeaders, 'tr_id': 'FHKST01010100' }
        });
        await delay(120);

        const ratioPromise = kisRequest({
            method: 'get',
            url: `${KIS_BASE_URL}/uapi/domestic-stock/v1/finance/financial-ratio`,
            params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol, FID_DIV_CLS_CODE: '0' },
            headers: { ...commonHeaders, 'tr_id': 'FHKST66430300' }
        });
        await delay(120);

        const consensusPromise = kisRequest({
            method: 'get',
            url: `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/estimate-perform`,
            params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol, SHT_CD: symbol },
            headers: { ...commonHeaders, 'tr_id': 'HHKST668300C0' }
        });
        await delay(120);

        const incomePromise = kisRequest({
            method: 'get',
            url: `${KIS_BASE_URL}/uapi/domestic-stock/v1/finance/income-statement`,
            params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol, FID_DIV_CLS_CODE: '0' },
            headers: { ...commonHeaders, 'tr_id': 'FHKST66430200' }
        });
        await delay(120);

        const ccnlPromise = kisRequest({
            method: 'get',
            url: `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-ccnl`,
            params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol },
            headers: { ...commonHeaders, 'tr_id': 'FHKST01010300' }
        });
        await delay(120);

        const shortPromise = kisRequest({
            method: 'get',
            url: `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/daily-short-sale`,
            params: {
                FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol,
                FID_INPUT_DATE_1: new Date(Date.now() - 60 * 86400000).toISOString().slice(0,10).replace(/-/g,''),
                FID_INPUT_DATE_2: new Date().toISOString().slice(0,10).replace(/-/g,'')
            },
            headers: { ...commonHeaders, 'tr_id': 'FHPST04830000' }
        });
        await delay(120);

        const creditPromise = kisRequest({
            method: 'get',
            url: `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/daily-credit-balance`,
            params: {
                FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol,
                FID_INPUT_DATE_1: new Date(Date.now() - 60 * 86400000).toISOString().slice(0,10).replace(/-/g,''),
                FID_INPUT_DATE_2: new Date().toISOString().slice(0,10).replace(/-/g,''),
                FID_COND_SCR_DIV_CODE: '20476'
            },
            headers: { ...commonHeaders, 'tr_id': 'FHPST04760000' }
        });
        await delay(120);

        const dailyPromise = kisRequest({
            method: 'get',
            url: `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice`,
            params: {
                FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol,
                FID_INPUT_DATE_1: new Date(Date.now() - 60 * 86400000).toISOString().slice(0,10).replace(/-/g,''),
                FID_INPUT_DATE_2: new Date().toISOString().slice(0,10).replace(/-/g,''),
                FID_PERIOD_DIV_CODE: 'D', FID_ORG_ADJ_PRC: '1'
            },
            headers: { ...commonHeaders, 'tr_id': 'FHKST03010100' }
        });
        await delay(120);

        const investorPromise = fetchStockInvestorTrend(symbol);
        const intradayPromise = fetchStockIntradayInvestorEstimate(symbol);

        const [priceResult, ratioResult, consensusResult, incomeResult, ccnlResult, shortResult, creditResult, dailyResult, investorResult, intradayResult] = await Promise.allSettled([
            pricePromise, ratioPromise, consensusPromise, incomePromise, ccnlPromise, shortPromise, creditPromise, dailyPromise, investorPromise, intradayPromise
        ]);

        const rejected = [];
        const criticalResults = [
            { name: 'price', res: priceResult },
            { name: 'ratio', res: ratioResult },
            { name: 'ccnl', res: ccnlResult },
            { name: 'short', res: shortResult },
            { name: 'credit', res: creditResult },
            { name: 'daily', res: dailyResult },
            { name: 'investor', res: investorResult }
        ];

        for (const item of criticalResults) {
            if (item.res.status === 'rejected') {
                rejected.push(`${item.name}: ${item.res.reason?.message || item.res.reason}`);
            }
        }

        if (rejected.length > 0) {
            throw new Error(`[Network Error] KIS API request failed for ${symbol}: ${rejected.join(', ')}`);
        }

        const val = (result) => result.status === 'fulfilled' ? result.value : null;
        const priceRes = val(priceResult);
        const ratioRes = val(ratioResult);
        const consensusRes = val(consensusResult);
        const incomeRes = val(incomeResult);
        const ccnlRes = val(ccnlResult);
        const shortRes = val(shortResult);
        const creditRes = val(creditResult);
        const dailyRes = val(dailyResult);
        const investorRes = val(investorResult);
        const intradayRes = val(intradayResult);

        const currentPrice = parseInt(priceRes?.data?.output?.stck_prpr || '0');
        const dailyPrices = (dailyRes?.data?.output2 || []);
        const calcMA = (prices, n) => {
            const slice = prices.slice(0, n).map(it => parseInt(it.stck_clpr || '0')).filter(v => v > 0);
            return slice.length === 0 ? 0 : slice.reduce((a, b) => a + b, 0) / slice.length;
        };
        const disparity5 = calcMA(dailyPrices, 5) > 0 ? ((currentPrice / calcMA(dailyPrices, 5)) * 100).toFixed(2) : '-';
        const disparity20 = calcMA(dailyPrices, 20) > 0 ? ((currentPrice / calcMA(dailyPrices, 20)) * 100).toFixed(2) : '-';

        let strengthVal = priceRes?.data?.output?.tday_rltv || ccnlRes?.data?.output?.[0]?.tday_rltv || '-';

        // 장중 가집계 데이터 병합
        let investorStats = investorRes?.stats || null;
        let isRealtime = false;
        if (investorStats) {
            if (intradayRes) {
                investorStats.foreign1D = intradayRes.foreign;
                investorStats.organ1D = intradayRes.organ;
                investorStats.personal1D = intradayRes.personal;
                isRealtime = true;
            } else {
                isRealtime = investorStats.isTodayData || false;
            }
            investorStats.isRealtime = isRealtime;
        } else if (intradayRes) {
            investorStats = {
                isRealtime: true,
                foreign1D: intradayRes.foreign,
                organ1D: intradayRes.organ,
                personal1D: intradayRes.personal,
                foreign5D: intradayRes.foreign,
                organ5D: intradayRes.organ,
                personal5D: intradayRes.personal,
                foreign20D: intradayRes.foreign,
                organ20D: intradayRes.organ,
                personal20D: intradayRes.personal,
                foreignConsecutiveDays: 0,
                foreignConsecutiveVolume: 0,
                organConsecutiveDays: 0,
                organConsecutiveVolume: 0,
                personalConsecutiveDays: 0,
                personalConsecutiveVolume: 0
            };
        }

        const debtRatioRaw = ratioRes?.data?.output?.[0]?.lblt_rate || '-';

        const fundamental = {
            price: currentPrice,
            per: priceRes?.data?.output?.per || '-',
            pbr: priceRes?.data?.output?.pbr || '-',
            roe: ratioRes?.data?.output?.[0]?.roe_val || '-',
            debtRatio: debtRatioRaw,
            yield: priceRes?.data?.output?.dps || '-',
            consensus: consensusRes?.data?.output1
                ? [{
                    date: consensusRes.data.output1.estdate || '-',
                    target: '-',
                    opinion: consensusRes.data.output1.rcmd_name || '-'
                  }]
                : (consensusRes?.data?.output || []).map(it => ({
                    date: it.stck_bsop_date || it.estdate || '-',
                    target: it.hts_goal_prc || it.stck_hgpr || '-',
                    opinion: it.invt_opnn || it.rcmd_name || '-'
                  })),
            finance: (incomeRes?.data?.output || []).slice(0, 3).map(it => ({
                year: it.stac_yymm,
                revenue: parseFloat(it.sale_account) || 0,
                profit: parseFloat(it.op_prfi) || 0
            })).reverse()
        };

        const rawShort = deepFindKey(shortRes?.data, 'ssts_vol_rlim');
        const shortRatio = rawShort !== null && rawShort !== undefined ? String(rawShort) : '0';

        const rawCredit = deepFindKey(creditRes?.data, 'whol_loan_rmnd_rate');
        const creditBalance = rawCredit !== null && rawCredit !== undefined ? String(rawCredit) : '0';

        const calculateATR = (prices, period = 20) => {
            if (!prices || prices.length < period + 1) return 0;
            let trSum = 0;
            for (let i = 0; i < period; i++) {
                const high = parseFloat(prices[i].stck_hgpr || '0');
                const low = parseFloat(prices[i].stck_lwpr || '0');
                const prevClose = parseFloat(prices[i + 1]?.stck_clpr || prices[i].stck_opse_prc || '0');

                const tr1 = high - low;
                const tr2 = Math.abs(high - prevClose);
                const tr3 = Math.abs(low - prevClose);

                const tr = Math.max(tr1, tr2, tr3);
                trSum += tr;
            }
            return parseFloat((trSum / period).toFixed(2));
        };

        const atr = calculateATR(dailyPrices, 20);
        const atrPercent = currentPrice > 0 ? parseFloat(((atr / currentPrice) * 100).toFixed(2)) : 0;

        const advanced = {
            strength: strengthVal,
            disparity5,
            disparity20,
            shortRatio,
            creditBalance,
            investor: investorStats,
            atr,
            atrPercent
        };

        // 전수 지표 검증기 (Strict Schema & Range Validator)
        const isInvalidNumeric = (val) => {
            if (val === null || val === undefined || val === '-' || val === 'NaN' || val === 'Infinity' || val === '') return true;
            return isNaN(parseFloat(val));
        };

        if (isInvalidNumeric(advanced.strength)) {
            throw new Error(`[Sanity Error] Invalid Volume Strength: ${advanced.strength}`);
        }
        if (isInvalidNumeric(advanced.disparity5) || isInvalidNumeric(advanced.disparity20)) {
            throw new Error(`[Sanity Error] Invalid Disparity (5D: ${advanced.disparity5}, 20D: ${advanced.disparity20})`);
        }
        if (isInvalidNumeric(advanced.shortRatio)) {
            throw new Error(`[Sanity Error] Invalid Short Ratio: ${advanced.shortRatio}`);
        }
        if (isInvalidNumeric(advanced.creditBalance)) {
            throw new Error(`[Sanity Error] Invalid Credit Balance: ${advanced.creditBalance}`);
        }
        if (isInvalidNumeric(advanced.atr) || isInvalidNumeric(advanced.atrPercent)) {
            throw new Error(`[Sanity Error] Invalid ATR (ATR: ${advanced.atr}, ATR%: ${advanced.atrPercent})`);
        }
        if (!advanced.investor || typeof advanced.investor.foreign1D !== 'number' || typeof advanced.investor.organ1D !== 'number') {
            throw new Error(`[Sanity Error] Missing or Malformed Investor Stats`);
        }

        return { fundamental, advanced };
    } catch (e) {
        console.error(`❌ [fetchStockFullDetailFromKIS] Failed for ${symbol}:`, e.message);
        throw e; // 에러를 상위로 전파하여 캐시 오염을 막습니다.
    }
};



