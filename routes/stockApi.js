import express from 'express';
import axios from 'axios';
import { KIS_BASE_URL, ensureToken, getKisHeaders, fetchStockInvestorTrend, kisRequest, fetchStockIntradayInvestorEstimate } from '../lib/kisCore.js';
import supabase from '../lib/supabaseClient.js';
import { syncSingleStock, registerActiveSymbol } from '../lib/stockSync.js';

const router = express.Router();

const stockCache = new Map();
const historyCache = new Map(); // cache cleared at 1774927430597
const CACHE_TTL = 60000; // 1분

const pendingStockPromises = new Map();
const pendingHistoryPromises = new Map();

const generateMockChart = (basePrice, rangeType) => {
    let pointCount = 30;
    let step = 1;
    let volatility = 0.03;
    let bias = 0.01;
    if (rangeType === '1D') { pointCount = 26; volatility = 0.005; bias = 0.002; }
    else if (rangeType === '1W') { pointCount = 7; volatility = 0.02; bias = 0.005; }
    else if (rangeType === '1Y') { pointCount = 52; step = 7; volatility = 0.12; bias = 0.04; }

    const data = [];
    let cur = basePrice * (rangeType === '1Y' ? 0.7 : (rangeType === '1D' ? 0.98 : 0.9)); 
    
    // 한국 시간(KST) 명시적 기준선 설정
    const krNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const krHHMM = krNow.toISOString().slice(11, 16); // "12:31"

    for(let i=0; i<=pointCount; i++) {
        const d = new Date(Date.now() + 9 * 60 * 60 * 1000); // KST 기반으로 시간 생성
        if (rangeType === '1D') { 
            d.setUTCHours(0, 0, 0, 0); // KST 09:00 (UTC 00:00)
            const newMinutes = i * 15;
            d.setUTCMinutes(d.getUTCMinutes() + newMinutes); 
            
            const timeStr = d.toISOString().slice(11, 16);
            if (timeStr > krHHMM) break; // 현재 시각보다 미래면 중단
        }
        else { d.setDate(d.getDate() - (pointCount - i) * step); }
        
        cur += cur * (Math.random() * volatility - bias);
        if(i === pointCount) cur = basePrice;
        
        const dateStr = rangeType === '1D' 
            ? `${(d.getUTCHours() + 9) % 24}`.padStart(2, '0') + ':' + d.getUTCMinutes().toString().padStart(2, '0')
            : (rangeType === '1Y' ? `${(d.getFullYear()%100)}.${(d.getMonth()+1).toString().padStart(2, '0')}` : `${(d.getMonth()+1).toString().padStart(2, '0')}/${(d.getDate()).toString().padStart(2, '0')}`);
        
        data.push({ date: dateStr, price: parseFloat(cur.toFixed(2)) });
    }
    return data;
};

// 1. 주식 현재가 조회
router.get('/:symbol', ensureToken, async (req, res) => {
    const { symbol } = req.params;
    try {
        const response = await kisRequest({
            method: 'get',
            url: `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-price`,
            params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol },
            headers: getKisHeaders('FHKST01010100')
        });

        const data = response.data.output;
        if (!data) {
             return res.status(404).json({ error: 'Stock not found' });
        }
        
        const result = {
            name: data.hstc_nm || symbol,
            price: parseFloat(data.stck_prpr) || 0,
            change: parseFloat(data.prdy_ctrt) || 0,
            high: parseFloat(data.stck_hgpr) || 0,
            low: parseFloat(data.stck_lwpr) || 0,
            volume: parseFloat(data.acml_vol) || 0
        };

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch stock data', details: error.message });
    }
});

// 2. 주식 일봉 차트 정보 조회
router.get('/history/:symbol', ensureToken, async (req, res) => {
    const { symbol } = req.params;
    const range = req.query.range || '1M';
    const queryPrice = req.query.price ? parseFloat(req.query.price.replace(/[^0-9.]/g, '')) : null;

    const indexSymbols = { 'KOSPI': '0001', 'KOSDAQ': '1001', 'KOSPI200': '2001' };
    const targetSymbol = indexSymbols[symbol] || symbol;
    const isIndex = !!indexSymbols[symbol] || (targetSymbol.length <= 4 && /^\d+$/.test(targetSymbol));

    const cacheKey = `${symbol}_${range}`;
    const now = Date.now();
    if (historyCache.has(cacheKey) && (now - historyCache.get(cacheKey).timestamp < CACHE_TTL)) {
        let cachedData = historyCache.get(cacheKey).data;
        // [캐시 방어막] 캐시된 데이터라도 1D라면 현재 시각 이후의 데이터는 오려냄
        if (range === '1D' && Array.isArray(cachedData)) {
            const krNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
            const curHHMM = krNow.getUTCHours().toString().padStart(2, '0') + ":" + krNow.getUTCMinutes().toString().padStart(2, '0');
            cachedData = cachedData.filter(p => p.date <= curHHMM);
        }
        return res.json(cachedData);
    }

    const isIntraday = range === '1D';
    let trId = isIntraday ? 'FHKST03010200' : 'FHKST03010100';
    let url = isIntraday ? '/uapi/domestic-stock/v1/quotations/inquire-time-itemchartprice' : '/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice';
    if (isIndex) {
        trId = isIntraday ? 'FHKUP03500200' : 'FHKUP03500100'; 
        url = isIntraday ? '/uapi/domestic-stock/v1/quotations/inquire-time-indexchartprice' : '/uapi/domestic-stock/v1/quotations/inquire-daily-indexchartprice';
    }

    if (!/^\d{3,6}$/.test(targetSymbol) && !isIndex) {
        return res.json(generateMockChart(queryPrice || 50000, range));
    }

    if (pendingHistoryPromises.has(cacheKey)) {
        return pendingHistoryPromises.get(cacheKey).then(data => res.json(data)).catch(err => res.status(500).json({ error: err.message }));
    }

    const fetchPromise = (async () => {
        try {
            let finalHistory = [];
            const params = isIntraday ? (isIndex ? {
                FID_COND_MRKT_DIV_CODE: 'U',
                FID_INPUT_ISCD: targetSymbol,
                FID_INPUT_HOUR_1: '', 
                FID_PW_DATA_INCU_YN: 'N',
                FID_ETC_CLS_CODE: ''
            } : {
                FID_COND_MRKT_DIV_CODE: 'J',
                FID_INPUT_ISCD: targetSymbol,
                FID_INPUT_HOUR_1: '', 
                FID_PW_DATA_INCU_YN: 'N'
            }) : {
                FID_COND_MRKT_DIV_CODE: isIndex ? 'U' : 'J',
                FID_INPUT_ISCD: targetSymbol,
                FID_INPUT_DATE_1: '20240101',
                FID_INPUT_DATE_2: new Date().toISOString().slice(0,10).replace(/-/g,''),
                FID_PERIOD_DIV_CODE: 'D',
                FID_ORG_ADJ_PRC: '0',
                FID_ETC_CLS_CODE: ''
            };

            const response = await kisRequest({
                method: 'get',
                url: `${KIS_BASE_URL}${url}`,
                params,
                headers: getKisHeaders(trId)
            });

            if (response.data.rt_cd === '0') {
                const output2 = response.data.output2 || [];
                // 한국 시간(KST) 기준으로 현재 HHMM 생성
                const krNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
                const currentTimeStr = krNow.getUTCHours().toString().padStart(2,'0') + krNow.getUTCMinutes().toString().padStart(2,'0');
                
                finalHistory = output2.reverse().map(item => {
                    const fullTimeStr = item.bstp_nmix_cntg_hour || item.stck_cntg_hour || item.stck_bsop_date || '';
                    const timeStr = fullTimeStr.slice(0, 4); // HHMM만 추출
                    
                    // 현재 시각보다 미래의 데이터는 건너뛰기
                    if (isIntraday && timeStr > currentTimeStr) return null;

                    const priceVal = isIndex ? (item.bstp_nmix_prpr || item.bstp_nmix_clpr) : (item.output_prpr || item.stck_prpr || item.stck_clpr);
                    
                    let finalDateStr = fullTimeStr;
                    if (isIntraday) {
                        finalDateStr = timeStr.length >= 4 ? `${timeStr.slice(0, 2)}:${timeStr.slice(2, 4)}` : timeStr;
                    } else if (fullTimeStr.length >= 8) {
                        if (range === '1Y') finalDateStr = `${fullTimeStr.slice(2, 4)}.${fullTimeStr.slice(4, 6)}`;
                        else finalDateStr = `${fullTimeStr.slice(4, 6)}/${fullTimeStr.slice(6, 8)}`;
                    }

                    return {
                        date: finalDateStr,
                        price: parseFloat(priceVal) || 0
                    };
                }).filter(Boolean); // 필터링된(null) 항목 제거
            }

            if (finalHistory.length === 0 || finalHistory.every(p => p.price === 0)) {
                let fallbackBase = (symbol === 'KOSPI' ? 2680 : (symbol === 'KOSDAQ' ? 760 : (symbol === 'KOSPI200' ? 360 : (queryPrice || 50000))));
                return generateMockChart(fallbackBase, range);
            }

            let finalData = finalHistory;
            if (range === '1W') finalData = finalHistory.slice(-7);
            else if (range === '1M') finalData = finalHistory.slice(-30);

            // [최종 방어 로직] 1D 요청 시 현재 시각 이후의 데이터는 무조건 제거 (3시 데이터 방지) - KST 기준
            if (range === '1D') {
                const krNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
                const curHH = krNow.getUTCHours().toString().padStart(2, '0');
                const curMM = krNow.getUTCMinutes().toString().padStart(2, '0');
                const curHHMM = `${curHH}:${curMM}`;
                finalData = finalData.filter(p => p.date <= curHHMM);
            }

            historyCache.set(cacheKey, { timestamp: now, data: finalData });
            return finalData;
        } catch (e) {
            console.error(`❌ [KIS Index Error] ${symbol}:`, e.response?.data || e.message);
            let fPrice = (symbol === 'KOSPI' ? 2680 : (symbol === 'KOSDAQ' ? 760 : (symbol === 'KOSPI200' ? 360 : (queryPrice || 50000))));
            return generateMockChart(fPrice, range);
        } finally {
            pendingHistoryPromises.delete(cacheKey);
        }
    })();

    pendingHistoryPromises.set(cacheKey, fetchPromise);

    try {
        let result = await fetchPromise;

        // [KST 기반 최종 방어막]
        if (range === '1D' && Array.isArray(result)) {
            const krTime = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(11, 16);
            result = result.filter(p => p.date <= krTime);
        }

        res.json(result);
    } catch (error) {
        let fallback = generateMockChart(queryPrice || 10000, range);
        // Fallback에도 한 번 더 필터링
        if (range === '1D' && Array.isArray(fallback)) {
            const krTime = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(11, 16);
            fallback = fallback.filter(p => p.date <= krTime);
        }
        res.json(fallback);
    }
});

// 3. 종목 상세 펀더멘털 정보 조회
router.get('/detail/:symbol', ensureToken, async (req, res) => {
    const { symbol } = req.params;
    
    try {
        // 1. Supabase 캐시 우선 조회
        let cachedData = null;
        if (supabase) {
            const { data, error } = await supabase
                .from('stock_detail_cache')
                .select('*')
                .eq('symbol', symbol)
                .single();
            if (!error && data) {
                cachedData = data;
            }
        }

        if (cachedData && cachedData.fundamental) {
            // 캐시가 존재하면 즉시 반환 (0.1초 만에 완료!)
            registerActiveSymbol(symbol);
            
            const ageMs = Date.now() - new Date(cachedData.updated_at).getTime();
            const isFresh = ageMs < 15 * 60 * 1000;
            
            if (!isFresh) {
                // 캐시가 오래되었다면 백그라운드에서 비동기로 갱신 (클라이언트는 블로킹되지 않음)
                console.log(`🔄 [Stale-While-Revalidate] Cache stale (${(ageMs/60000).toFixed(1)}m old) for ${symbol}. Triggering background refresh...`);
                syncSingleStock(symbol).catch(err => {
                    console.error(`⚠️ [Stale-While-Revalidate Background Sync Failed] ${symbol}:`, err.message);
                });
            }
            
            const fundamental = {
                ...cachedData.fundamental,
                advanced: cachedData.advanced
            };
            return res.json({ fundamental });
        }

        // 2. 캐시가 완전히 없는 경우에만 블로킹 실시간 KIS 조회 및 업서트 (On-Demand Caching)
        console.log(`📡 [On-Demand Detail] No cache found. Fetching fresh details for: ${symbol}`);
        const freshData = await syncSingleStock(symbol);
        
        if (freshData && freshData.fundamental && freshData.advanced) {
            registerActiveSymbol(symbol);

            const fundamental = {
                ...freshData.fundamental,
                advanced: freshData.advanced
            };
            return res.json({ fundamental });
        }

        res.status(500).json({ error: '상세 정보 조회에 실패했습니다.' });
    } catch (e) {
        console.error(`❌ [Detail API Error] Exception for ${symbol}:`, e.message);
        res.status(500).json({ error: e.message });
    }
});

export default router;