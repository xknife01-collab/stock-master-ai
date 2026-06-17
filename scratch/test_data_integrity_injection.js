import dotenv from 'dotenv';
dotenv.config();

import { fetchStockFullDetailFromKIS } from '../lib/kisCore.js';

// Mock objects for testing the mapping and filtering in aiApi
const mockCandidatePool = [
    { name: "삼성전자", code: "005930", price: 75000, change: 1.5 },
    { name: "SK하이닉스", code: "000660", price: 180000, change: 2.0 },
    { name: "이수페타시스", code: "007660", price: 40000, change: -0.5 },
    { name: "에코프로", code: "086520", price: 100000, change: -1.0 }
];

const mockMetricsMap = {
    // 1. Normal active stock
    "005930": {
        price: 75000,
        disparity5: 102,
        disparity20: 101,
        strength: 115,
        shortRatio: 1.5,
        investor1D: { foreign: 50000, organ: 20000, personal: -70000 },
        investor5D: { foreign: 150000, organ: 50000, personal: -200000 },
        investorMoney5D: { foreign: 112, organ: 37, personal: -150 },
        atr: 1500,
        atrPercent: 2.0,
        transactionValue: 500000000000, // 5000억
        prevTransactionValue: 450000000000,
        volumeRate: 120,
        creditBalance: 1.2,
        sector: "반도체",
        isSelfHealed: false,
        selfHealedReasons: [],
        isDefaultFallback: false
    },
    // 2. Self-healed stock (with default/healed strength & value, but valid other metrics)
    "000660": {
        price: 180000,
        disparity5: 100,
        disparity20: 100,
        strength: 100, // Default strength
        shortRatio: 2.0,
        investor1D: { foreign: 0, organ: 0, personal: 0 },
        investor5D: { foreign: 0, organ: 0, personal: 0 },
        investorMoney5D: { foreign: 0, organ: 0, personal: 0 },
        atr: 3600,
        atrPercent: 2.0,
        transactionValue: 0, // Zero transaction value
        prevTransactionValue: 120000000000,
        volumeRate: 100,
        creditBalance: 0.8,
        sector: "반도체",
        isSelfHealed: true,
        selfHealedReasons: ["strength_default_or_zero", "transactionValue_zero"],
        isDefaultFallback: false
    },
    // 3. Default fallback stock (completely missing from cache)
    "086520": {
        price: 100000,
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
        sector: "기타",
        isSelfHealed: false,
        selfHealedReasons: [],
        isDefaultFallback: true
    }
};

function runDiagnostic() {
    console.log("=== Starting AI Data Integrity VETO & Badge Injection Test ===");

    // Step 1: Simulate scoredCandidates loop with VETO
    const forceRecommend = process.env.FORCE_RECOMMEND === 'true';
    console.log(`- FORCE_RECOMMEND status: ${forceRecommend}`);

    const scoredCandidates = mockCandidatePool.map(c => {
        const m = mockMetricsMap[c.code] || { price: c.price, disparity5: 100, disparity20: 100, strength: 100, shortRatio: 0, investor1D: { foreign: 0, organ: 0, personal: 0 }, investor5D: { foreign: 0, organ: 0, personal: 0 }, investorMoney5D: { foreign: 0, organ: 0, personal: 0 }, transactionValue: 0, prevTransactionValue: 0, volumeRate: 100, creditBalance: 0, sector: '기타' };
        
        // --- Pre-VETO 필터링 ---
        const txVal = m.transactionValue || 0;
        const prevTxVal = m.prevTransactionValue || 0;
        const credBal = m.creditBalance || 0;

        // 1. 신용잔고율 VETO
        const isVetoedByCredit = credBal > 6;
        if (!forceRecommend && isVetoedByCredit) {
            console.log(`🛡️ [Pre-VETO 필터링 제외] ${c.name} (${c.code}) - 신용잔고율 과다: ${credBal}%`);
            return null;
        }

        // 2. 데이터 불완전성 VETO (거래대금 0 또는 체결강도 0/100)
        const strVal = parseFloat(m.strength) || 0;
        if (!forceRecommend && (txVal === 0 || strVal === 0 || strVal === 100)) {
            console.log(`🛡️ [데이터 불완전 VETO 필터링 제외] ${c.name} (${c.code}) - 거래대금: ${txVal}원, 체결강도: ${strVal}% (미동기화 또는 데이터 부족)`);
            return null;
        }

        return {
            name: c.name,
            code: c.code,
            price: m.price || c.price,
            change: c.change,
            isSelfHealed: m.isSelfHealed || false,
            selfHealedReasons: m.selfHealedReasons || [],
            isDefaultFallback: m.isDefaultFallback || false,
            metrics: {
                disparity5: m.disparity5,
                disparity20: m.disparity20,
                strength: m.strength,
                shortRatio: m.shortRatio,
                investor1D: m.investor1D,
                investor5D: m.investor5D,
                investorMoney5D: m.investorMoney5D,
                atr: m.atr,
                atrPercent: m.atrPercent,
                transactionValue: m.transactionValue,
                creditBalance: m.creditBalance,
                sector: m.sector
            },
            scores: {
                strengthScore: 20,
                disparityScore: 10,
                shortScore: 30,
                supplyScore: 15,
                backtestPenalty: 0,
                financialScore: 0
            },
            totalScore: 75
        };
    }).filter(Boolean);

    console.log("\n--- Scored Candidates Output ---");
    console.log(JSON.stringify(scoredCandidates, null, 2));

    // Verify expectations:
    // 삼성전자: passed
    // SK하이닉스: excluded (strength = 100, transactionValue = 0)
    // 에코프로: excluded (strength = 100, transactionValue = 0)
    const passedSamsung = scoredCandidates.some(c => c.name === "삼성전자");
    const passedHynix = scoredCandidates.some(c => c.name === "SK하이닉스");
    const passedEcopro = scoredCandidates.some(c => c.name === "에코프로");

    if (passedSamsung && !passedHynix && !passedEcopro) {
        console.log("✅ VETO Logic Test Passed: Only complete active stocks passed the filter.");
    } else {
        console.error("❌ VETO Logic Test Failed! Check metrics filtering conditions.");
    }

    // Step 2: Test Badge Injection (force mock values to bypass VETO for verification of badges)
    console.log("\n--- Testing Badge Injection (Bypassing VETO manually) ---");
    const technicallyFiltered = [
        {
            name: "삼성전자",
            code: "005930",
            price: 75000,
            change: 1.5,
            isSelfHealed: false,
            selfHealedReasons: [],
            isDefaultFallback: false,
            metrics: { disparity20: 101, strength: 115, shortRatio: 1.5, atrPercent: 2.0, atr: 1500, investor5D: { foreign: 0, organ: 0, personal: 0 } },
            scores: { disparityScore: 10, strengthScore: 20, shortScore: 30, supplyScore: 15, financialScore: 0, backtestPenalty: 0 },
            totalScore: 75
        },
        {
            name: "SK하이닉스",
            code: "000660",
            price: 180000,
            change: 2.0,
            isSelfHealed: true,
            selfHealedReasons: ["strength_default_or_zero", "transactionValue_zero"],
            isDefaultFallback: false,
            metrics: { disparity20: 100, strength: 100, shortRatio: 2.0, atrPercent: 2.0, atr: 3600, investor5D: { foreign: 0, organ: 0, personal: 0 } },
            scores: { disparityScore: 10, strengthScore: 20, shortScore: 30, supplyScore: 15, financialScore: 0, backtestPenalty: 0 },
            totalScore: 75
        }
    ];

    const scoredCandidatesCtx = technicallyFiltered.map((c, idx) => {
        const excludeBadge = '';
        const intradayVetoBadge = '';
        const fitTagText = '';
        const antHellBadge = '';
        const penaltyBadge = '';
        const isSafe = true;
        const supplyText = '➡️ 수급: ...';
        const intradayText = '➡️ 장중 가집계 수급: ...';
        const finText = '➡️ 재무: ...';

        let integrityBadge = '';
        if (c.isSelfHealed || c.isDefaultFallback) {
            const reasons = c.selfHealedReasons && c.selfHealedReasons.length > 0 ? c.selfHealedReasons.join(', ') : '기본값 폴백';
            integrityBadge = ` ⚠️ [데이터 보정됨 - 사유: ${reasons}]`;
        }

        return `[${idx + 1}위] ${c.name} (${c.code})${excludeBadge}${intradayVetoBadge}${fitTagText}${antHellBadge}${penaltyBadge}${integrityBadge} - 퀀트 종합점수: ${c.totalScore}점 / 100점`;
    }).join('\n\n');

    console.log(scoredCandidatesCtx);

    if (scoredCandidatesCtx.includes("⚠️ [데이터 보정됨 - 사유: strength_default_or_zero, transactionValue_zero]")) {
        console.log("✅ Badge Injection Test Passed: Warning badges successfully formatted.");
    } else {
        console.error("❌ Badge Injection Test Failed! Warning badge missing or incorrect.");
    }
}

runDiagnostic();
