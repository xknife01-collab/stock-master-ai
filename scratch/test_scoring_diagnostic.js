import supabase from '../lib/supabaseClient.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const candidateSymbols = [
    '047040', '049120', '014910', '005930', '000660', '042700', '007660', '403870',
    '089030', '058470', '000990', '352820', '067310', '005380', '000270', '207940',
    '068270', '105560', '055550', '196170'
];

// Replicate logic from routes/aiApi.js
const parseNum = (val, fallback = 0) => {
    if (val === undefined || val === null || val === '-') return fallback;
    const parsed = parseFloat(val);
    return isNaN(parsed) ? fallback : parsed;
};

const getSupplyPointsCombined = (fQty, oQty, pQty, fMoney, oMoney, pMoney, maxS) => {
    const isAntQty = fQty < 0 && oQty < 0 && pQty > 0;
    const isAntMoney = fMoney < 0 && oMoney < 0 && pMoney > 0;
    if (isAntQty || isAntMoney) return -30;
    
    let qtyScore = 0;
    if (fQty > 0 && oQty > 0) {
        qtyScore = maxS;
    } else if (fQty + oQty > 0) {
        qtyScore = maxS === 20 ? 15 : 20;
    } else if (fQty > 0 || oQty > 0) {
        qtyScore = 10;
    }
    
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

async function run() {
    const { data: rows, error } = await supabase
        .from('stock_detail_cache')
        .select('*')
        .in('symbol', candidateSymbols);
        
    if (error || !rows) {
        console.error("Error fetching:", error?.message);
        return;
    }
    
    const marketStress = { safeMode: false }; // Normal Mode
    const isSafe = marketStress.safeMode;
    
    const candidatePool = rows.map(row => ({
        code: row.symbol,
        name: row.fundamental?.name || row.symbol,
        price: row.fundamental?.price || 0,
        change: 0
    }));
    
    const metricsMap = {};
    rows.forEach(row => {
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

    const scoredCandidates = candidatePool.map(c => {
        const m = metricsMap[c.code];
        const row = rows.find(r => r.symbol === c.code);
        
        // Financials mapping
        const fin = {
            roe: row.fundamental.roe !== '-' ? parseFloat(row.fundamental.roe) : null,
            per: row.fundamental.per !== '-' ? parseFloat(row.fundamental.per) : null,
            pbr: row.fundamental.pbr !== '-' ? parseFloat(row.fundamental.pbr) : null,
            opProfits: (row.fundamental.finance || []).map(f => f.profit),
            debtRatio: row.fundamental.debtRatio !== '-' ? parseFloat(row.fundamental.debtRatio) : null
        };
        
        c.financials = fin;
        c.scores = {};
        
        // VETO check
        const credBal = m.creditBalance || 0;
        const isVetoedByCredit = credBal > 6;
        if (isVetoedByCredit) {
            c.isVetoed = true;
            c.vetoReason = 'Credit > 6%';
        }
        
        if (fin.roe !== null && fin.roe < 0) {
            c.isVetoed = true;
            c.vetoReason = 'ROE 적자';
        }
        if (fin.opProfits && fin.opProfits.length >= 3 && fin.opProfits.every(p => p < 0)) {
            c.isVetoed = true;
            c.vetoReason = '3분기 연속 영업손실';
        }
        if (fin.debtRatio !== null && fin.debtRatio >= 200) {
            c.isVetoed = true;
            c.vetoReason = `부채비율 과다 (${fin.debtRatio}%)`;
        }
        const pbrThreshold = (fin.roe !== null && fin.roe >= 20) ? 20 : 15;
        if (fin.pbr !== null && fin.pbr >= pbrThreshold) {
            c.isVetoed = true;
            c.vetoReason = `고PBR 버블 (${fin.pbr}배)`;
        }
        
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

        const disp = m.disparity20;
        if (disp >= 98 && disp <= 104) disparityScore = 10;
        else if (disp > 104 && disp <= 106) disparityScore = 7;
        else if (disp < 98) disparityScore = 4;
        
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

        c.scores = { strengthScore, disparityScore, shortScore, supplyScore };
        c.totalScore = strengthScore + disparityScore + shortScore + supplyScore;
        c.metrics = m;

        return c;
    });

    const finalSortedScored = [...scoredCandidates].sort((a, b) => b.totalScore - a.totalScore).slice(0, 40);

    const technicallyFiltered = finalSortedScored.filter(c => {
        if (c.isVetoed) return false;

        const isDualBuy = c.metrics.investor1D && c.metrics.investor1D.foreign > 0 && c.metrics.investor1D.organ > 0;
        const hasStrongStrength = c.metrics.strength >= 115;
        const isStrongBreakout = isDualBuy && hasStrongStrength;

        const maxShortDisp20 = (isStrongBreakout) ? 112 : 107;
        const maxLongDisp20 = (isStrongBreakout) ? 108 : 105;

        const passedShort = (c.totalScore >= 55 && c.metrics.strength >= 90 && c.metrics.disparity20 < maxShortDisp20 && c.metrics.shortRatio < 10);
        const passedLong = (c.totalScore >= 55 && c.metrics.strength >= 85 && c.metrics.disparity20 < maxLongDisp20 && c.metrics.shortRatio < 10);

        c.passedShort = passedShort;
        c.passedLong = passedLong;
        return passedShort || passedLong;
    });

    console.log(`Diagnostic results (Total technicallyFiltered: ${technicallyFiltered.length}):`);
    for (const c of finalSortedScored) {
        console.log(`\n📌 [${c.name} (${c.code})]`);
        console.log(`  Vetoed: ${c.isVetoed ? '❌ YES (' + c.vetoReason + ')' : '✅ NO'}`);
        console.log(`  Scores: strengthScore=${c.scores.strengthScore}, disparityScore=${c.scores.disparityScore}, shortScore=${c.scores.shortScore}, supplyScore=${c.scores.supplyScore}`);
        console.log(`  Total Score: ${c.totalScore}`);
        console.log(`  Passed short: ${c.passedShort ? '✅' : '❌'}, Passed long: ${c.passedLong ? '✅' : '❌'}`);
    }
    
    process.exit(0);
}

run();
