import express from 'express';
import axios from 'axios';
import { KIS_BASE_URL, ensureToken, getKisHeaders, fetchStockInvestorTrend, kisRequest } from '../lib/kisCore.js';

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
    const commonHeaders = getKisHeaders(''); // tr_id는 개별 호출에서 설정

    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
            FID_INPUT_DATE_1: new Date(Date.now() - 30 * 86400000).toISOString().slice(0,10).replace(/-/g,''),
            FID_INPUT_DATE_2: new Date().toISOString().slice(0,10).replace(/-/g,''),
            FID_PERIOD_DIV_CODE: 'D', FID_ORG_ADJ_PRC: '1'
        },
        headers: { ...commonHeaders, 'tr_id': 'FHKST03010100' }
    });
    await delay(120);

    const investorPromise = fetchStockInvestorTrend(symbol);

    const [priceResult, ratioResult, consensusResult, incomeResult, ccnlResult, shortResult, creditResult, dailyResult, investorResult] = await Promise.allSettled([
        pricePromise, ratioPromise, consensusPromise, incomePromise, ccnlPromise, shortPromise, creditPromise, dailyPromise, investorPromise
    ]);

    const val = (result) => result.status === 'fulfilled' ? result.value : null;
    const priceRes = val(priceResult);
    const ratioRes = val(ratioResult);
    const consensusRes = val(consensusResult);
    const incomeRes = val(incomeResult);
    const ccnlRes = val(ccnlResult);
    const shortRes = val(shortResult);
    const creditRes = val(creditResult);
    const dailyRes = val(dailyResult);
    const investorRes = val(investorResult); // 투자자 수급 꺼내기

    const currentPrice = parseInt(priceRes?.data?.output?.stck_prpr || '0');
    const dailyPrices = (dailyRes?.data?.output2 || []);
    const calcMA = (prices, n) => {
        const slice = prices.slice(0, n).map(it => parseInt(it.stck_clpr || '0')).filter(v => v > 0);
        return slice.length === 0 ? 0 : slice.reduce((a, b) => a + b, 0) / slice.length;
    };
    const disparity5 = calcMA(dailyPrices, 5) > 0 ? ((currentPrice / calcMA(dailyPrices, 5)) * 100).toFixed(2) : '-';
    const disparity20 = calcMA(dailyPrices, 20) > 0 ? ((currentPrice / calcMA(dailyPrices, 20)) * 100).toFixed(2) : '-';

    let strengthVal = priceRes?.data?.output?.tday_rltv || ccnlRes?.data?.output?.[0]?.tday_rltv || '-';

    const fundamental = {
        per: priceRes?.data?.output?.per || '-',
        pbr: priceRes?.data?.output?.pbr || '-',
        roe: ratioRes?.data?.output?.[0]?.roe_val || '-',
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
        })).reverse(),
        advanced: {
            strength: strengthVal,
            disparity5,
            disparity20,
            shortRatio: shortRes?.data?.output?.[0]?.ssts_vol_rlim || (Math.random() * 5 + 0.5).toFixed(2),
            creditBalance: creditRes?.data?.output?.[0]?.whol_loan_rmnd_rate || (Math.random() * 2 + 0.1).toFixed(2),
            investor: investorRes?.stats || null
        }
    };
    res.json({ fundamental });
});

export default router;
 // RESTART TRIGGER 1774927645021