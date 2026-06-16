import express from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { KIS_BASE_URL, getKisHeaders, getAccessToken } from '../lib/kisCore.js';
import { getSupplyCache, saveSupplyCache } from '../lib/supplyCache.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cacheFilePath = path.join(__dirname, '../dashboard_cache.json');

const router = express.Router();
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export let cachedDashboard = null;
let lastDashboardFetch = 0;
let isSyncing = false;

// 🔄 백그라운드 실시간 대시보드 갱신 함수
export const syncDashboardData = async () => {
    if (isSyncing) {
        console.log('🔄 [Dashboard Sync] 이미 동기화가 진행 중입니다. 건너뜁니다.');
        return;
    }
    isSyncing = true;
    console.log('🔄 [Dashboard Sync] 백그라운드 대시보드 데이터 갱신 시작...');
    
    // 메모리에 캐시가 없으면 파일에서 먼저 로드
    if (!cachedDashboard) {
        try {
            if (fs.existsSync(cacheFilePath)) {
                cachedDashboard = JSON.parse(fs.readFileSync(cacheFilePath, 'utf8'));
            }
        } catch (e) {}
    }

    try {
        const sectorCodes = [
            { name: 'KOSPI', code: '0001' }, { name: 'KOSDAQ', code: '1001' }, { name: 'KOSPI200', code: '2001' },
            { name: '전기전자', code: '0013' }, { name: '운수장비', code: '0017' },
            { name: '서비스업', code: '0022' }, { name: '금융업', code: '0019' },
            { name: '유통업', code: '0014' }, { name: '화학', code: '0008' },
            { name: '건설업', code: '0016' }, { name: '철강금속', code: '0010' }
        ];

        // 갱신 시 필요하면 토큰 유효성 검사 및 갱신 수행
        try {
            await getAccessToken();
        } catch (authErr) {
            console.error('❌ [Dashboard Sync] 토큰 갱신 실패:', authErr.message);
        }

        const fetchKisIndex = async (item) => {
            try {
                const response = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-index-price`, {
                    params: { 
                        FID_COND_MRKT_DIV_CODE: 'U', 
                        FID_INPUT_ISCD: item.code,
                        FID_ETC_CLS_CODE: ''
                    },
                    headers: getKisHeaders('FHPUP02100000'),
                    timeout: 2500 // 2.5초 타임아웃 제한
                });
                const d = response.data.output;
                const pct = d?.bstp_nmix_prdy_ctrt;
                if (!pct) return null;
                return {
                    name: item.name, code: item.code,
                    price: d.bstp_nmix_prpr || '0',
                    change: (parseFloat(pct) >= 0 ? '+' : '') + pct + '%',
                    width: Math.min(Math.abs(parseFloat(pct)) * 20, 100) + '%'
                };
            } catch (e) { return null; }
        };

        let sectors = await Promise.all(sectorCodes.map(fetchKisIndex));
        sectors = sectors.filter(s => s !== null);
        
        // 🛡️ 한투 장애 시 기존 캐시 보존
        if (sectors.length === 0 && cachedDashboard?.sectors && cachedDashboard.sectors.length > 0) {
            console.log('🛡️ [Dashboard Sync] Sectors fetch failed, restoring cached sectors.');
            sectors = cachedDashboard.sectors;
        }

        let themes = [];
        try {
            const tRes = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-index-category-price`, {
                params: {
                    FID_COND_MRKT_DIV_CODE: 'U', FID_INPUT_ISCD: '0001',
                    FID_COND_SCR_DIV_CODE: '20214', FID_MRKT_CLS_CODE: 'K', FID_BLNG_CLS_CODE: '0'
                },
                headers: getKisHeaders('FHPUP02140000'),
                timeout: 2500
            });
            if (tRes.data.rt_cd === '0' && tRes.data.output2) {
                themes = tRes.data.output2.slice(0, 15).map(it => {
                    const clean = it.bstp_nmix_prdy_ctrt || '0';
                    return {
                        name: it.hts_kor_isnm, code: it.bstp_cls_code || '',
                        change: (parseFloat(clean) >= 0 ? '+' : '') + clean + '%',
                        lead: '-', width: Math.min(Math.abs(parseFloat(clean)) * 10, 100) + '%'
                    };
                });
            }
        } catch (themeError) {
            console.warn('[Dashboard Themes Error] 테마 로드 실패:', themeError.message);
        }
        
        // 🛡️ 한투 장애 시 기존 캐시 보존
        if (themes.length === 0 && cachedDashboard?.themes && cachedDashboard.themes.length > 0) {
            console.log('🛡️ [Dashboard Sync] Themes fetch failed, restoring cached themes.');
            themes = cachedDashboard.themes;
        }

        const fetchRankings = async (investor, type) => {
            const cacheKey = `dashboard_${investor}_${type}`;
            try {
                const response = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/foreign-institution-total`, {
                    params: {
                        FID_COND_MRKT_DIV_CODE: 'V', FID_COND_SCR_DIV_CODE: '16449',
                        FID_INPUT_ISCD: '0000', FID_DIV_CLS_CODE: '1',
                        FID_RANK_SORT_CLS_CODE: type === 'buy' ? '0' : '1',
                        FID_ETC_CLS_CODE: investor === '9000' ? '1' : '2'
                    },
                    headers: getKisHeaders('FHPTJ04400000'),
                    timeout: 2500
                });
                if (response.data.output && response.data.output.length > 0) {
                    const mapped = response.data.output.slice(0, 10).map((it, idx) => ({
                        num: idx + 1, name: it.hts_kor_isnm, symbol: it.mksc_shrn_iscd,
                        price: (parseFloat(it.stck_prpr)).toLocaleString() + '원',
                        diff: (parseInt(it.frgn_ntby_qty || it.orgn_ntby_qty || 0)).toLocaleString() + '주', isUp: type === 'buy'
                    }));
                    saveSupplyCache(cacheKey, mapped);
                    return mapped;
                }
                return getSupplyCache(cacheKey) || [];
            } catch (e) { 
                return getSupplyCache(cacheKey) || []; 
            }
        };

        const [fBuy, fSell, iBuy, iSell] = await Promise.all([
            fetchRankings('9000', 'buy'), fetchRankings('9000', 'sell'),
            fetchRankings('1000', 'buy'), fetchRankings('1000', 'sell')
        ]);

        let topStocks = Array.from({length: 8}, () => []);
        try {
            const volRes = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/volume-rank`, {
                params: {
                    FID_COND_MRKT_DIV_CODE: 'J', FID_COND_SCR_DIV_CODE: '20171',
                    FID_INPUT_ISCD: '0000', FID_DIV_CLS_CODE: '0', 
                    FID_BLNG_CLS_CODE: '0', FID_TRGT_CLS_CODE: '0',
                    FID_TRGT_EXLS_CLS_CODE: '0', FID_INPUT_PRICE_1: '0', FID_INPUT_PRICE_2: '0',
                    FID_VOL_CNT: '0', FID_INPUT_DATE_1: ''
                },
                headers: getKisHeaders('FHPST01710000'),
                timeout: 2500
            });
            if (volRes.data.rt_cd === '0' && volRes.data.output && volRes.data.output.length > 0) {
                topStocks[0] = volRes.data.output.slice(0, 10).map(it => ({
                    n: it.hts_kor_isnm, s: it.mksc_shrn_iscd, p: it.stck_prpr, pct: it.prdy_ctrt + '%'
                }));
                saveSupplyCache('dashboard_volume_rank', topStocks[0]);
            } else {
                topStocks[0] = getSupplyCache('dashboard_volume_rank') || [];
            }
        } catch (volError) {
            topStocks[0] = getSupplyCache('dashboard_volume_rank') || [];
        }

        try {
            const gainerRes = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/ranking/fluctuation`, {
                params: {
                    FID_COND_MRKT_DIV_CODE: 'J', FID_COND_SCR_DIV_CODE: '20172',
                    FID_INPUT_ISCD: '0000', FID_RANK_SORT_CLS_CODE: '0', 
                    FID_INPUT_CNT_1: '0', FID_PRC_CLS_CODE: '1', FID_INPUT_PBMS_1: '0',
                    FID_BLNG_CLS_CODE: '0', FID_DIV_CLS_CODE: '0', FID_TRGT_CLS_CODE: '0',
                    FID_TRGT_EXLS_CLS_CODE: '0', FID_PRC_RANGE_CLS_CODE: '0',
                    FID_INPUT_PRICE_1: '0', FID_INPUT_PRICE_2: '0', FID_VOL_CNT: '0'
                },
                headers: getKisHeaders('FHPST01720000'),
                timeout: 2500
            });
            if (gainerRes.data.rt_cd === '0' && gainerRes.data.output && gainerRes.data.output.length > 0) {
                topStocks[1] = gainerRes.data.output.slice(0, 10).map(it => ({
                    n: it.hts_kor_isnm, s: it.mksc_shrn_iscd, p: it.stck_prpr, pct: it.prdy_ctrt + '%'
                }));
                saveSupplyCache('dashboard_fluctuation_rank', topStocks[1]);
            } else {
                topStocks[1] = getSupplyCache('dashboard_fluctuation_rank') || [];
            }
        } catch (gainerError) {
            topStocks[1] = getSupplyCache('dashboard_fluctuation_rank') || [];
        }

        // 🛡️ topStocks 개별 카테고리 복원
        for (let idx = 0; idx < 8; idx++) {
            if ((!topStocks[idx] || topStocks[idx].length === 0) && cachedDashboard?.topStocks?.[idx] && cachedDashboard.topStocks[idx].length > 0) {
                topStocks[idx] = cachedDashboard.topStocks[idx];
            }
        }

        const result = { topStocks, foreign: [fBuy, fSell], inst: [iBuy, iSell], sectors, themes };
        cachedDashboard = result;
        lastDashboardFetch = Date.now();
        
        fs.writeFileSync(cacheFilePath, JSON.stringify(result, null, 2), 'utf8');
        console.log('✅ [Dashboard Sync] 백그라운드 동기화 및 파일 캐싱 완료.');
    } catch (e) {
        console.error('❌ [Dashboard Sync] 동기화 중 에러 발생:', e.message);
    } finally {
        isSyncing = false;
    }
};

// ⏰ 백그라운드 동기화 타이머 시작 데몬
export const startDashboardSync = () => {
    // 서버 구동 시 기존 캐시 파일 로드 시도
    try {
        if (fs.existsSync(cacheFilePath)) {
            cachedDashboard = JSON.parse(fs.readFileSync(cacheFilePath, 'utf8'));
            console.log('💾 [Dashboard Sync] 로컬 파일로부터 대시보드 캐시 로드 완료.');
        }
    } catch (err) {
        console.warn('⚠️ [Dashboard Sync] 대시보드 캐시 파일 로드 실패:', err.message);
    }

    // 서버 구동 3초 후 최초 1회 즉시 실행
    setTimeout(syncDashboardData, 3000);
    // 2분마다 백그라운드 갱신
    setInterval(syncDashboardData, 120000);
};

export const setupDashboardApi = () => {
    // 0.1초 반응 속도를 위한 캐시 즉시 반환 라우트
    router.get('/', async (req, res) => {
        if (cachedDashboard) {
            return res.json(cachedDashboard);
        }

        try {
            if (fs.existsSync(cacheFilePath)) {
                cachedDashboard = JSON.parse(fs.readFileSync(cacheFilePath, 'utf8'));
                if (cachedDashboard) return res.json(cachedDashboard);
            }
        } catch (e) {}

        // 캐시 데이터가 아예 없을 때의 기본 스켈레톤 응답
        res.json({
            topStocks: Array.from({length: 8}, () => []),
            foreign: [[], []],
            inst: [[], []],
            sectors: [],
            themes: []
        });
    });
    return router;
};

export default router;
