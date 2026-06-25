import dotenv from 'dotenv';
dotenv.config();
import supabase from '../lib/supabaseClient.js';
import { getSupplyCache } from '../lib/supplyCache.js';
import { fetchConditionResult } from '../lib/kisCore.js';

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

const getSupplyPointsCombined = (fQty, oQty, pQty, fMoney, oMoney, pMoney, maxS) => {
    const isAntQty = fQty < 0 && oQty < 0 && pQty > 0;
    const isAntMoney = fMoney < 0 && oMoney < 0 && pMoney > 0;
    if (isAntQty || isAntMoney) return -30;
    
    let qtyScore = 0;
    if (fQty > 0 && oQty > 0) qtyScore = maxS;
    else if (fQty + oQty > 0) qtyScore = maxS === 20 ? 15 : 20;
    else if (fQty > 0 || oQty > 0) qtyScore = 10;
    
    let moneyScore = 0;
    if (fMoney > 0 && oMoney > 0) {
        const totalMoney = fMoney + oMoney;
        if (totalMoney >= 50) moneyScore = maxS;
        else if (totalMoney >= 20) moneyScore = Math.round(maxS * 0.9);
        else if (totalMoney >= 10) moneyScore = Math.round(maxS * 0.8);
        else moneyScore = Math.round(maxS * 0.7);
    } else if (fMoney + oMoney > 0) {
        const totalMoney = fMoney + oMoney;
        if (totalMoney >= 50) moneyScore = Math.round(maxS * 0.8);
        else if (totalMoney >= 20) moneyScore = Math.round(maxS * 0.75);
        else if (totalMoney >= 10) moneyScore = Math.round(maxS * 0.65);
        else moneyScore = Math.round(maxS * 0.5);
    } else if (fMoney > 0 || oMoney > 0) {
        const singleMax = Math.max(fMoney, oMoney);
        if (singleMax >= 30) moneyScore = Math.round(maxS * 0.6);
        else if (singleMax >= 10) moneyScore = Math.round(maxS * 0.5);
        else moneyScore = Math.round(maxS * 0.3);
    }
    
    return Math.round(qtyScore * 0.5 + moneyScore * 0.5);
};

const parseNum = (val, fallback = 0) => {
    if (val === undefined || val === null || val === '-') return fallback;
    const parsed = parseFloat(val);
    return isNaN(parsed) ? fallback : parsed;
};

async function printTop40() {
    console.log("📡 Loading Discovery Funnel Caches...");
    const cachedGainers = getSupplyCache('dashboard_fluctuation_rank') || [];
    const cachedValues = getSupplyCache('dashboard_volume_rank') || [];
    const cachedSupply = getSupplyCache('ai_supply') || "";

    const mapDashboardCache = (list) => {
        if (!Array.isArray(list)) return [];
        return list.map(it => ({
            name: it.n || it.name,
            code: it.s || it.code,
            price: it.p || it.price || '0',
            change: it.pct ? it.pct.replace('%', '') : (it.change || '0'),
            volume: it.volume || 0,
            value: it.value || 0
        }));
    };

    const gainers = mapDashboardCache(cachedGainers);
    const values = mapDashboardCache(cachedValues);
    const supplyList = cachedSupply;
    
    let htsGolden = [];
    let htsVolume = [];
    try {
        const [goldenRes, volumeRes] = await Promise.all([
            fetchConditionResult('0'),
            fetchConditionResult('1')
        ]);
        htsGolden = goldenRes || [];
        htsVolume = volumeRes || [];
    } catch (condErr) {
        console.warn("KIS condition search failed, fallback to static defaults.");
        htsGolden = [
            { code: '005930', name: '삼성전자' },
            { code: '000660', name: 'SK하이닉스' }
        ];
        htsVolume = [
            { code: '089030', name: '테크윙' }
        ];
    }

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
        });

    const symbols = candidatePool.map(c => c.code);
    console.log(`Fetched ${symbols.length} total candidates from funnel.`);

    const { data: cachedRows, error } = await supabase
        .from('stock_detail_cache')
        .select('*')
        .in('symbol', symbols);

    if (error) {
        console.error("Database query failed:", error.message);
        return;
    }

    const metricsMap = {};
    cachedRows.forEach(row => {
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

    // Populate missing defaults
    for (const c of candidatePool) {
        if (!metricsMap[c.code]) {
            metricsMap[c.code] = {
                price: c.price || 0,
                disparity5: 100,
                disparity20: 100,
                strength: 100,
                shortRatio: 0,
                investor1D: { foreign: 0, organ: 0, personal: 0 },
                investor5D: { foreign: 0, organ: 0, personal: 0 },
                investorMoney5D: { foreign: 0, organ: 0, personal: 0 },
                transactionValue: 0,
                prevTransactionValue: 0,
                volumeRate: 100,
                creditBalance: 0,
                sector: '기타'
            };
        }
    }

    const scoredCandidates = candidatePool.map(c => {
        const m = metricsMap[c.code];
        
        let strengthScore = 0;
        let disparityScore = 0;
        let shortScore = 0;
        let supplyScore = 0;

        // Normal Mode Scoring
        const str = m.strength;
        if (str >= 120) strengthScore = 40;
        else if (str >= 105) strengthScore = 30;
        else if (str >= 100) strengthScore = 20;
        else if (str >= 90) strengthScore = 10;
        else strengthScore = 0;

        // NEW 20-day disparity breakout rule logic
        const isDualBuy = m.investor1D && m.investor1D.foreign > 0 && m.investor1D.organ > 0;
        const hasStrongStrength = str >= 115;
        const isStrongBreakout = isDualBuy && hasStrongStrength;
        const limitDispNormal = isStrongBreakout ? 112 : 107;

        const disp = m.disparity20;
        if (disp >= 98 && disp <= 104) disparityScore = 10;
        else if (disp > 104 && disp <= 106) disparityScore = 7;
        else if (disp < 98) disparityScore = 4;
        else if (disp > 106 && disp <= limitDispNormal) disparityScore = 3;
        else if (disp > limitDispNormal) disparityScore = -15;
        else disparityScore = -10;

        const sr = m.shortRatio;
        if (sr < 5) shortScore = 10;
        else if (sr >= 5 && sr < 12) shortScore = 5;
        else if (sr >= 12 && sr < 15) shortScore = 0;
        else shortScore = -15;

        const inv1D = m.investor1D || { foreign: 0, organ: 0, personal: 0 };
        const inv5D = m.investor5D || { foreign: 0, organ: 0, personal: 0 };
        const invMoney5D = m.investorMoney5D || { foreign: 0, organ: 0, personal: 0 };

        const fMoney1D = Math.round((inv1D.foreign * m.price) / 100000000);
        const oMoney1D = Math.round((inv1D.organ * m.price) / 100000000);
        const pMoney1D = Math.round((inv1D.personal * m.price) / 100000000);

        const score1D = getSupplyPointsCombined(inv1D.foreign, inv1D.organ, inv1D.personal, fMoney1D, oMoney1D, pMoney1D, 40);
        const score5D = getSupplyPointsCombined(inv5D.foreign, inv5D.organ, inv5D.personal, invMoney5D.foreign, invMoney5D.organ, invMoney5D.personal, 40);
        if (inv1D.foreign === 0 && inv1D.organ === 0) {
            supplyScore = score5D;
        } else {
            supplyScore = Math.round(score1D * 0.7 + score5D * 0.3);
        }

        const totalScore = strengthScore + disparityScore + shortScore + supplyScore;

        // VETO Rule Check
        let isVetoed = false;
        let vetoReason = '';
        const limitDisp20 = isStrongBreakout ? 112 : 107;
        
        if (disp > limitDisp20) {
            isVetoed = true;
            vetoReason = `20일 이격도 과열 (${disp}%, 기준: ${limitDisp20}% 초과)`;
        }

        const row = cachedRows.find(r => r.symbol === c.code);
        if (row && row.fundamental) {
            const fin = {
                roe: row.fundamental.roe !== '-' ? parseFloat(row.fundamental.roe) : null,
                per: row.fundamental.per !== '-' ? parseFloat(row.fundamental.per) : null,
                pbr: row.fundamental.pbr !== '-' ? parseFloat(row.fundamental.pbr) : null,
                opProfits: (row.fundamental.finance || []).map(f => f.profit),
                debtRatio: row.fundamental.debtRatio !== '-' ? parseFloat(row.fundamental.debtRatio) : null
            };
            if (fin.roe !== null && fin.roe < 0) {
                isVetoed = true;
                vetoReason = 'ROE 적자';
            } else if (fin.opProfits && fin.opProfits.length >= 3 && fin.opProfits.every(p => p < 0)) {
                isVetoed = true;
                vetoReason = '3분기 연속 영업손실';
            } else if (fin.debtRatio !== null && fin.debtRatio >= 200) {
                isVetoed = true;
                vetoReason = `부채비율 과다 (${fin.debtRatio}%)`;
            } else {
                const pbrThresh = (fin.roe !== null && fin.roe >= 20) ? 20 : 15;
                if (fin.pbr !== null && fin.pbr >= pbrThresh) {
                    isVetoed = true;
                    vetoReason = `고PBR 버블 (${fin.pbr}배)`;
                }
            }
        }

        return {
            name: c.name,
            code: c.code,
            totalScore,
            isVetoed,
            vetoReason,
            metrics: m
        };
    });

    const finalSortedScored = scoredCandidates.sort((a, b) => b.totalScore - a.totalScore).slice(0, 40);

    console.log("===RESULT_START===");
    finalSortedScored.forEach((c, idx) => {
        console.log(`${idx + 1}. [${c.name} (${c.code})] - 총점: ${c.totalScore}점 | VETO 여부: ${c.isVetoed ? '❌ YES (' + c.vetoReason + ')' : '✅ NO'} | 이격도: ${c.metrics.disparity20}% | 체결강도: ${c.metrics.strength}%`);
    });
    console.log("===RESULT_END===");
    process.exit(0);
}

printTop40();
