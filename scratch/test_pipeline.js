import dotenv from 'dotenv';
dotenv.config();

import supabase from '../lib/supabaseClient.js';
import { 
    fetchMarketRankings, fetchConditionResult, getAccessToken
} from '../lib/kisCore.js';
import { getSupplyCache, saveSupplyCache } from '../lib/supplyCache.js';
import axios from 'axios';

const isEtfOrIndex = (name) => {
    const keywords = ["KODEX", "TIGER", "SOL", "RISE", "KBSTAR", "ACE", "HANARO", "KOSEF", "ARIRANG", "ETN", "인버스", "레버리지", "선물", "국채", "달러", "고배당", "MSCI", "ESG", "active", "액티브", "로우볼", "밸류", "모멘텀"];
    return keywords.some(k => name.toUpperCase().includes(k.toUpperCase()));
};

(async () => {
    try {
        console.log("🔍 [Test Pipeline] Simulating Stage 1 Pipeline Execution...");
        
        // 1. Fetch Discovery Funnel Candidates
        console.log("1. Fetching discovery sources...");
        let gainers = [], values = [], htsGolden = [], htsVolume = [];
        try {
            [gainers, values, htsGolden, htsVolume] = await Promise.all([
                fetchMarketRankings('GAIN'),
                fetchMarketRankings('VOLUME'),
                fetchConditionResult('0'),
                fetchConditionResult('1')
            ]);
        } catch (err) {
            console.warn("⚠️ KIS discovery API failed due to timeout/rate-limit. Seeding hardcoded candidates.");
        }
        
        console.log(`- Gainers count: ${gainers?.length || 0}`);
        console.log(`- Values count: ${values?.length || 0}`);
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

        // If candidates are empty, seed with known stocks
        if (candidateOccurrence.size === 0) {
            console.log("Seeding backup candidates (HPSP, Seosan, Hanmi Semiconductor, Samsung, Hynix, Celltrion)...");
            const backupList = [
                { name: 'HPSP', code: '403870', price: 40000, change: 1.5, volume: 100000, value: 4000000000 },
                { name: '서산', code: '079650', price: 3000, change: 2.0, volume: 50000, value: 150000000 },
                { name: '한미반도체', code: '042700', price: 120000, change: -1.0, volume: 200000, value: 24000000000 },
                { name: '삼성전자', code: '005930', price: 75000, change: 0.5, volume: 5000000, value: 375000000000 },
                { name: 'SK하이닉스', code: '000660', price: 160000, change: 3.0, volume: 1000000, value: 160000000000 },
                { name: '셀트리온', code: '068270', price: 180000, change: 0.0, volume: 150000, value: 27000000000 }
            ];
            backupList.forEach(it => {
                candidateOccurrence.set(it.code, {
                    ...it,
                    count: 1,
                    tags: ["백업"]
                });
            });
        }

        const candidatePool = Array.from(candidateOccurrence.values())
            .filter(c => !isEtfOrIndex(c.name))
            .sort((a, b) => {
                if (b.count !== a.count) return b.count - a.count;
                if (b.value !== a.value) return b.value - a.value;
                return Math.abs(b.change) - Math.abs(a.change);
            });

        console.log(`\nFiltered Candidate Pool Size: ${candidatePool.length}`);
        
        const symbols = candidatePool.map(c => c.code);
        let metricsMap = {};
        let cacheData = [];
        let cachedRows = [];

        const parseNum = (val, fallback = 0) => {
            if (val === undefined || val === null || val === '-') return fallback;
            const parsed = parseFloat(val);
            return isNaN(parsed) ? fallback : parsed;
        };

        // 2. Fetch from stock_detail_cache
        console.log("\n2. Querying Supabase cache for symbols...");
        if (supabase) {
            const { data, error } = await supabase
                .from('stock_detail_cache')
                .select('*')
                .in('symbol', symbols);
            
            if (error) {
                console.error("Supabase Error:", error.message);
            } else if (data) {
                cacheData = data;
                cachedRows = data;
                console.log(`- Found ${data.length} entries in Supabase cache.`);
                
                const now = new Date();
                const freshData = data.filter(row => {
                    if (!row.updated_at) return false;
                    const updatedAt = new Date(row.updated_at);
                    const diffMins = (now.getTime() - updatedAt.getTime()) / (1000 * 60);
                    return false; // Force stale fallback
                    
                    if (!row.advanced || row.advanced.atr === undefined || row.advanced.atrPercent === undefined || row.advanced.volumeRate === undefined || row.advanced.prevTransactionValue === undefined) {
                        return false;
                    }
                    return true;
                });
                
                console.log(`- Fresh cache count (<=60 mins & complete schema): ${freshData.length}`);
                
                freshData.forEach(row => {
                    metricsMap[row.symbol] = {
                        price: row.fundamental?.price || 0,
                        disparity5: parseNum(row.advanced?.disparity5, 100),
                        disparity20: parseNum(row.advanced?.disparity20, 100),
                        strength: parseNum(row.advanced?.strength, 100),
                        shortRatio: parseNum(row.advanced?.shortRatio, 0),
                        investor1D: {
                            foreign: parseNum(row.advanced?.investor?.foreign1D, 0),
                            organ: parseNum(row.advanced?.investor?.organ1D, 0),
                            personal: parseNum(row.advanced?.investor?.personal1D, 0)
                        },
                        investor5D: {
                            foreign: parseNum(row.advanced?.investor?.foreign5D, 0),
                            organ: parseNum(row.advanced?.investor?.organ5D, 0),
                            personal: parseNum(row.advanced?.investor?.personal5D, 0)
                        },
                        investorMoney5D: {
                            foreign: parseNum(row.advanced?.investor?.foreignMoney5D, 0),
                            organ: parseNum(row.advanced?.investor?.organMoney5D, 0),
                            personal: parseNum(row.advanced?.investor?.personalMoney5D, 0)
                        },
                        atr: row.advanced?.atr !== undefined ? parseNum(row.advanced?.atr, null) : null,
                        atrPercent: row.advanced?.atrPercent !== undefined ? parseNum(row.advanced?.atrPercent, null) : null,
                        transactionValue: parseNum(row.advanced?.transactionValue, 0),
                        prevTransactionValue: parseNum(row.advanced?.prevTransactionValue, 0),
                        volumeRate: parseNum(row.advanced?.volumeRate, 100),
                        creditBalance: parseNum(row.advanced?.creditBalance, 0),
                        sector: row.fundamental?.sector || '기타'
                    };
                });
            }
        }

        // 3. Apply Stale Cache Fallback
        console.log("\n3. Applying Stale Cache Fallback (Graceful Fallback)...");
        let fallbackCount = 0;
        let dummyCount = 0;
        
        for (const c of candidatePool) {
            const symbol = c.code;
            if (!metricsMap[symbol]) {
                const staleRow = (cacheData || []).find(row => row.symbol === symbol);
                if (staleRow) {
                    fallbackCount++;
                    metricsMap[symbol] = {
                        price: staleRow.fundamental?.price || 0,
                        disparity5: parseNum(staleRow.advanced?.disparity5, 100),
                        disparity20: parseNum(staleRow.advanced?.disparity20, 100),
                        strength: parseNum(staleRow.advanced?.strength, 100),
                        shortRatio: parseNum(staleRow.advanced?.shortRatio, 0),
                        investor1D: {
                            foreign: parseNum(staleRow.advanced?.investor?.foreign1D, 0),
                            organ: parseNum(staleRow.advanced?.investor?.organ1D, 0),
                            personal: parseNum(staleRow.advanced?.investor?.personal1D, 0)
                        },
                        investor5D: {
                            foreign: parseNum(staleRow.advanced?.investor?.foreign5D, 0),
                            organ: parseNum(staleRow.advanced?.investor?.organ5D, 0),
                            personal: parseNum(staleRow.advanced?.investor?.personal5D, 0)
                        },
                        investorMoney5D: {
                            foreign: parseNum(staleRow.advanced?.investor?.foreignMoney5D, 0),
                            organ: parseNum(staleRow.advanced?.investor?.organMoney5D, 0),
                            personal: parseNum(staleRow.advanced?.investor?.personalMoney5D, 0)
                        },
                        atr: staleRow.advanced?.atr !== undefined ? parseNum(staleRow.advanced.atr, null) : null,
                        atrPercent: staleRow.advanced?.atrPercent !== undefined ? parseNum(staleRow.advanced.atrPercent, null) : null,
                        transactionValue: parseNum(staleRow.advanced?.transactionValue, 0),
                        prevTransactionValue: parseNum(staleRow.advanced?.prevTransactionValue, 0),
                        volumeRate: parseNum(staleRow.advanced?.volumeRate, 100),
                        creditBalance: parseNum(staleRow.advanced?.creditBalance, 0),
                        sector: staleRow.fundamental?.sector || '기타'
                    };
                } else {
                    dummyCount++;
                    metricsMap[symbol] = {
                        price: c.price || 0,
                        disparity5: 100,
                        disparity20: 100,
                        strength: 100,
                        shortRatio: 0,
                        investor1D: { foreign: 0, organ: 0, personal: 0 },
                        investor5D: { foreign: 0, organ: 0, personal: 0 },
                        investorMoney5D: { foreign: 0, organ: 0, personal: 0 },
                        atr: null,
                        atrPercent: null,
                        transactionValue: 0,
                        prevTransactionValue: 0,
                        volumeRate: 100,
                        creditBalance: 0,
                        sector: '기타'
                    };
                }
            }
        }
        
        console.log(`- Populated metricsMap: Fallback to stale cache = ${fallbackCount}, Default dummy = ${dummyCount}`);

        // 4. Score Candidates
        console.log("\n4. Scoring candidate pool...");
        const scoredCandidates = [];
        for (const c of candidatePool) {
            const m = metricsMap[c.code];
            if (!m) continue;
            
            let strengthScore = 0;
            let disparityScore = 0;
            let shortScore = 0;
            let supplyScore = 0;
            
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
            
            const totalScore = strengthScore + disparityScore + shortScore + supplyScore;
            
            scoredCandidates.push({
                name: c.name,
                code: c.code,
                totalScore,
                metrics: m,
                scores: { strengthScore, disparityScore, shortScore, supplyScore }
            });
        }

        const sortedScored = scoredCandidates.sort((a, b) => b.totalScore - a.totalScore);
        const top40 = sortedScored.slice(0, 40);

        console.log(`\n--- TOP 15 SCORING CANDIDATES AFTER STALE FALLBACK ---`);
        for (let i = 0; i < Math.min(15, top40.length); i++) {
            const c = top40[i];
            const cachedRow = cachedRows.find(r => r.symbol === c.code);
            const fund = cachedRow ? cachedRow.fundamental : null;
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
                const pbrThreshold = (fin.roe !== null && fin.roe >= 20) ? 20 : 15;
                if (fin.pbr >= pbrThreshold) {
                    isVetoed = true;
                    vetoReason = `고PBR 버블 (${fin.pbr}배, 기준: ${pbrThreshold}배)`;
                }
            }

            const passedShort = (c.totalScore >= 60 && c.metrics.strength >= 90 && c.metrics.disparity20 < 107 && c.metrics.shortRatio < 10);
            const passedLong = (c.totalScore >= 60 && c.metrics.strength >= 85 && c.metrics.disparity20 < 105 && c.metrics.shortRatio < 10);
            const passVeto = !isVetoed && (passedShort || passedLong);

            console.log(`[#${i+1}] ${c.name} (${c.code}): Score = ${c.totalScore} | ShortPass = ${passedShort}, LongPass = ${passedLong}, Vetoed = ${isVetoed} (${vetoReason}) => PASS = ${passVeto}`);
            console.log(`   └─ Metrics: Str = ${c.metrics.strength}%, Disp20 = ${c.metrics.disparity20}%, ShortRatio = ${c.metrics.shortRatio}%, Credit = ${c.metrics.creditBalance}%`);
            console.log(`   └─ Financials: ROE = ${fin.roe}%, Debt = ${fin.debtRatio}%, PBR = ${fin.pbr}배`);
        }

        process.exit(0);
    } catch (e) {
        console.error("Test execution failed:", e);
        process.exit(1);
    }
})();
