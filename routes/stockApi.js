import express from 'express';
import axios from 'axios';
import { KIS_BASE_URL, ensureToken, getKisHeaders, fetchStockInvestorTrend, kisRequest, fetchStockIntradayInvestorEstimate, getAccessToken, fetchStockChartFromKIS } from '../lib/kisCore.js';
import supabase from '../lib/supabaseClient.js';
import { syncSingleStock, registerActiveSymbol } from '../lib/stockSync.js';
import { cachedDashboard } from './dashboardApi.js';

const router = express.Router();

const historyCache = new Map();
const CACHE_TTL = 60000; // 1분

const pendingHistoryPromises = new Map();

const isMarketOpen = () => {
    const now = new Date(Date.now() + 9 * 60 * 60 * 1000); // KST
    const day = now.getUTCDay();
    const hour = now.getUTCHours();
    const min = now.getUTCMinutes();
    
    // 주말 제외 (토: 6, 일: 0)
    if (day === 0 || day === 6) return false;
    
    // 장중 시간 (09:00 ~ 15:30)
    const timeVal = hour * 100 + min;
    return (timeVal >= 900 && timeVal <= 1530);
};

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
    
    const krNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const krHHMM = krNow.toISOString().slice(11, 16);

    for(let i=0; i<=pointCount; i++) {
        const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
        if (rangeType === '1D') { 
            d.setUTCHours(0, 0, 0, 0);
            const newMinutes = i * 15;
            d.setUTCMinutes(d.getUTCMinutes() + newMinutes); 
            
            const timeStr = d.toISOString().slice(11, 16);
            if (timeStr > krHHMM) break;
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

const filter1DChartIfNeeded = (chartData) => {
    if (!Array.isArray(chartData)) return [];
    
    const krNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const day = krNow.getUTCDay();
    const hour = krNow.getUTCHours();
    const min = krNow.getUTCMinutes();
    const timeVal = hour * 100 + min;
    
    // 장중(평일 09:00 ~ 15:30)일 때만 미래 시점 데이터 노출을 막기 위해 현재 시간 필터 적용
    const isTodayTradingActive = (day !== 0 && day !== 6) && (timeVal >= 900 && timeVal <= 1530);
    if (isTodayTradingActive) {
        const curHHMM = hour.toString().padStart(2, '0') + ":" + min.toString().padStart(2, '0');
        return chartData.filter(p => p.date <= curHHMM);
    }
    return chartData;
};

// 1. 주식 현재가 조회 (Supabase 캐시 우선 조회 및 Fast-Fallback 적용)
router.get('/:symbol', async (req, res) => {
    const { symbol } = req.params;
    const isKrStock = /^\d{6}$/.test(symbol);

    if (!isKrStock) {
        return res.status(400).json({ error: 'Invalid symbol' });
    }

    let cachedData = null;

    // 1-1. Supabase 캐시 우선 검사
    if (supabase) {
        try {
            const { data, error } = await supabase
                .from('stock_detail_cache')
                .select('fundamental, updated_at')
                .eq('symbol', symbol)
                .single();
            if (!error && data && data.fundamental) {
                cachedData = data;
                
                // 1분 이내의 캐시 데이터라면 실시간 호출 없이 즉시 반환 (0.1초 반응), 장중에만 백그라운드 갱신
                const ageMs = Date.now() - new Date(data.updated_at).getTime();
                if (ageMs > 60000 && isMarketOpen()) {
                    // 1분 이상 지난 오래된 캐시인 경우, 백그라운드에서 비동기로 KIS와 동기화 수행
                    console.log(`🔄 [Price API - Stale While Revalidate] Price cache is stale (${(ageMs/1000).toFixed(1)}s old) for ${symbol}. Triggering background refresh...`);
                    syncSingleStock(symbol).catch(err => {
                        console.error(`⚠️ [Price Background Sync Failed] ${symbol}:`, err.message);
                    });
                }
                return res.json({
                    name: data.fundamental.name || symbol,
                    price: parseFloat(data.fundamental.price) || 0,
                    change: parseFloat(data.fundamental.change) || 0,
                    high: parseFloat(data.fundamental.high) || 0,
                    low: parseFloat(data.fundamental.low) || 0,
                    volume: parseFloat(data.fundamental.volume) || 0
                });
            }
        } catch (dbErr) {
            console.error('⚠️ [Price API DB Cache Read Error]', dbErr.message);
        }
    }

    // 1-2. 캐시 미스인 경우 동기식으로 KIS에서 가져와 Supabase에 저장 후 반환
    try {
        if (!isMarketOpen() && cachedData && cachedData.fundamental) {
            return res.json({
                name: cachedData.fundamental.name || symbol,
                price: parseFloat(cachedData.fundamental.price) || 0,
                change: parseFloat(cachedData.fundamental.change) || 0,
                high: parseFloat(cachedData.fundamental.high) || 0,
                low: parseFloat(cachedData.fundamental.low) || 0,
                volume: parseFloat(cachedData.fundamental.volume) || 0
            });
        }
        console.log(`📡 [On-Demand Price] No cache found. Fetching fresh details for: ${symbol}`);
        const freshData = await syncSingleStock(symbol);
        if (freshData && freshData.fundamental) {
            return res.json({
                name: freshData.fundamental.name || symbol,
                price: parseFloat(freshData.fundamental.price) || 0,
                change: parseFloat(freshData.fundamental.change) || 0,
                high: parseFloat(freshData.fundamental.high) || 0,
                low: parseFloat(freshData.fundamental.low) || 0,
                volume: parseFloat(freshData.fundamental.volume) || 0
            });
        }
        throw new Error('Failed to sync stock details');
    } catch (error) {
        console.error(`❌ [Price API Error] Exception for ${symbol}:`, error.message);
        
        // 실패 시, 낡은 캐시 데이터라도 있으면 즉시 리턴하여 에러 전파 방지
        if (cachedData && cachedData.fundamental) {
            return res.json({
                name: cachedData.fundamental.name || symbol,
                price: parseFloat(cachedData.fundamental.price) || 0,
                change: parseFloat(cachedData.fundamental.change) || 0,
                high: parseFloat(cachedData.fundamental.high) || 0,
                low: parseFloat(cachedData.fundamental.low) || 0,
                volume: parseFloat(cachedData.fundamental.volume) || 0
            });
        }
        res.status(500).json({ error: 'Failed to fetch stock data', details: error.message });
    }
});

// 2. 주식 차트 정보 조회 (Supabase 캐시 우선 및 오늘자 날짜 검증 적용)
router.get('/history/:symbol', async (req, res) => {
    const { symbol } = req.params;
    const range = req.query.range || '1M';
    const queryPrice = req.query.price ? parseFloat(req.query.price.replace(/[^0-9.]/g, '')) : null;

    const indexSymbols = { 'KOSPI': '0001', 'KOSDAQ': '1001', 'KOSPI200': '2001' };
    const targetSymbol = indexSymbols[symbol] || symbol;
    const isIndex = !!indexSymbols[symbol] || (targetSymbol.length <= 4 && /^\d+$/.test(targetSymbol));

    // --- Index 처리 (기존 로직 유지) ---
    if (isIndex) {
        const cacheKey = `${symbol}_${range}`;
        const now = Date.now();
        if (historyCache.has(cacheKey) && (now - historyCache.get(cacheKey).timestamp < CACHE_TTL)) {
            let cachedData = historyCache.get(cacheKey).data;
            if (range === '1D') {
                cachedData = filter1DChartIfNeeded(cachedData);
            }
            return res.json(cachedData);
        }

        const isIntraday = range === '1D';
        const trId = isIntraday ? 'FHKUP03500200' : 'FHKUP03500100'; 
        const url = isIntraday ? '/uapi/domestic-stock/v1/quotations/inquire-time-indexchartprice' : '/uapi/domestic-stock/v1/quotations/inquire-daily-indexchartprice';

        if (pendingHistoryPromises.has(cacheKey)) {
            return pendingHistoryPromises.get(cacheKey).then(data => res.json(data)).catch(err => res.status(500).json({ error: err.message }));
        }

        const getIndexCurrentPrice = (sym) => {
            if (cachedDashboard && Array.isArray(cachedDashboard.sectors)) {
                const sec = cachedDashboard.sectors.find(s => s.name === sym);
                if (sec && sec.price && sec.price !== '0') {
                    const parsed = parseFloat(sec.price.replace(/,/g, ''));
                    if (!isNaN(parsed) && parsed > 0) return parsed;
                }
            }
            return null;
        };

        const fetchPromise = (async () => {
            try {
                const token = await getAccessToken();
                let finalHistory = [];
                const params = isIntraday ? {
                    FID_COND_MRKT_DIV_CODE: 'U',
                    FID_INPUT_ISCD: targetSymbol,
                    FID_INPUT_HOUR_1: '', 
                    FID_PW_DATA_INCU_YN: 'N',
                    FID_ETC_CLS_CODE: ''
                } : {
                    FID_COND_MRKT_DIV_CODE: 'U',
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
                    headers: { ...getKisHeaders(trId), 'authorization': `Bearer ${token}` },
                    timeout: 3000
                }, 1);

                if (response.data.rt_cd === '0') {
                    const output2 = response.data.output2 || [];
                    const krNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
                    const currentTimeStr = krNow.getUTCHours().toString().padStart(2,'0') + krNow.getUTCMinutes().toString().padStart(2,'0');
                    
                    finalHistory = output2.reverse().map(item => {
                        const fullTimeStr = item.bstp_nmix_cntg_hour || item.stck_cntg_hour || item.stck_bsop_date || '';
                        const timeStr = fullTimeStr.slice(0, 4);
                        if (isIntraday && timeStr > currentTimeStr) return null;

                        const priceVal = item.bstp_nmix_prpr || item.bstp_nmix_clpr;
                        let finalDateStr = fullTimeStr;
                        if (isIntraday) {
                            finalDateStr = timeStr.length >= 4 ? `${timeStr.slice(0, 2)}:${timeStr.slice(2, 4)}` : timeStr;
                        } else if (fullTimeStr.length >= 8) {
                            if (range === '1Y') finalDateStr = `${fullTimeStr.slice(2, 4)}.${fullTimeStr.slice(4, 6)}`;
                            else finalDateStr = `${fullTimeStr.slice(4, 6)}/${fullTimeStr.slice(6, 8)}`;
                        }

                        return { date: finalDateStr, price: parseFloat(priceVal) || 0 };
                    }).filter(Boolean);
                }

                if (finalHistory.length === 0 || finalHistory.every(p => p.price === 0)) {
                    const currentPrice = getIndexCurrentPrice(symbol);
                    let fallbackBase = currentPrice || (symbol === 'KOSPI' ? 2680 : (symbol === 'KOSDAQ' ? 760 : (symbol === 'KOSPI200' ? 360 : (queryPrice || 50000))));
                    return generateMockChart(fallbackBase, range);
                }

                let finalData = finalHistory;
                if (range === '1W') finalData = finalHistory.slice(-7);
                else if (range === '1M') finalData = finalHistory.slice(-30);

                if (range === '1D') {
                    finalData = filter1DChartIfNeeded(finalData);
                }

                historyCache.set(cacheKey, { timestamp: now, data: finalData });
                return finalData;
            } catch (e) {
                console.error(`❌ [KIS Index Error] ${symbol}:`, e.message);
                const currentPrice = getIndexCurrentPrice(symbol);
                let fPrice = currentPrice || (symbol === 'KOSPI' ? 2680 : (symbol === 'KOSDAQ' ? 760 : (symbol === 'KOSPI200' ? 360 : (queryPrice || 50000))));
                return generateMockChart(fPrice, range);
            } finally {
                pendingHistoryPromises.delete(cacheKey);
            }
        })();

        pendingHistoryPromises.set(cacheKey, fetchPromise);
        return res.json(await fetchPromise);
    }

    // --- 개별 종목 차트 처리 (Supabase 캐시 우선 및 DB 중심 갱신) ---
    let cachedData = null;
    if (supabase) {
        try {
            const { data, error } = await supabase
                .from('stock_detail_cache')
                .select('advanced, updated_at')
                .eq('symbol', targetSymbol)
                .single();

            if (!error && data && data.advanced && data.advanced.chartHistory && data.advanced.chartHistory[range]) {
                cachedData = data;
                let cachedChart = data.advanced.chartHistory[range];

                // 캐시 유효성 판단
                const now = new Date();
                const updatedAt = new Date(data.updated_at);
                const force = req.query.force === 'true';
                let isStale = force;

                if (!isStale) {
                    if (range === '1D') {
                        const isSameDay = now.getFullYear() === updatedAt.getFullYear() &&
                                          now.getMonth() === updatedAt.getMonth() &&
                                          now.getDate() === updatedAt.getDate();
                        const ageMs = now.getTime() - updatedAt.getTime();
                        // 1D 분봉이 오늘 날짜가 아니거나 60초 이상 경과한 경우 만료
                        if (!isSameDay || ageMs > 60000) isStale = true;
                    } else {
                        const isSameDay = now.getFullYear() === updatedAt.getFullYear() &&
                                          now.getMonth() === updatedAt.getMonth() &&
                                          now.getDate() === updatedAt.getDate();
                        // 일봉 데이터가 당일 업데이트되지 않은 경우 만료
                        if (!isSameDay) isStale = true;
                    }
                }

                // 시장이 닫혀있으면 캐시를 무조건 최신으로 인정 (불필요한 KIS 호출 원천 차단)
                if (!isMarketOpen()) {
                    isStale = false;
                }

                if (isStale) {
                    console.log(`🔄 [History API] ${range} chart is stale (or forced) for ${targetSymbol}.`);
                    if (range === '1D') {
                        try {
                            console.log(`📡 [History 1D Sync] Fetching fresh 1D chart synchronously for ${targetSymbol}`);
                            const freshDetail = await syncSingleStock(targetSymbol);
                            if (freshDetail && freshDetail.advanced?.chartHistory?.['1D']) {
                                let chart1D = freshDetail.advanced.chartHistory['1D'];
                                chart1D = filter1DChartIfNeeded(chart1D);
                                return res.json(chart1D);
                            }
                        } catch (err) {
                            console.error(`⚠️ [History 1D Synchronous Sync Failed] ${targetSymbol}:`, err.message);
                        }
                    } else {
                        // 일봉 차트 백그라운드 갱신 수행 (사용자 지연 방지)
                        (async () => {
                            try {
                                const chartData = await fetchStockChartFromKIS(targetSymbol, range);
                                const { data: ext } = await supabase
                                    .from('stock_detail_cache')
                                    .select('fundamental, advanced')
                                    .eq('symbol', targetSymbol)
                                    .maybeSingle();
                                const advanced = ext?.advanced || {};
                                const fundamental = ext?.fundamental || {};
                                advanced.chartHistory = {
                                    ...(advanced.chartHistory || {}),
                                    [range]: chartData
                                };
                                await supabase
                                    .from('stock_detail_cache')
                                    .upsert({
                                        symbol: targetSymbol,
                                        fundamental,
                                        advanced,
                                        updated_at: new Date().toISOString()
                                    }, { onConflict: 'symbol' });
                                console.log(`💾 [History Cache Write] Saved ${range} chart for ${targetSymbol} to Supabase.`);
                            } catch (err) {
                                console.error(`⚠️ [History Background Sync Failed] ${targetSymbol} for ${range}:`, err.message);
                            }
                        })();
                    }
                }

                // 1D 분봉인 경우 조건부로 현재 시간(KST)까지만 필터링하여 반환
                if (range === '1D') {
                    cachedChart = filter1DChartIfNeeded(cachedChart);
                }

                if (cachedChart && cachedChart.length > 0) {
                    console.log(`⚡ [History API Cache Hit] Served ${range} chart from Supabase for: ${targetSymbol}`);
                    return res.json(cachedChart);
                }
            }
        } catch (dbErr) {
            console.error(`⚠️ [History API DB Cache Read Error]`, dbErr.message);
        }
    }

    // 캐시 미스: 동기식으로 데이터를 조회하여 Supabase에 저장 후 반환
    try {
        console.log(`📡 [On-Demand History] No cache found. Fetching fresh ${range} chart for: ${targetSymbol}`);
        if (range === '1D') {
            const freshDetail = await syncSingleStock(targetSymbol);
            if (freshDetail && freshDetail.advanced?.chartHistory?.['1D']) {
                let chart1D = freshDetail.advanced.chartHistory['1D'];
                chart1D = filter1DChartIfNeeded(chart1D);
                return res.json(chart1D);
            }
        } else {
            const chartData = await fetchStockChartFromKIS(targetSymbol, range);
            if (chartData && chartData.length > 0) {
                // Supabase에 저장
                if (supabase) {
                    const { data: ext } = await supabase
                        .from('stock_detail_cache')
                        .select('fundamental, advanced')
                        .eq('symbol', targetSymbol)
                        .maybeSingle();
                    const advanced = ext?.advanced || {};
                    const fundamental = ext?.fundamental || {};
                    advanced.chartHistory = {
                        ...(advanced.chartHistory || {}),
                        [range]: chartData
                    };
                    await supabase
                        .from('stock_detail_cache')
                        .upsert({
                            symbol: targetSymbol,
                            fundamental,
                            advanced,
                            updated_at: new Date().toISOString()
                        }, { onConflict: 'symbol' });
                    console.log(`💾 [History Cache On-Demand Write] Saved ${range} chart for ${targetSymbol} to Supabase.`);
                }
                return res.json(chartData);
            }
        }
        throw new Error('Failed to fetch and cache history');
    } catch (err) {
        console.error(`❌ [History On-Demand Error] Failed for ${targetSymbol} (${range}):`, err.message);
        
        // 실패 시, 낡은 캐시 데이터라도 있으면 즉시 리턴
        if (cachedData && cachedData.advanced && cachedData.advanced.chartHistory && cachedData.advanced.chartHistory[range]) {
            return res.json(cachedData.advanced.chartHistory[range]);
        }
        return res.json(generateMockChart(queryPrice || 50000, range));
    }
});

// 3. 종목 상세 펀더멘털 정보 조회 (Supabase 캐시 우선 및 Stale-While-Revalidate 방식)
router.get('/detail/:symbol', ensureToken, async (req, res) => {
    const { symbol } = req.params;
    const force = req.query.force === 'true';
    
    try {
        // 3-1. Supabase 캐시 우선 조회
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

        // 시장이 닫혀 있으면 force=true를 무시하여 무의미한 실시간 호출 차단
        const effectiveForce = force && isMarketOpen();

        const isCacheValid = (!effectiveForce && 
                             cachedData && 
                             cachedData.fundamental && 
                             cachedData.advanced && 
                             cachedData.advanced.transactionValue !== undefined && 
                             cachedData.advanced.transactionValue !== null && 
                             cachedData.advanced.transactionValue !== 0) ||
                             (!isMarketOpen() && cachedData && cachedData.fundamental && cachedData.advanced);

        if (isCacheValid) {
            registerActiveSymbol(symbol);
            
            const ageMs = Date.now() - new Date(cachedData.updated_at).getTime();
            const isFresh = ageMs < 15 * 60 * 1000;
            
            if (!isFresh && isMarketOpen()) {
                // 캐시가 만료되었더라도 지연 발생 차단을 위해 즉각 기존 데이터를 리턴하고, 백그라운드 비동기로 캐시 갱신
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

        // 3-2. 캐시가 없거나 유효하지 않은 경우 동기식으로 가져오되, 실패 시 낡은 캐시라도 사용
        try {
            console.log(`📡 [On-Demand Detail] No cache or invalid cache found. Fetching fresh details for: ${symbol}`);
            const freshData = await syncSingleStock(symbol);
            
            if (freshData && freshData.fundamental && freshData.advanced) {
                registerActiveSymbol(symbol);

                const fundamental = {
                    ...freshData.fundamental,
                    advanced: freshData.advanced
                };
                return res.json({ fundamental });
            }
        } catch (syncErr) {
            console.error(`⚠️ [On-Demand Detail Sync Failed] ${symbol}:`, syncErr.message);
        }

        // KIS API 호출에 실패했을 때, 낡은 캐시 데이터가 있으면 폴백 반환 (매우 중요)
        if (cachedData && cachedData.fundamental && cachedData.advanced) {
            console.log(`⚡ [Detail API Fallback] Serving cached detail due to KIS sync failure for: ${symbol}`);
            const fundamental = {
                ...cachedData.fundamental,
                advanced: cachedData.advanced
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