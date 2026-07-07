import supabase from './supabaseClient.js';
import { fetchStockFullDetailFromKIS, fetchStockChartFromKIS, fetchMarketRankings, fetchConditionResult, fetchInvestorNetBuyRankings, fetchStockOvertimeData } from './kisCore.js';
import { getAllPortfoliosForMonitoring } from './db.js';
import axios from 'axios';
import * as cheerio from 'cheerio';

let isSyncRunning = false;
const syncQueue = new Set();
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

let cachedMarketSymbols = [];
let lastListUpdateTime = 0;
let lastDailyChartSyncDate = '';

/**
 * 네이버 금융에서 특정 마켓 구분(sosok)의 시가총액 순위를 긁어옴
 */
async function fetchMarketCapRankingsDirect(sosok, maxPages) {
    const stocks = [];
    for (let page = 1; page <= maxPages; page++) {
        try {
            const url = `https://finance.naver.com/sise/sise_market_sum.naver?sosok=${sosok}&page=${page}`;
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                },
                responseType: 'arraybuffer',
                timeout: 10000
            });

            const decoder = new TextDecoder('euc-kr');
            const html = decoder.decode(response.data);
            const $ = cheerio.load(html);

            $('a.tltle').each((i, el) => {
                const name = $(el).text().trim();
                const href = $(el).attr('href');
                const codeMatch = href.match(/code=(\d{6})/);
                if (codeMatch && name) {
                    stocks.push({ name: name.replace(/\s+/g, ''), code: codeMatch[1] });
                }
            });

            await delay(300);
        } catch (e) {
            console.error(`❌ [Sync Engine] Error fetching Naver sosok=${sosok} page=${page}:`, e.message);
        }
    }
    return stocks;
}

/**
 * 네이버 금융에서 최신 시가총액 상위 종목(KOSPI 200 + KOSDAQ 150)을 가져와 stock_master_map 테이블 갱신
 */
async function syncMarketCapList() {
    if (!supabase) return;
    console.log('📡 [Sync Engine] Scraping latest market cap rankings from Naver Finance to sync master...');
    
    try {
        const kospi = await fetchMarketCapRankingsDirect(0, 4); // top 200 KOSPI
        const kosdaq = await fetchMarketCapRankingsDirect(1, 3); // top 150 KOSDAQ
        const allMarketStocks = [...kospi, ...kosdaq];

        if (allMarketStocks.length > 0) {
            console.log(`📡 [Sync Engine] Found ${allMarketStocks.length} market cap leaders. Updating stock_master_map...`);
            
            let updatedCount = 0;
            for (const stock of allMarketStocks) {
                const { error } = await supabase
                    .from('stock_master_map')
                    .upsert({ name: stock.name, code: stock.code }, { onConflict: 'name' });
                if (!error) updatedCount++;
            }
            console.log(`✅ [Sync Engine] Successfully updated ${updatedCount}/${allMarketStocks.length} stock master mappings in Supabase.`);
        }
    } catch (err) {
        console.error('❌ [Sync Engine] Exception during market cap sync:', err.message);
    }
}

/**
 * 한국 주식 개장 시간 여부 검사 (KST 기준 평일 09:00 ~ 15:30)
 */
export function isMarketHours() {
    const krNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const day = krNow.getUTCDay(); // 0: 일요일, 6: 토요일
    if (day === 0 || day === 6) return false;

    const hour = krNow.getUTCHours();
    const min = krNow.getUTCMinutes();
    const timeVal = hour * 100 + min;

    return timeVal >= 900 && timeVal <= 1530;
}

/**
 * 시간외 단일가 거래 시간 여부 검사 (KST 기준 평일 16:00 ~ 18:10)
 */
export function isAftermarketHours() {
    const krNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const day = krNow.getUTCDay(); // 0: 일요일, 6: 토요일
    if (day === 0 || day === 6) return false;

    const hour = krNow.getUTCHours();
    const min = krNow.getUTCMinutes();
    const timeVal = hour * 100 + min;

    return timeVal >= 1600 && timeVal <= 1810;
}

/**
 * Tier 1 (고주기 활성 동기화 리스트, 최대 90종목)
 * - 당일 외인/기관 순매수 상위 30개
 * - 당일 거래대금 상위 30개
 * - HTS 조건검색 (골든크로스 / 거래량급증) 상위 30개
 */
export async function getTier1Symbols() {
    const symbols = new Set();
    try {
        const [netBuys, txValues, goldenCross, volSpike] = await Promise.all([
            fetchInvestorNetBuyRankings(),
            fetchMarketRankings('VALUE'),
            fetchConditionResult('0'),
            fetchConditionResult('1')
        ]);

        const addCodes = (list) => {
            if (Array.isArray(list)) {
                list.forEach(item => {
                    const code = item.code || item.symbol;
                    if (code && code.length === 6) {
                        symbols.add(code);
                    }
                });
            }
        };

        addCodes(netBuys);
        addCodes(txValues);
        addCodes(goldenCross);
        addCodes(volSpike);

        // 🛡️ 캐시된 외인/기관 순매수 상위 및 거래대금/급등 상위 종목도 Tier 1에 포함하여 동기화 우선순위 보장 (Rate Limit 대비)
        try {
            const { getSupplyCache } = await import('./supplyCache.js');
            const cachedInstBuy = getSupplyCache('dashboard_1000_buy') || [];
            const cachedForeignBuy = getSupplyCache('dashboard_9000_buy') || [];
            const cachedVolume = getSupplyCache('dashboard_volume_rank') || [];
            const cachedFluctuation = getSupplyCache('dashboard_fluctuation_rank') || [];

            const addCachedCodes = (list) => {
                if (Array.isArray(list)) {
                    list.forEach(item => {
                        const code = item.symbol || item.s || item.code;
                        if (code && code.length === 6) {
                            symbols.add(code);
                        }
                    });
                }
            };

            addCachedCodes(cachedInstBuy);
            addCachedCodes(cachedForeignBuy);
            addCachedCodes(cachedVolume);
            addCachedCodes(cachedFluctuation);
        } catch (cacheErr) {
            console.error('⚠️ [Sync Engine] Failed to load cached rankings for Tier 1 fallback:', cacheErr.message);
        }
    } catch (err) {
        console.error('⚠️ [Sync Engine] Failed to fetch Tier 1 active symbols:', err.message);
    }

    // 제외 정책: 사용자의 관심 종목 및 포트폴리오는 Tier 1 동기화 루프에서 배제하여 리소스 점유 방지
    try {
        const portfolios = await getAllPortfoliosForMonitoring();
        if (portfolios && portfolios.length > 0) {
            portfolios.forEach(p => {
                if (p.symbol) {
                    symbols.delete(p.symbol);
                }
            });
        }
    } catch (err) {
        console.error('⚠️ [Sync Engine] Failed to filter portfolios from Tier 1:', err.message);
    }

    syncQueue.forEach(code => symbols.delete(code));

    // 최대 90종목으로 엄격하게 제한
    return Array.from(symbols).slice(0, 90);
}

/**
 * Tier 2 (저주기/장후 동기화 리스트)
 * - 시가총액 상위 종목군(KOSPI 200 + KOSDAQ 150) 중 Tier 1 제외 종목
 * - 사용자 관심/보유 종목
 * - 실시간 조회 대기열
 */
export async function getTier2Symbols(tier1List = []) {
    const symbols = new Set();
    const tier1Set = new Set(tier1List);
    const now = Date.now();

    // 12시간마다 최신 주도주 리스트 (KOSPI 200 + KOSDAQ 150) 갱신
    if (cachedMarketSymbols.length === 0 || (now - lastListUpdateTime > 12 * 60 * 60 * 1000)) {
        try {
            await syncMarketCapList();
            const kospi = await fetchMarketCapRankingsDirect(0, 4);
            const kosdaq = await fetchMarketCapRankingsDirect(1, 3);
            cachedMarketSymbols = [...kospi, ...kosdaq].map(s => s.code);
            lastListUpdateTime = now;
            console.log(`🔄 [Sync Engine] Refreshed active market universe: ${cachedMarketSymbols.length} stocks.`);
        } catch (e) {
            console.error('⚠️ [Sync Engine] Failed to refresh active market universe:', e.message);
        }
    }

    cachedMarketSymbols.forEach(code => {
        if (!tier1Set.has(code)) {
            symbols.add(code);
        }
    });

    // 포트폴리오 보유 종목
    try {
        const portfolios = await getAllPortfoliosForMonitoring();
        if (portfolios && portfolios.length > 0) {
            portfolios.forEach(p => {
                if (p.symbol && p.symbol.length === 6 && !tier1Set.has(p.symbol)) {
                    symbols.add(p.symbol);
                }
            });
        }
    } catch (err) {
        console.error('⚠️ [Sync Engine] Failed to fetch portfolio symbols for Tier 2:', err.message);
    }

    // 실시간 조회 대기열
    syncQueue.forEach(code => {
        if (!tier1Set.has(code)) {
            symbols.add(code);
        }
    });

    return Array.from(symbols);
}

/**
 * 1D 분봉 차트 실시간 조회 데이터와 기존 캐시를 병합하고 갭을 채우는 헬퍼 함수 (Option C)
 */
async function mergeAndFill1DChart(symbol, newChart1D, existingChart1D, isBackground = false) {
    if (!newChart1D || newChart1D.length === 0) {
        return existingChart1D || [];
    }

    let mergedMap = new Map();
    if (Array.isArray(existingChart1D)) {
        existingChart1D.forEach(item => {
            if (item && item.date) {
                mergedMap.set(item.date, item.price);
            }
        });
    }

    newChart1D.forEach(item => {
        if (item && item.date) {
            mergedMap.set(item.date, item.price);
        }
    });

    let sortedDates = Array.from(mergedMap.keys()).sort();
    let earliestDate = sortedDates[0] || '09:00';

    // 09:00보다 늦은 시간이고 빈 갭이 있을 경우 백워드 페이징하여 데이터 수집
    const maxPagingPages = isBackground ? 3 : 8;
    let currentPage = 0;

    while (earliestDate > '09:00' && currentPage < maxPagingPages) {
        currentPage++;
        const hhmm = earliestDate.replace(':', '');
        const targetHour = `${hhmm}00`;
        
        console.log(`📡 [1D Chart Sync] Paging back for ${symbol} using hour: ${targetHour} (Page ${currentPage})`);
        try {
            const prevBatch = await fetchStockChartFromKIS(symbol, '1D', isBackground, targetHour);
            if (!prevBatch || prevBatch.length === 0) {
                break;
            }
            
            let addedNew = false;
            prevBatch.forEach(item => {
                if (item && item.date && !mergedMap.has(item.date)) {
                    mergedMap.set(item.date, item.price);
                    addedNew = true;
                }
            });
            
            sortedDates = Array.from(mergedMap.keys()).sort();
            const newEarliest = sortedDates[0];
            if (!addedNew || newEarliest >= earliestDate) {
                break;
            }
            earliestDate = newEarliest;
            if (earliestDate <= '09:00') {
                break;
            }
            await delay(150);
        } catch (err) {
            console.error(`⚠️ [1D Chart Sync] Failed paging for ${symbol}:`, err.message);
            break;
        }
    }

    sortedDates = Array.from(mergedMap.keys()).sort();
    return sortedDates.map(date => ({
        date,
        price: mergedMap.get(date)
    }));
}

/**
 * 단일 종목에 대한 Supabase stock_detail_cache 업데이트 수행
 */
export async function syncSingleStock(symbol, isBackground = false, force = false) {
    if (!supabase) return null;
    if (process.env.SAFE_CACHE_FREEZE === 'true') {
        console.warn(`⚠️ [Sync Engine] Sync frozen for ${symbol} due to active Startup Guard alert.`);
        return null;
    }
    
    try {
        // 기존 DB 캐시 조회 (정적 데이터 보존, 재무 데이터 및 차트 폴백 목적)
        let existing = null;
        let isFastSync = false;
        try {
            const { data } = await supabase
                .from('stock_detail_cache')
                .select('fundamental, advanced, updated_at')
                .eq('symbol', symbol)
                .single();
            if (data) {
                existing = data;
                
                // 오늘 이미 업데이트된 캐시가 존재하고, 재무 정보와 일봉 차트(1Y) 기록이 있는 경우 Fast Sync 활성화
                if (!force && data.updated_at && data.fundamental?.finance?.length > 0 && data.advanced?.chartHistory?.['1Y']?.length > 0) {
                    const krToday = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
                    const lastUpdatedDate = new Date(new Date(data.updated_at).getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
                    if (krToday === lastUpdatedDate) {
                        isFastSync = true;
                        
                        // ⚙️ [Market Close Override & Self-Healing]
                        // 1. 장이 마감된 시간(15시 40분 이후)일 때 최종 확정 수급 데이터(Daily Settlement)가 누락되었거나 실시간 가집계 데이터인 경우
                        // 2. 캐시가 오늘 오전/정산 전 더미 데이터(0,0,0)로 오염된 경우
                        // Fast Sync를 강제로 해제하고 전체 동기화를 실행하여 정상 수급 데이터를 확보합니다.
                        const krNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
                        const curHHMM = krNow.getUTCHours().toString().padStart(2, '0') + krNow.getUTCMinutes().toString().padStart(2, '0');
                        const hasInvestor = !!data.advanced?.investor;
                        const hasHistory = hasInvestor && Array.isArray(data.advanced.investor.dailyHistory) && data.advanced.investor.dailyHistory.length > 0;
                        const isContaminated = !hasInvestor || !hasHistory || (
                            data.advanced.investor.isTodayData === true &&
                            data.advanced.investor.isRealtime === false &&
                            data.advanced.investor.foreign1D === 0 &&
                            data.advanced.investor.organ1D === 0 &&
                            data.advanced.investor.personal1D === 0
                        );

                        if (isContaminated) {
                            console.log(`🔄 [Sync Engine] Cached investor data for ${symbol} is contaminated or missing. Disabling FastSync to heal cache.`);
                            isFastSync = false;
                        } else if (curHHMM >= '1540' && (!hasInvestor || data.advanced.investor.isRealtime === true || data.advanced.investor.isTodayData !== true)) {
                            console.log(`🔄 [Sync Engine] Market is closed (${curHHMM} KST) and cached investor data needs update. Disabling FastSync to fetch settled daily trend for ${symbol}.`);
                            isFastSync = false;
                        }
                    }
                }
            }
        } catch (dbErr) {
            // 캐시 미스 혹은 첫 등록 시 무시
        }

        console.log(`🔄 [Sync Engine] Fetching detail from KIS for: ${symbol} (FastSync: ${isFastSync}, Background: ${isBackground}, Force: ${force})`);
        const result = await fetchStockFullDetailFromKIS(symbol, existing, isFastSync, isBackground, force);
        
        if (!result || !result.fundamental || !result.advanced) {
            console.warn(`⚠️ [Sync Engine] Skip writing empty data for: ${symbol}`);
            return null;
        }

        // 1D 분봉 차트 실시간 조회 및 병합/갭필링 (Option C)
        let chart1D = [];
        try {
            const krToday = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
            let existingChart1D = [];
            if (existing?.updated_at) {
                const lastUpdatedDate = new Date(new Date(existing.updated_at).getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
                
                // 오늘 날짜이거나, 혹은 weekday 아침 9시 이전(새 거래일이 아직 열리기 전)인 경우 기존 차트데이터 보존
                const krNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
                const day = krNow.getUTCDay();
                const timeVal = krNow.getUTCHours() * 100 + krNow.getUTCMinutes();
                const isNewTradingDay = (day !== 0 && day !== 6) && timeVal >= 900;
                
                if (krToday === lastUpdatedDate || !isNewTradingDay) {
                    existingChart1D = existing.advanced?.chartHistory?.['1D'] || [];
                }
            }
            
            const latestChart1D = await fetchStockChartFromKIS(symbol, '1D', isBackground);
            chart1D = await mergeAndFill1DChart(symbol, latestChart1D, existingChart1D, isBackground);
        } catch (chartErr) {
            console.warn(`⚠️ [Sync Engine] Failed to fetch/merge 1D chart for ${symbol}:`, chartErr.message);
            chart1D = existing?.advanced?.chartHistory?.['1D'] || [];
        }

        // 1.5) 시간외 단일가 데이터 병합 및 갱신
        let afterMarket = existing?.advanced?.afterMarket || null;
        if (isAftermarketHours() || force) {
            console.log(`📡 [Sync Engine] Fetching real-time after-market data for ${symbol}...`);
            const amData = await fetchStockOvertimeData(symbol, isBackground);
            if (amData) {
                afterMarket = amData;
            }
        } else if (isMarketHours()) {
            // 장중에는 이전의 시간외 단일가 데이터를 만료(클리어) 처리
            afterMarket = null;
        }

        // 1) advanced 객체 안전 병합 (기존의 1W/1M/1Y 차트 기록 및 신규 차트 데이터 유지)
        const existingChartHistory = existing?.advanced?.chartHistory || {};
        const newChartHistory = result.advanced?.chartHistory || {};
        result.advanced = {
            ...(existing?.advanced || {}),
            ...result.advanced,
            afterMarket, // 시간외 단일가 데이터 보존/갱신
            chartHistory: {
                ...existingChartHistory,
                ...newChartHistory,
                '1D': chart1D
            }
        };

        // 2) fundamental 재무 데이터 정밀 폴백 (KIS API 일시 오류/데이터 누락 시 기존 데이터 보존)
        if (existing?.fundamental) {
            const extFund = existing.fundamental;

            // ROE 폴백 (신규 ROE가 없거나 '-', '0.00'일 때 기존 실데이터 보존)
            const newRoe = result.fundamental.roe;
            if ((newRoe === undefined || newRoe === null || newRoe === '-' || parseFloat(newRoe) === 0) &&
                (extFund.roe && extFund.roe !== '-' && parseFloat(extFund.roe) !== 0)) {
                result.fundamental.roe = extFund.roe;
            }

            // PBR 폴백
            const newPbr = result.fundamental.pbr;
            if ((newPbr === undefined || newPbr === null || newPbr === '-' || parseFloat(newPbr) === 0) &&
                (extFund.pbr && extFund.pbr !== '-' && parseFloat(extFund.pbr) !== 0)) {
                result.fundamental.pbr = extFund.pbr;
            }

            // PER 폴백
            const newPer = result.fundamental.per;
            if ((newPer === undefined || newPer === null || newPer === '-' || parseFloat(newPer) === 0) &&
                (extFund.per && extFund.per !== '-' && parseFloat(extFund.per) !== 0)) {
                result.fundamental.per = extFund.per;
            }

            // 부채비율 폴백
            const newDebt = result.fundamental.debtRatio;
            if ((newDebt === undefined || newDebt === null || newDebt === '-' || parseFloat(newDebt) === 0) &&
                (extFund.debtRatio && extFund.debtRatio !== '-' && parseFloat(extFund.debtRatio) !== 0)) {
                result.fundamental.debtRatio = extFund.debtRatio;
            }

            // 분기 재무제표 폴백 (신규 분기 데이터가 전부 0이거나 없을 때 기존 실적 보존)
            const isNewFinanceEmpty = !result.fundamental.finance || 
                result.fundamental.finance.length === 0 || 
                result.fundamental.finance.every(f => (f.revenue || 0) === 0 && (f.profit || 0) === 0);
            
            if (isNewFinanceEmpty && extFund.finance && extFund.finance.length > 0) {
                result.fundamental.finance = extFund.finance;
            }
        }

        // --- 체결강도 가속도(Strength Acceleration) 계산 및 기록 ---
        let strengthHistory = existing?.advanced?.strengthHistory || [];
        if (!Array.isArray(strengthHistory)) {
            strengthHistory = [];
        }
        const currentStrength = parseFloat(result.advanced.strength || 0);
        if (!isNaN(currentStrength) && currentStrength > 0) {
            strengthHistory.push(currentStrength);
            if (strengthHistory.length > 5) {
                strengthHistory.shift();
            }
        }
        
        let strengthAcceleration = 0;
        if (strengthHistory.length >= 2) {
            const oldestStrength = strengthHistory[0];
            strengthAcceleration = currentStrength - oldestStrength;
        }
        
        result.advanced.strengthHistory = strengthHistory;
        result.advanced.strengthAcceleration = parseFloat(strengthAcceleration.toFixed(2));
        // -----------------------------------------------------------

        // Supabase stock_detail_cache에 업서트
        const { error } = await supabase
            .from('stock_detail_cache')
            .upsert({
                symbol: symbol,
                fundamental: result.fundamental,
                advanced: result.advanced,
                updated_at: new Date().toISOString()
            }, { onConflict: 'symbol' });

        if (error) {
            console.error(`❌ [Sync Engine] Supabase cache write error for ${symbol}:`, error.message);
            return null;
        }

        console.log(`💾 [Sync Engine] Successfully cached details and 1D chart in Supabase for: ${symbol}`);
        return result;
    } catch (e) {
        console.error(`❌ [Sync Engine] Exception syncing stock ${symbol}:`, e.message);
        return null;
    }
}

/**
 * 실시간 검색/조회 시 동적으로 대상 리스트에 등록하여 동기화 주기에 편입
 */
export function registerActiveSymbol(symbol) {
    if (!symbol || symbol.length !== 6) return;
    if (!syncQueue.has(symbol)) {
        syncQueue.add(symbol);
        console.log(`📢 [Sync Engine] On-Demand Register: Added ${symbol} to active background sync queue.`);
    }
}

/**
 * 동시성 제어를 지원하는 비동기 작업 처리 풀
 */
async function runWithConcurrency(items, limit, fn) {
    const results = [];
    const executing = new Set();
    for (const item of items) {
        const p = Promise.resolve().then(() => fn(item));
        results.push(p);
        executing.add(p);
        const clean = () => executing.delete(p);
        p.then(clean, clean);
        if (executing.size >= limit) {
            await Promise.race(executing);
        }
    }
    return Promise.all(results);
}

/**
 * 백그라운드 동기화 스케줄러 메인 루프
 */
export async function startStockSync() {
    if (isSyncRunning) {
        console.warn('⚠️ [Sync Engine] Stock sync loop is already running.');
        return;
    }
    isSyncRunning = true;
    console.log('🚀 [Sync Engine] Dual-Speed Tiered Background Sync Engine Started.');

    // 1. Tier 1 (고속 동기화 루프 - 90개 주도주 대상)
    (async () => {
        while (true) {
            try {
                // 실시간 우선순위 대기열 (syncQueue) 우선 처리
                while (syncQueue.size > 0) {
                    const priSymbol = syncQueue.values().next().value;
                    if (priSymbol) {
                        console.log(`🔥 [Tier 1 Priority] Processing high-priority on-demand sync: ${priSymbol}`);
                        try {
                            await syncSingleStock(priSymbol, false);
                        } catch (err) {
                            console.error(`❌ [Tier 1 Priority] Error syncing ${priSymbol}:`, err.message);
                        }
                        syncQueue.delete(priSymbol);
                        await delay(1500);
                    }
                }

                const marketOpen = isMarketHours();
                const tier1Symbols = await getTier1Symbols();
                
                if (tier1Symbols.length > 0) {
                    console.log(`📊 [Tier 1 Loop] Starting sync cycle for ${tier1Symbols.length} active stocks. (Market Open: ${marketOpen})`);
                    
                    for (let i = 0; i < tier1Symbols.length; i++) {
                        // 중간중간 실시간 우선순위 대기열 (syncQueue) 생기면 즉시 선점 처리
                        while (syncQueue.size > 0) {
                            const priSymbol = syncQueue.values().next().value;
                            if (priSymbol) {
                                console.log(`🔥 [Tier 1 Priority Intercept] Processing high-priority on-demand sync: ${priSymbol}`);
                                try {
                                    await syncSingleStock(priSymbol, false);
                                } catch (err) {
                                    console.error(`❌ [Tier 1 Priority Intercept] Error syncing ${priSymbol}:`, err.message);
                                }
                                syncQueue.delete(priSymbol);
                                await delay(1500);
                            }
                        }

                        const symbol = tier1Symbols[i];
                        try {
                            await syncSingleStock(symbol, true);
                        } catch (err) {
                            console.error(`❌ [Tier 1 Loop] Error syncing ${symbol}:`, err.message);
                        }
                        
                        // 장중 및 시간외에는 1.5초 대기, 그 외 장외엔 5초 대기
                        const aftermarket = isAftermarketHours();
                        await delay((marketOpen || aftermarket) ? 1500 : 5000);
                    }
                }

                // 장중 및 시간외에는 2분 대기, 그 외 장외엔 15분 대기 후 다음 사이클 작동
                const sleepMs = (marketOpen || isAftermarketHours()) ? (2 * 60 * 1000) : (15 * 60 * 1000);
                console.log(`✨ [Tier 1 Loop] Finished active cycle. Sleeping for ${sleepMs / 60000} minutes...`);
                await delay(sleepMs);
            } catch (err) {
                console.error('❌ [Tier 1 Loop] Exception:', err.message);
                await delay(30 * 1000);
            }
        }
    })();

    // 2. Tier 2 (저속 동기화 루프 - 나머지 시장 종목 대상)
    (async () => {
        while (true) {
            try {
                const marketOpen = isMarketHours();
                const tier1Symbols = await getTier1Symbols();
                const tier2Symbols = await getTier2Symbols(tier1Symbols);

                if (tier2Symbols.length > 0) {
                    console.log(`📊 [Tier 2 Loop] Starting slow sync cycle for ${tier2Symbols.length} market stocks. (Market Open: ${marketOpen})`);
                    
                    await runWithConcurrency(tier2Symbols, 4, async (symbol) => {
                        // Tier 1에 편입되었거나 우선순위 대기열에 들어갔는지 검사하여 실시간 스킵
                        const currentTier1 = await getTier1Symbols();
                        if (currentTier1.includes(symbol) || syncQueue.has(symbol)) {
                            console.log(`⏭️ [Tier 2 Loop] Skipping ${symbol} as it became Tier 1 or high-priority.`);
                            return;
                        }

                        try {
                            await syncSingleStock(symbol, true);
                        } catch (err) {
                            console.error(`❌ [Tier 2 Loop] Error syncing ${symbol}:`, err.message);
                        }
                    });
                }

                // 장중엔 30분 대기, 장외엔 15분 대기
                const sleepMs = marketOpen ? (30 * 60 * 1000) : (15 * 60 * 1000);
                console.log(`✨ [Tier 2 Loop] Finished slow cycle. Sleeping for ${sleepMs / 60000} minutes...`);
                await delay(sleepMs);
            } catch (err) {
                console.error('❌ [Tier 2 Loop] Exception:', err.message);
                await delay(60 * 1000);
            }
        }
    })();

    // 3. Daily Historical Chart Loop (오후 4시 KST 이후 일봉/주봉/월봉 차트 대량 업데이트)
    (async () => {
        while (true) {
            try {
                const krNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
                const todayStr = krNow.toISOString().slice(0, 10);
                const curHour = krNow.getUTCHours(); // KST 시간 기준

                if (curHour >= 16 && lastDailyChartSyncDate !== todayStr) {
                    const tier1 = await getTier1Symbols();
                    const tier2 = await getTier2Symbols(tier1);
                    const allSymbols = [...tier1, ...tier2];

                    console.log(`🕒 [Daily Hist Chart] Past 16:00 KST. Starting daily historical chart sync (1W, 1M, 1Y) for ${allSymbols.length} stocks...`);
                    for (let j = 0; j < allSymbols.length; j++) {
                        const symbol = allSymbols[j];
                        try {
                            console.log(`📡 [Daily Hist Chart] Syncing 1W, 1M, 1Y for: ${symbol}`);
                            const chart1W = await fetchStockChartFromKIS(symbol, '1W', true);
                            await delay(300);
                            const chart1M = await fetchStockChartFromKIS(symbol, '1M', true);
                            await delay(300);
                            const chart1Y = await fetchStockChartFromKIS(symbol, '1Y', true);

                            const { data: existing } = await supabase
                                .from('stock_detail_cache')
                                .select('advanced')
                                .eq('symbol', symbol)
                                .single();

                            let advanced = (existing && existing.advanced) ? existing.advanced : {};
                            let chartHistory = advanced.chartHistory ? advanced.chartHistory : {};

                            advanced.chartHistory = {
                                ...chartHistory,
                                '1W': chart1W,
                                '1M': chart1M,
                                '1Y': chart1Y
                            };

                            await supabase
                                .from('stock_detail_cache')
                                .update({ advanced, updated_at: new Date().toISOString() })
                                .eq('symbol', symbol);

                            console.log(`💾 [Daily Hist Chart] Successfully cached 1W, 1M, 1Y for: ${symbol}`);
                        } catch (err) {
                            console.error(`❌ [Daily Hist Chart Error] Failed for ${symbol}:`, err.message);
                        }
                        await delay(1500); // KIS API 스로틀링 예방
                    }
                    lastDailyChartSyncDate = todayStr;
                    console.log(`✨ [Daily Hist Chart] Finished daily historical chart sync for ${todayStr}.`);
                }
            } catch (err) {
                console.error('❌ [Daily Hist Chart Loop] Exception:', err.message);
            }
            // 15분마다 체크
            await delay(15 * 60 * 1000);
        }
    })();
}
