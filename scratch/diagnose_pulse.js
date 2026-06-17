import dotenv from 'dotenv';
dotenv.config();

import supabase from '../lib/supabaseClient.js';
import { 
    fetchMarketRankings, fetchConditionResult, fetchStockInvestorTrend, 
    fetchStockIntradayInvestorEstimate, fetchStockFinancialsForVeto,
    KIS_BASE_URL, getKisHeaders, getAccessToken
} from '../lib/kisCore.js';
import { getSupplyCache, saveSupplyCache } from '../lib/supplyCache.js';
import { syncSingleStock } from '../lib/stockSync.js';
import axios from 'axios';

const fetchSupplyRank = async () => {
    try {
        const token = await getAccessToken();
        const res = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/foreign-institution-total`, {
            params: {
                FID_COND_MRKT_DIV_CODE: 'V', // 가집계
                FID_COND_SCR_DIV_CODE: '1644',
                FID_INPUT_ISCD: '0000', // 전체
                FID_DIV_CLS_CODE: '0', // 수량
                FID_RANK_SORT_CLS_CODE: '0', // 순매수합계순
                FID_ETC_CLS_CODE: '0'
            },
            headers: { ...getKisHeaders('FHPTJ04400000'), 'authorization': `Bearer ${token}` }
        });
        if (res.data.output && res.data.output.length > 0) {
            const mapped = res.data.output.slice(0, 10).map(it => `${it.hts_kor_isnm}(${it.mksc_shrn_iscd}) [외국인:${it.frgn_ntby_qty}, 기관:${it.orgn_ntby_qty}]`).join(', ');
            saveSupplyCache('ai_supply', mapped);
            return mapped;
        }
        const cached = getSupplyCache('ai_supply');
        if (cached) return cached;
        return "데이터 없음";
    } catch (e) {
        console.warn('Supply rank fetch fail:', e.message);
        const cached = getSupplyCache('ai_supply');
        if (cached) return cached;
        return "데이터 불러오기 실패";
    }
};

const isEtfOrIndex = (name) => {
    const keywords = ["KODEX", "TIGER", "SOL", "RISE", "KBSTAR", "ACE", "HANARO", "KOSEF", "ARIRANG", "ETN", "인버스", "레버리지", "선물", "국채", "달러", "고배당", "MSCI", "ESG", "active", "액티브", "로우볼", "밸류", "모멘텀"];
    return keywords.some(k => name.toUpperCase().includes(k.toUpperCase()));
};

const parseSupplyStocks = (str) => {
    const stocks = [];
    if (typeof str !== 'string') return stocks;
    const regex = /([가-힣A-Za-z0-9\s&\.\-\+]+)\((\d{6})\)/g;
    let match;
    while ((match = regex.exec(str)) !== null) {
        stocks.push({
            name: match[1].trim(),
            code: match[2],
            price: '0',
            change: '0'
        });
    }
    return stocks;
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
    try {
        console.log("🚀 Running Diagnostics on AI Pulse Candidate Pool and Filters...");
        
        console.log("Step 1: Fetching discovery funnel sources...");
        const [gainers, values, supplyList, htsGolden, htsVolume] = await Promise.all([
            fetchMarketRankings('GAIN'),
            fetchMarketRankings('VOLUME'),
            fetchSupplyRank(),
            fetchConditionResult('0'),
            fetchConditionResult('1')
        ]);
        
        console.log(`- Gainers count: ${gainers?.length || 0}`);
        console.log(`- Values count: ${values?.length || 0}`);
        console.log(`- SupplyList length: ${supplyList?.length || 0}`);
        console.log(`- HTS Golden count: ${htsGolden?.length || 0}`);
        console.log(`- HTS Volume count: ${htsVolume?.length || 0}`);
        
        const candidateOccurrence = new Map();
        const processList = (list, tag) => {
            if (!Array.isArray(list)) return;
            list.forEach(it => {
                if (!it.code) return;
                const existing = candidateOccurrence.get(it.code) || {
                    name: it.name,
                    code: it.code,
                    price: parseInt(it.price || '0'),
                    change: parseFloat(it.change || '0'),
                    volume: parseInt(it.volume || '0'),
                    value: parseInt(it.value || '0'),
                    count: 0,
                    tags: []
                };
                existing.count += 1;
                if (!existing.tags.includes(tag)) {
                    existing.tags.push(tag);
                }
                candidateOccurrence.set(it.code, existing);
            });
        };

        processList(gainers, "급등");
        processList(values, "거래폭발");
        processList(htsGolden, "골든크로스");
        processList(htsVolume, "수급포착");
        processList(parseSupplyStocks(supplyList), "수급우수");

        const candidatePool = Array.from(candidateOccurrence.values())
            .filter(c => !isEtfOrIndex(c.name))
            .sort((a, b) => {
                if (b.count !== a.count) return b.count - a.count;
                if (b.value !== a.value) return b.value - a.value;
                return Math.abs(b.change) - Math.abs(a.change);
            })
            .slice(0, 25);

        console.log(`Total filtered candidate pool: ${candidatePool.length} stocks.`);
        candidatePool.forEach((c, i) => {
            console.log(`[${i+1}] ${c.name} (${c.code}) - Tags: ${c.tags.join(', ')}, Count: ${c.count}`);
        });

        const symbols = candidatePool.map(c => c.code);
        let metricsMap = {};
        
        console.log("Step 2: Fetching from stock_detail_cache in Supabase...");
        if (supabase) {
            const { data, error } = await supabase
                .from('stock_detail_cache')
                .select('*')
                .in('symbol', symbols);
            
            if (error) {
                console.error("Supabase select error:", error.message);
            } else if (data) {
                console.log(`Fetched ${data.length} records from Supabase.`);
                const now = new Date();
                const validRows = data.filter(row => {
                    const updated = new Date(row.updated_at);
                    const ageMinutes = (now - updated) / (1000 * 60);
                    const isValid = ageMinutes < 60;
                    if (!isValid) {
                        console.log(`🗑️ [Cache Expired] Cache for ${row.symbol} is older than 60m (${ageMinutes.toFixed(1)}m old). Ignoring...`);
                    }
                    return isValid;
                });
                validRows.forEach(row => {
                    metricsMap[row.symbol] = {
                        price: row.fundamental?.price || 0,
                        disparity5: parseFloat(row.advanced?.disparity5) || 100,
                        disparity20: parseFloat(row.advanced?.disparity20) || 100,
                        strength: parseFloat(row.advanced?.strength) || 100,
                        shortRatio: parseFloat(row.advanced?.shortRatio) || 0,
                        investor1D: {
                            foreign: row.advanced?.investor?.foreign1D || 0,
                            organ: row.advanced?.investor?.organ1D || 0,
                            personal: row.advanced?.investor?.personal1D || 0
                        },
                        investor5D: {
                            foreign: row.advanced?.investor?.foreign5D || 0,
                            organ: row.advanced?.investor?.organ5D || 0,
                            personal: row.advanced?.investor?.personal5D || 0
                        },
                        fundamental: row.fundamental
                    };
                });
            }
        }

        console.log("Step 2.5: Syncing missing candidates live...");
        for (const symbol of symbols) {
            if (!metricsMap[symbol]) {
                const cand = candidatePool.find(c => c.code === symbol);
                console.log(`📡 [Pulse Fallback] Cache miss for ${cand.name} (${symbol}). Fetching live...`);
                const fresh = await syncSingleStock(symbol);
                if (fresh) {
                    metricsMap[symbol] = {
                        price: fresh.fundamental?.price || 0,
                        disparity5: parseFloat(fresh.advanced?.disparity5) || 100,
                        disparity20: parseFloat(fresh.advanced?.disparity20) || 100,
                        strength: parseFloat(fresh.advanced?.strength) || 100,
                        shortRatio: parseFloat(fresh.advanced?.shortRatio) || 0,
                        investor1D: {
                            foreign: fresh.advanced?.investor?.foreign1D || 0,
                            organ: fresh.advanced?.investor?.organ1D || 0,
                            personal: fresh.advanced?.investor?.personal1D || 0
                        },
                        investor5D: {
                            foreign: fresh.advanced?.investor?.foreign5D || 0,
                            organ: fresh.advanced?.investor?.organ5D || 0,
                            personal: fresh.advanced?.investor?.personal5D || 0
                        },
                        fundamental: fresh.fundamental
                    };
                }
                await delay(300);
            }
        }

        console.log("Step 3: Evaluating metrics and scoring...");
        const scoredCandidates = [];
        const isSafe = false; // Let's check under normal mode first
        
        for (const c of candidatePool) {
            const m = metricsMap[c.code];
            if (!m) {
                console.log(`⚠️ No metrics found in DB cache or KIS for ${c.name} (${c.code})`);
                continue;
            }
            
            let strengthScore = 0;
            let disparityScore = 0;
            let shortScore = 0;
            let supplyScore = 0;
            
            // Score calculations
            const str = m.strength;
            if (str >= 120) strengthScore = 40;
            else if (str >= 105) strengthScore = 30;
            else if (str >= 100) strengthScore = 20;
            else if (str >= 90) strengthScore = 10;
            
            const disp = m.disparity20;
            if (disp >= 98 && disp <= 104) disparityScore = 20;
            else if (disp > 104 && disp <= 106) disparityScore = 15;
            else if (disp < 98) disparityScore = 8;
            else if (disp > 106 && disp < 107) disparityScore = 0;
            else disparityScore = -15;
            
            const sr = m.shortRatio;
            if (sr < 5) shortScore = 10;
            else if (sr >= 5 && sr < 12) shortScore = 5;
            else if (sr >= 12 && sr < 15) shortScore = 0;
            else shortScore = -15;
            
            const getSupplyPoints = (f, o, p, maxS) => {
                const isAnt = f < 0 && o < 0 && p > 0;
                if (isAnt) return -30;
                if (f > 0 && o > 0) return maxS;
                if (f + o > 0) return maxS === 20 ? 15 : 20;
                if (f > 0 || o > 0) return 10;
                return 0;
            };
            
            const inv1D = m.investor1D || { foreign: 0, organ: 0, personal: 0 };
            const inv5D = m.investor5D || { foreign: 0, organ: 0, personal: 0 };
            const score1D = getSupplyPoints(inv1D.foreign, inv1D.organ, inv1D.personal, 30);
            const score5D = getSupplyPoints(inv5D.foreign, inv5D.organ, inv5D.personal, 30);
            if (inv1D.foreign === 0 && inv1D.organ === 0) {
                supplyScore = score5D;
            } else {
                supplyScore = Math.round(score1D * 0.7 + score5D * 0.3);
            }
            
            const rawTotalScore = strengthScore + disparityScore + shortScore + supplyScore;
            const totalScore = rawTotalScore; // omit backtest penalty for now
            
            scoredCandidates.push({
                name: c.name,
                code: c.code,
                totalScore,
                metrics: m,
                scores: { strengthScore, disparityScore, shortScore, supplyScore }
            });
        }

        // Sort by totalScore
        const sortedScored = scoredCandidates.sort((a, b) => b.totalScore - a.totalScore);
        
        console.log("\nStep 4: Financial Veto Evaluation for top candidates...");
        for (const c of sortedScored) {
            let fund = c.metrics.fundamental;
            if (!fund || Object.keys(fund).length === 0 || fund.roe === undefined) {
                console.log(`📡 [Pulse Financial Fallback] Cache miss/empty for financials of ${c.name}. Fetching live...`);
                fund = await fetchStockFinancialsForVeto(c.code);
            }
            const fin = {
                roe: fund?.roe && fund?.roe !== '-' ? parseFloat(fund?.roe) : null,
                per: fund?.per && fund?.per !== '-' ? parseFloat(fund?.per) : null,
                pbr: fund?.pbr && fund?.pbr !== '-' ? parseFloat(fund?.pbr) : null,
                opProfits: (fund?.finance || []).map(f => f.profit),
                debtRatio: fund?.debtRatio && fund?.debtRatio !== '-' ? parseFloat(fund?.debtRatio) : null
            };
            
            let isVetoed = false;
            let vetoReason = '';
            
            if (fin.roe !== null && fin.roe < 0) {
                isVetoed = true;
                vetoReason = `ROE 적자 (${fin.roe}%)`;
            } else if (fin.opProfits && fin.opProfits.length >= 3 && fin.opProfits.every(p => p < 0)) {
                isVetoed = true;
                vetoReason = '3분기 연속 영업손실';
            } else if (fin.debtRatio !== null && fin.debtRatio >= 200) {
                isVetoed = true;
                vetoReason = `부채비율 과다 (${fin.debtRatio}%)`;
            } else if (fin.pbr !== null) {
                const pbrThreshold = (fin.roe !== null && fin.roe >= 20) ? 15 : 10;
                if (fin.pbr >= pbrThreshold) {
                    isVetoed = true;
                    vetoReason = `고PBR 버블 (${fin.pbr}배, 기준: ${pbrThreshold}배)`;
                }
            }
            
            // Dual Engine filters
            const passedShort = (c.totalScore >= 60 && c.metrics.strength >= 90 && c.metrics.disparity20 < 107 && c.metrics.shortRatio < 10);
            const passedLong = (c.totalScore >= 60 && c.metrics.strength >= 85 && c.metrics.disparity20 < 105 && c.metrics.shortRatio < 10);
            
            console.log(`- ${c.name} (${c.code}): TotalScore = ${c.totalScore}`);
            console.log(`  Metrics: Strength = ${c.metrics.strength}, Disparity20 = ${c.metrics.disparity20}, ShortRatio = ${c.metrics.shortRatio}`);
            console.log(`  Scores: Strength = ${c.scores.strengthScore}, Disparity = ${c.scores.disparityScore}, Short = ${c.scores.shortScore}, Supply = ${c.scores.supplyScore}`);
            console.log(`  Financials: ROE = ${fin.roe}, Debt = ${fin.debtRatio}, PBR = ${fin.pbr}, OpProfits = ${JSON.stringify(fin.opProfits)}`);
            console.log(`  Passed Short Filter: ${passedShort}, Passed Long Filter: ${passedLong}, Vetoed: ${isVetoed} (${vetoReason})`);
        }
        
    } catch (e) {
        console.error("Diagnostic execution error:", e);
    }
})();
