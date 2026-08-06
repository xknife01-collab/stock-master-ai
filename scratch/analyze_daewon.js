import { fetchStockFullDetailFromKIS, fetchStockIntradayInvestorEstimate } from '../lib/kisCore.js';
import dotenv from 'dotenv';
dotenv.config();

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

(async () => {
    try {
        console.log("Fetching Dae-Won Cable (006340) details from KIS...");
        const detail = await fetchStockFullDetailFromKIS('006340', null, false);
        const estimate = await fetchStockIntradayInvestorEstimate('006340');

        console.log("\n=================== DAE-WON CABLE (006340) DIAGNOSTICS ===================");
        console.log("Price:", detail?.fundamental?.price);
        console.log("Change Rate (%):", detail?.fundamental?.change);
        console.log("Sector:", detail?.fundamental?.sector);
        
        console.log("\n------------------- Technical Indicators -------------------");
        console.log("RSI:", detail?.advanced?.technical?.rsi);
        console.log("MA5:", detail?.advanced?.technical?.ma5);
        console.log("MA20:", detail?.advanced?.technical?.ma20);
        console.log("MA60:", detail?.advanced?.technical?.ma60);
        console.log("MA Alignment:", detail?.advanced?.technical?.maAlignment);
        console.log("Disparity20 (20일 이격도):", detail?.advanced?.technical?.disparity20);
        console.log("Bollinger Bands:", JSON.stringify(detail?.advanced?.technical?.bollinger, null, 2));

        console.log("\n------------------- Advanced Data -------------------");
        console.log("Short Ratio (공매도 비중):", detail?.advanced?.shortRatio);
        console.log("Strength (체결강도):", detail?.advanced?.strength);
        console.log("Strength Acceleration (체결강도 가속도):", detail?.advanced?.strengthAcceleration);
        console.log("Transaction Value (거래대금, 억):", detail?.advanced?.transactionValue);
        console.log("Volume Rate (거래량 대비 %):", detail?.advanced?.volumeRate);
        console.log("Investor Trend (isRealtime):", detail?.advanced?.investor?.isRealtime);
        console.log("Investor Buy/Sell:", JSON.stringify(detail?.advanced?.investor, null, 2));

        console.log("\n=================== INTRADAY ESTIMATE ===================");
        console.log("Estimate:", JSON.stringify(estimate, null, 2));

        console.log("\n=================== QUANT SCORING & VETO CHECK ===================");
        // Financials mapping
        const fin = {
            roe: detail?.fundamental?.roe !== '-' ? parseFloat(detail?.fundamental?.roe) : null,
            per: detail?.fundamental?.per !== '-' ? parseFloat(detail?.fundamental?.per) : null,
            pbr: detail?.fundamental?.pbr !== '-' ? parseFloat(detail?.fundamental?.pbr) : null,
            opProfits: (detail?.fundamental?.finance || []).map(f => f.profit),
            debtRatio: detail?.fundamental?.debtRatio !== '-' ? parseFloat(detail?.fundamental?.debtRatio) : null
        };
        console.log("Financial Metrics:", JSON.stringify(fin, null, 2));

        const m = {
            price: detail?.fundamental?.price || 0,
            disparity5: parseNum(detail?.advanced?.technical?.disparity5, 100),
            disparity20: parseNum(detail?.advanced?.technical?.disparity20, 100),
            strength: parseNum(detail?.advanced?.strength, 100),
            shortRatio: parseNum(detail?.advanced?.shortRatio, 0),
            investor1D: {
                foreign: parseNum(detail?.advanced?.investor?.foreign1D, 0),
                organ: parseNum(detail?.advanced?.investor?.organ1D, 0),
                personal: parseNum(detail?.advanced?.investor?.personal1D, 0)
            },
            investor5D: {
                foreign: parseNum(detail?.advanced?.investor?.foreign5D, 0),
                organ: parseNum(detail?.advanced?.investor?.organ5D, 0),
                personal: parseNum(detail?.advanced?.investor?.personal5D, 0)
            },
            investorMoney5D: {
                foreign: parseNum(detail?.advanced?.investor?.foreignMoney5D, 0),
                organ: parseNum(detail?.advanced?.investor?.organMoney5D, 0),
                personal: parseNum(detail?.advanced?.investor?.personalMoney5D, 0)
            },
            creditBalance: parseNum(detail?.advanced?.creditBalance, 0)
        };

        // VETO check
        let isVetoed = false;
        let vetoReason = '';
        const credBal = m.creditBalance || 0;
        if (credBal > 6) {
            isVetoed = true;
            vetoReason = `Credit > 6% (${credBal}%)`;
        }
        if (fin.roe !== null && fin.roe < 0) {
            isVetoed = true;
            vetoReason = `ROE 적자 (${fin.roe}%)`;
        }
        if (fin.opProfits && fin.opProfits.length >= 3 && fin.opProfits.every(p => p < 0)) {
            isVetoed = true;
            vetoReason = '3분기 연속 영업손실';
        }
        if (fin.debtRatio !== null && fin.debtRatio >= 200) {
            isVetoed = true;
            vetoReason = `부채비율 과다 (${fin.debtRatio}%)`;
        }
        const pbrThreshold = (fin.roe !== null && fin.roe >= 20) ? 20 : 15;
        if (fin.pbr !== null && fin.pbr >= pbrThreshold) {
            isVetoed = true;
            vetoReason = `고PBR 버블 (${fin.pbr}배)`;
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

        const inv1D = m.investor1D;
        const inv5D = m.investor5D;
        const invMoney5D = m.investorMoney5D;

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

        console.log(`\n📌 [DAE-WON CABLE (006340)]`);
        console.log(`  Vetoed: ${isVetoed ? '❌ YES (' + vetoReason + ')' : '✅ NO'}`);
        console.log(`  Scores: strengthScore=${strengthScore}, disparityScore=${disparityScore}, shortScore=${shortScore}, supplyScore=${supplyScore}`);
        console.log(`  Total Score: ${totalScore}`);

    } catch (e) {
        console.error("Failed to run analysis:", e);
    }
})();
