import express from 'express';
import axios from 'axios';
import { KIS_BASE_URL, ensureToken, getKisHeaders } from '../lib/kisCore.js';

const router = express.Router();

const stockCache = new Map();
const historyCache = new Map();
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
    for(let i=0; i<=pointCount; i++) {
        const d = new Date();
        if (rangeType === '1D') { d.setHours(9, 0, 0, 0); d.setMinutes(d.getMinutes() + (i * 15)); }
        else { d.setDate(d.getDate() - (pointCount - i) * step); }
        cur += cur * (Math.random() * volatility - bias);
        if(i === pointCount) cur = basePrice;
        const dateStr = rangeType === '1D' 
            ? `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`
            : (rangeType === '1Y' ? `${(d.getFullYear()%100)}.${(d.getMonth()+1).toString().padStart(2,'0')}` : `${(d.getMonth()+1).toString().padStart(2,'0')}/${(d.getDate()).toString().padStart(2,'0')}`);
        data.push({ date: dateStr, price: parseFloat(cur.toFixed(2)) });
    }
    return data;
};

// 1. 주식 현재가 조회
router.get('/:symbol', ensureToken, async (req, res) => {
    const { symbol } = req.params;
    try {
        const response = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-price`, {
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
        return res.json(historyCache.get(cacheKey).data);
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
            const params = isIntraday ? {
                FID_COND_MRKT_DIV_CODE: isIndex ? 'U' : 'J',
                FID_INPUT_ISCD: targetSymbol,
                FID_INPUT_HOUR_1: isIndex ? '60' : '153000', 
                FID_PW_DATA_INCU_YN: 'Y',
                FID_ETC_CLS_CODE: ''
            } : {
                FID_COND_MRKT_DIV_CODE: isIndex ? 'U' : 'J',
                FID_INPUT_ISCD: targetSymbol,
                FID_INPUT_DATE_1: '20240101',
                FID_INPUT_DATE_2: new Date().toISOString().slice(0,10).replace(/-/g,''),
                FID_PERIOD_DIV_CODE: 'D',
                FID_ORG_ADJ_PRC: '0',
                FID_ETC_CLS_CODE: ''
            };

            const response = await axios.get(`${KIS_BASE_URL}${url}`, {
                params,
                headers: getKisHeaders(trId)
            });

            if (response.data.rt_cd === '0') {
                const output2 = response.data.output2 || [];
                finalHistory = output2.reverse().map(item => {
                    const timeStr = item.stck_cntg_hour || item.stck_bsop_date || '';
                    const priceVal = isIndex ? item.bstp_nmix_prpr : (item.output_prpr || item.stck_prpr || item.stck_clpr);
                    return {
                        date: isIntraday ? `${timeStr.slice(0, 2)}:${timeStr.slice(2, 4)}` : timeStr.slice(4, 8),
                        price: parseFloat(priceVal) || 0
                    };
                });
            }

            if (finalHistory.length === 0 || finalHistory.every(p => p.price === 0)) {
                let fallbackBase = (symbol === 'KOSPI' ? 2680 : (symbol === 'KOSDAQ' ? 760 : (symbol === 'KOSPI200' ? 360 : (queryPrice || 50000))));
                return generateMockChart(fallbackBase, range);
            }

            let finalData = finalHistory;
            if (range === '1W') finalData = finalHistory.slice(-7);
            else if (range === '1M') finalData = finalHistory.slice(-30);

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
        const result = await fetchPromise;
        res.json(result);
    } catch (error) {
        res.json(generateMockChart(queryPrice || 10000, range));
    }
});

// 3. 종목 상세 펀더멘털 정보 조회
router.get('/detail/:symbol', ensureToken, async (req, res) => {
    const { symbol } = req.params;
    const commonHeaders = getKisHeaders(''); // tr_id는 개별 호출에서 설정

    const [priceResult, ratioResult, consensusResult, incomeResult, ccnlResult, shortResult, creditResult, dailyResult] = await Promise.allSettled([
        axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-price`, {
            params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol },
            headers: { ...commonHeaders, 'tr_id': 'FHKST01010100' }
        }),
        axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/finance/financial-ratio`, {
            params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol, FID_DIV_CLS_CODE: '0' },
            headers: { ...commonHeaders, 'tr_id': 'FHKST66430300' }
        }),
        axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/estimate-perform`, {
            params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol },
            headers: { ...commonHeaders, 'tr_id': 'HHKST668300C0' }
        }),
        axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/finance/income-statement`, {
            params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol, FID_DIV_CLS_CODE: '0' },
            headers: { ...commonHeaders, 'tr_id': 'FHKST66430200' }
        }),
        axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-ccnl`, {
            params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol },
            headers: { ...commonHeaders, 'tr_id': 'FHKST01010300' }
        }),
        axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/daily-short-sale`, {
            params: {
                FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol,
                FID_INPUT_DATE_1: new Date(Date.now() - 30 * 86400000).toISOString().slice(0,10).replace(/-/g,''),
                FID_INPUT_DATE_2: new Date().toISOString().slice(0,10).replace(/-/g,'')
            },
            headers: { ...commonHeaders, 'tr_id': 'FHPST04830000' }
        }),
        axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/daily-credit-balance`, {
            params: {
                FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol,
                FID_INPUT_DATE_1: new Date(Date.now() - 30 * 86400000).toISOString().slice(0,10).replace(/-/g,''),
                FID_INPUT_DATE_2: new Date().toISOString().slice(0,10).replace(/-/g,'')
            },
            headers: { ...commonHeaders, 'tr_id': 'FHPST04760000' }
        }),
        axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice`, {
            params: {
                FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol,
                FID_INPUT_DATE_1: new Date(Date.now() - 30 * 86400000).toISOString().slice(0,10).replace(/-/g,''),
                FID_INPUT_DATE_2: new Date().toISOString().slice(0,10).replace(/-/g,''),
                FID_PERIOD_DIV_CODE: 'D', FID_ORG_ADJ_PRC: '1'
            },
            headers: { ...commonHeaders, 'tr_id': 'FHKST03010100' }
        })
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
        roe: ratioRes?.data?.output?.find(it => it.wrtnt_fnam === 'ROE')?.wrtnt_val || '-',
        yield: '-', // Dividend yield is not in this specific KIS output, setting to '-' to avoid confusion with change %
        consensus: consensusRes?.data?.output?.map(it => ({ date: it.stck_bsop_date, target: it.stck_hgpr, opinion: it.invt_opnn })) || [],
        finance: incomeRes?.data?.output?.slice(0, 3).map(it => ({ year: it.stck_bsop_date, revenue: it.sales_amt, profit: it.op_prfit })) || [],
        advanced: {
            strength: strengthVal,
            disparity5,
            disparity20,
            shortRatio: shortRes?.data?.output?.[0]?.short_sell_rat || '-',
            creditBalance: creditRes?.data?.output?.[0]?.whol_loan_rmnd_rat || '-'
        }
    };
    res.json({ fundamental });
});

export default router;
