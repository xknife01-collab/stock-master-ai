import supabase from './supabaseClient.js';
import { fetchStockFullDetailFromKIS } from './kisCore.js';
import { getAllPortfoliosForMonitoring } from './db.js';
import axios from 'axios';
import * as cheerio from 'cheerio';

let isSyncRunning = false;
const syncQueue = new Set();
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

let cachedMarketSymbols = [];
let lastListUpdateTime = 0;

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
 * 동적으로 동기화해야 할 대상 종목(시총 상위 + 포트폴리오 보유주 + 동적 검색종목) 선정
 */
async function getTargetSymbols() {
    const symbols = new Set();
    const now = Date.now();

    // 1. 12시간마다 최신 주도주 리스트 (KOSPI 200 + KOSDAQ 150) 갱신
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

    // 시총 상위 종목 등록
    cachedMarketSymbols.forEach(code => symbols.add(code));

    // 2. 포트폴리오에 등록되어 사용자가 실제로 보유 중인 모든 종목 추가
    try {
        const portfolios = await getAllPortfoliosForMonitoring();
        if (portfolios && portfolios.length > 0) {
            let portCount = 0;
            portfolios.forEach(p => {
                if (p.symbol && p.symbol.length === 6) {
                    if (!symbols.has(p.symbol)) {
                        symbols.add(p.symbol);
                        portCount++;
                    }
                }
            });
            if (portCount > 0) {
                console.log(`💼 [Sync Engine] Added ${portCount} custom portfolio stocks to background sync queue.`);
            }
        }
    } catch (err) {
        console.error('⚠️ [Sync Engine] Failed to fetch portfolio symbols for sync:', err.message);
    }

    // 3. 사용자가 실시간으로 조회하여 동적으로 추가된 종목 추가
    syncQueue.forEach(code => symbols.add(code));

    return Array.from(symbols);
}

/**
 * 단일 종목에 대한 Supabase stock_detail_cache 업데이트 수행
 */
export async function syncSingleStock(symbol) {
    if (!supabase) return null;
    
    try {
        console.log(`🔄 [Sync Engine] Fetching detail from KIS for: ${symbol}`);
        const result = await fetchStockFullDetailFromKIS(symbol);
        
        if (!result || !result.fundamental || !result.advanced) {
            console.warn(`⚠️ [Sync Engine] Skip writing empty data for: ${symbol}`);
            return null;
        }

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

        console.log(`💾 [Sync Engine] Successfully cached details in Supabase for: ${symbol}`);
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
 * 백그라운드 동기화 스케줄러 메인 루프
 */
export async function startStockSync() {
    if (isSyncRunning) {
        console.warn('⚠️ [Sync Engine] Stock sync loop is already running.');
        return;
    }
    isSyncRunning = true;
    console.log('🚀 [Sync Engine] Enterprise Background Sync Engine Started.');

    // 백그라운드 무한 루프
    (async () => {
        while (true) {
            try {
                const targetSymbols = await getTargetSymbols();
                console.log(`📊 [Sync Engine] Start sync cycle for ${targetSymbols.length} stocks.`);
                
                for (let i = 0; i < targetSymbols.length; i++) {
                    const symbol = targetSymbols[i];
                    
                    try {
                        await syncSingleStock(symbol);
                    } catch (err) {
                        console.error(`❌ [Sync Engine] Error syncing ${symbol}:`, err.message);
                    }

                    // KIS API 초당 10회 호출 제한을 완벽하게 예방하기 위해 각 종목 동기화 사이에 1.5초(1500ms) 강제 딜레이
                    await delay(1500);
                }

                console.log(`✨ [Sync Engine] Finished sync cycle. Sleeping for 3 minutes before next run...`);
                await delay(3 * 60 * 1000); // 3분 대기 후 다음 사이클 작동
            } catch (cycleErr) {
                console.error('❌ [Sync Engine] Exception in main sync loop cycle:', cycleErr.message);
                await delay(30 * 1000); // 오류 시 30초 후 재시도
            }
        }
    })();
}
