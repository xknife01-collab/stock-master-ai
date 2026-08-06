import fs from 'fs';
import dotenv from 'dotenv';
import supabase from '../lib/supabaseClient.js';
dotenv.config();

function analyzeCelltrion(c) {
    if (!c) return;
    const disp5 = parseFloat(c.metrics?.disparity5) || 100;
    const strengthAcc = parseFloat(c.metrics?.strengthAcceleration) || 0;
    const strength = parseFloat(c.metrics?.strength) || 100;
    const largeRatio = parseFloat(c.metrics?.largeTradeRatio) || 0;
    const netForeignMoney = parseFloat(c.metrics?.netForeignWindowBuyMoney) || 0;
    const largeTradeScore = parseFloat(c.scores?.largeTradeScore) || 0;
    const transactionValue = parseFloat(c.metrics?.transactionValue) || 0;

    const dailyTradeValue亿 = transactionValue / 100000000;
    const dynamicForeignThreshold = -Math.max(3.0, dailyTradeValue亿 * 0.01);

    // Refined rules
    const isDisp5Risk = disp5 < 98.5;
    const isAccRisk = strengthAcc <= -10 && strength < 90;
    const isBlockDumpRisk = largeRatio >= 0.20 && largeTradeScore < 0;
    const isForeignExitRisk = netForeignMoney <= dynamicForeignThreshold;

    const activeRisks = [];
    if (isDisp5Risk) activeRisks.push(`5일선 이탈 (5일 이격도: ${disp5}%)`);
    if (isAccRisk) activeRisks.push(`체결가속도 위험 (체결가속도: ${strengthAcc}%p, 체결강도: ${strength}%)`);
    if (isBlockDumpRisk) activeRisks.push(`대형 매도우위 (대형비중: ${(largeRatio*100).toFixed(1)}%, 대형체결점수: ${largeTradeScore})`);
    if (isForeignExitRisk) activeRisks.push(`외국계 이탈 (순매수액: ${netForeignMoney}억, 동적 임계치: ${dynamicForeignThreshold.toFixed(1)}억)`);

    const activeRiskCount = activeRisks.length;
    const isImmediateSell = activeRiskCount >= 2;

    console.log(`\n================ ${c.name} (${c.code}) 분석 ================`);
    console.log(`- 종합점수: ${c.totalScore}점`);
    console.log(`- 거래대금: ${dailyTradeValue亿.toFixed(1)}억 원`);
    console.log(`- 외국계 동적 위험 기준: ${dynamicForeignThreshold.toFixed(1)}억 원 이하 (거래대금의 1% 반영)`);
    console.log(`- VETO 여부: ${c.isVetoed ? '배제됨 (' + c.vetoReason + ')' : '배제되지 않음 (진입 유효)'}`);
    console.log(`- 4대 실시간 수급 리스크 계기판 값:`);
    console.log(`  * 5일 이격도: ${disp5}% (이탈 기준 < 98.5%) -> ${isDisp5Risk ? '⚠️ 위험' : '✅ 정상'}`);
    console.log(`  * 체결 가속도: ${strengthAcc}%p (감속 기준 <= -10%p 및 체결강도 < 90%) -> ${isAccRisk ? '⚠️ 위험' : '✅ 정상'}`);
    console.log(`  * 블록오더 비중: ${(largeRatio*100).toFixed(1)}% (대형매도우위 기준 >= 20% 이면서 대형체결점수 < 0) -> ${isBlockDumpRisk ? '⚠️ 위험' : '✅ 정상'}`);
    console.log(`  * 외국계 창구 순매수액: ${netForeignMoney}억원 (이탈 기준 <= ${dynamicForeignThreshold.toFixed(1)}억) -> ${isForeignExitRisk ? '⚠️ 위험' : '✅ 정상'}`);
    console.log(`- 활성화된 리스크 요인 (${activeRiskCount}개):`);
    activeRisks.forEach(r => console.log(`  => ${r}`));
    console.log(`- 즉각 매도(조기 청산 권고) 대상 여부: ${isImmediateSell ? '🚨 즉각 매도 대상!' : '🟢 정상 (보유/진입 가능)'}`);
}

async function run() {
    console.log("Checking local ai_cache.json...");
    try {
        if (fs.existsSync('ai_cache.json')) {
            const fileData = fs.readFileSync('ai_cache.json', 'utf8');
            const parsed = JSON.parse(fileData);
            const sig = parsed.data?.pulse?.data || parsed.pulse?.data || parsed.pulse || parsed.data || parsed.prediction || parsed;
            const candidates = sig?.candidates || [];
            const c = candidates.find(item => item.name.includes('셀트리온') || item.code === '068270');
            if (c) {
                console.log("Found in local ai_cache.json:");
                analyzeCelltrion(c);
            } else {
                console.log("Celltrion NOT found in local ai_cache.json candidates.");
            }
        }
    } catch (err) {
        console.error("Error reading local cache:", err.message);
    }

    console.log("\nChecking Supabase database stock_detail_cache directly...");
    try {
        const { data, error } = await supabase
            .from('stock_detail_cache')
            .select('*')
            .eq('symbol', '068270')
            .maybeSingle();

        if (error) {
            console.error("Error querying stock_detail_cache:", error.message);
        } else if (data) {
            console.log("Found row in stock_detail_cache:");
            const c = {
                code: data.symbol,
                name: '셀트리온',
                isVetoed: data.isVetoed || false,
                totalScore: data.totalScore || 0,
                metrics: data.advanced || {},
                scores: data.scores || {}
            };
            analyzeCelltrion(c);
        } else {
            console.log("No row for Celltrion found in stock_detail_cache.");
        }
    } catch (err) {
        console.error("Error querying stock_detail_cache table:", err.message);
    }
}

run();
