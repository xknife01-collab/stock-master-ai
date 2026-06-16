import express from 'express';
import axios from 'axios';
import { KIS_BASE_URL, ensureToken, getKisHeaders, getCurrentToken, getAccessToken } from '../lib/kisCore.js';
import { getSupplyCache, saveSupplyCache } from '../lib/supplyCache.js';

const router = express.Router();
 
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

let cachedDashboard = null;
let lastDashboardFetch = 0;
const CACHE_TTL = 60000; // 1분

export const setupDashboardApi = () => {
    router.get('/', ensureToken, async (req, res) => {
        const now = Date.now();
        if (cachedDashboard && (now - lastDashboardFetch < CACHE_TTL)) {
            console.log('[Dashboard] Serving from cache');
            return res.json(cachedDashboard);
        }

        try {
            const sectorCodes = [
                { name: 'KOSPI', code: '0001' }, { name: 'KOSDAQ', code: '1001' }, { name: 'KOSPI200', code: '2001' },
                { name: '전기전자', code: '0013' }, { name: '운수장비', code: '0017' },
                { name: '서비스업', code: '0022' }, { name: '금융업', code: '0019' },
                { name: '유통업', code: '0014' }, { name: '화학', code: '0008' },
                { name: '건설업', code: '0016' }, { name: '철강금속', code: '0010' }
            ];

            const fetchKisIndex = async (item) => {
                try {
                    await sleep(100); // 0.1초 간격 (초당 10개 제한 대비)
                    const response = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-index-price`, {
                        params: { 
                            FID_COND_MRKT_DIV_CODE: 'U', 
                            FID_INPUT_ISCD: item.code,
                            FID_ETC_CLS_CODE: ''
                        },
                        headers: getKisHeaders('FHPUP02100000')
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

            let themes = [];
            try {
                const tRes = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-index-category-price`, {
                    params: {
                        FID_COND_MRKT_DIV_CODE: 'U', FID_INPUT_ISCD: '0001',
                        FID_COND_SCR_DIV_CODE: '20214', FID_MRKT_CLS_CODE: 'K', FID_BLNG_CLS_CODE: '0'
                    },
                    headers: getKisHeaders('FHPUP02140000')
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
                console.warn('[Dashboard Themes Error] Failed to fetch themes:', themeError.message);
            }

            const fetchRankings = async (investor, type) => {
                const cacheKey = `dashboard_${investor}_${type}`;
                try {
                    await sleep(150); // 충분한 간격
                    const response = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/foreign-institution-total`, {
                        params: {
                            FID_COND_MRKT_DIV_CODE: 'V', FID_COND_SCR_DIV_CODE: '16449',
                            FID_INPUT_ISCD: '0000', FID_DIV_CLS_CODE: '1',
                            FID_RANK_SORT_CLS_CODE: type === 'buy' ? '0' : '1',
                            FID_ETC_CLS_CODE: investor === '9000' ? '1' : '2'
                        },
                        headers: getKisHeaders('FHPTJ04400000')
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
                    
                    // Fallback to cache if empty
                    const cached = getSupplyCache(cacheKey);
                    if (cached && cached.length > 0) {
                        return cached;
                    }
                    return [];
                } catch (e) { 
                    const cached = getSupplyCache(cacheKey);
                    if (cached && cached.length > 0) return cached;
                    return []; 
                }
            };

            const [fBuy, fSell, iBuy, iSell] = await Promise.all([
                fetchRankings('9000', 'buy'), fetchRankings('9000', 'sell'),
                fetchRankings('1000', 'buy'), fetchRankings('1000', 'sell')
            ]);
            console.log(`[Dashboard] Foreign: ${fBuy.length}/${fSell.length}, Inst: ${iBuy.length}/${iSell.length}`);

            let topStocks = Array.from({length: 8}, () => []);
            try {
                await sleep(200);
                const volRes = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/volume-rank`, {
                    params: {
                        FID_COND_MRKT_DIV_CODE: 'J', FID_COND_SCR_DIV_CODE: '20171',
                        FID_INPUT_ISCD: '0000', FID_DIV_CLS_CODE: '0', 
                        FID_BLNG_CLS_CODE: '0', FID_TRGT_CLS_CODE: '0',
                        FID_TRGT_EXLS_CLS_CODE: '0', FID_INPUT_PRICE_1: '0', FID_INPUT_PRICE_2: '0',
                        FID_VOL_CNT: '0', FID_INPUT_DATE_1: ''
                    },
                    headers: getKisHeaders('FHPST01710000')
                });
                if (volRes.data.rt_cd === '0' && volRes.data.output && volRes.data.output.length > 0) {
                    topStocks[0] = volRes.data.output.slice(0, 10).map(it => ({
                        n: it.hts_kor_isnm, s: it.mksc_shrn_iscd, p: it.stck_prpr, pct: it.prdy_ctrt + '%'
                    }));
                    saveSupplyCache('dashboard_volume_rank', topStocks[0]);
                } else {
                    console.warn(`[Dashboard Volume Rank] KIS returned error rt_cd: ${volRes.data.rt_cd}, msg: ${volRes.data.msg1}. Fallback to cache.`);
                    topStocks[0] = getSupplyCache('dashboard_volume_rank') || [];
                }
            } catch (volError) {
                console.warn('[Dashboard Volume Rank Error] Failed to fetch volume rank, using cache fallback:', volError.message);
                topStocks[0] = getSupplyCache('dashboard_volume_rank') || [];
            }

            try {
                await sleep(200);
                const gainerRes = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/ranking/fluctuation`, {
                    params: {
                        FID_COND_MRKT_DIV_CODE: 'J', FID_COND_SCR_DIV_CODE: '20172',
                        FID_INPUT_ISCD: '0000', FID_RANK_SORT_CLS_CODE: '0', 
                        FID_INPUT_CNT_1: '0', FID_PRC_CLS_CODE: '1', FID_INPUT_PBMS_1: '0',
                        FID_BLNG_CLS_CODE: '0', FID_DIV_CLS_CODE: '0', FID_TRGT_CLS_CODE: '0',
                        FID_TRGT_EXLS_CLS_CODE: '0', FID_PRC_RANGE_CLS_CODE: '0',
                        FID_INPUT_PRICE_1: '0', FID_INPUT_PRICE_2: '0', FID_VOL_CNT: '0'
                    },
                    headers: getKisHeaders('FHPST01720000')
                });
                if (gainerRes.data.rt_cd === '0' && gainerRes.data.output && gainerRes.data.output.length > 0) {
                    topStocks[1] = gainerRes.data.output.slice(0, 10).map(it => ({
                        n: it.hts_kor_isnm, s: it.mksc_shrn_iscd, p: it.stck_prpr, pct: it.prdy_ctrt + '%'
                    }));
                    saveSupplyCache('dashboard_fluctuation_rank', topStocks[1]);
                } else {
                    console.warn(`[Dashboard Fluctuation] KIS returned error rt_cd: ${gainerRes.data.rt_cd}, msg: ${gainerRes.data.msg1}. Fallback to cache.`);
                    topStocks[1] = getSupplyCache('dashboard_fluctuation_rank') || [];
                }
            } catch (gainerError) {
                console.warn('[Dashboard Fluctuation Error] Failed to fetch fluctuations, using cache fallback:', gainerError.message);
                topStocks[1] = getSupplyCache('dashboard_fluctuation_rank') || [];
            }

            const result = { topStocks, foreign: [fBuy, fSell], inst: [iBuy, iSell], sectors, themes };
            cachedDashboard = result;
            lastDashboardFetch = now;
            res.json(result);
        } catch (e) { 
            console.error('[Dashboard Error]', e.message);
            res.status(500).json({ error: e.message }); 
        }
    });
    return router;
};

export default router;
