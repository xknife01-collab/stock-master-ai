import fs from 'fs';
import dotenv from 'dotenv';
import supabase from '../lib/supabaseClient.js';
dotenv.config();

function analyzeCandidate(c) {
    if (!c) return;
    const disp5 = parseFloat(c.metrics?.disparity5) || 100;
    const strengthAcc = parseFloat(c.metrics?.strengthAcceleration) || 0;
    const largeRatio = parseFloat(c.metrics?.largeTradeRatio) || 0;
    const netForeignMoney = parseFloat(c.metrics?.netForeignWindowBuyMoney) || 0;
    const largeTradeScore = parseFloat(c.scores?.largeTradeScore) || 0;

    const isDisp5Risk = disp5 < 100;
    const isAccRisk = strengthAcc <= -5;
    const isBlockDumpRisk = largeRatio >= 0.15 && largeTradeScore <= 0;
    const isForeignExitRisk = netForeignMoney < 0;

    const activeRisks = [];
    if (isDisp5Risk) activeRisks.push(`5일선 이탈 (5일 이격도: ${disp5}%)`);
    if (isAccRisk) activeRisks.push(`체결가속도 위험 (체결가속도: ${strengthAcc}%p)`);
    if (isBlockDumpRisk) activeRisks.push(`대형 매도우위 (대형비중: ${(largeRatio*100).toFixed(1)}%, 대형체결점수: ${largeTradeScore})`);
    if (isForeignExitRisk) activeRisks.push(`외국계 이탈 (순매수액: ${netForeignMoney}억)`);

    const activeRiskCount = activeRisks.length;
    const isImmediateSell = activeRiskCount >= 2;

    console.log(`\n================ ${c.name} (${c.code}) 분석 ================`);
    console.log(`- 종합점수: ${c.totalScore}점`);
    console.log(`- VETO 여부: ${c.isVetoed ? '배제됨 (' + c.vetoReason + ')' : '배제되지 않음 (진입 유효)'}`);
    console.log(`- 4대 실시간 수급 리스크 계기판 값:`);
    console.log(`  * 5일 이격도: ${disp5}% (이탈 기준 < 100%) -> ${isDisp5Risk ? '⚠️ 위험' : '✅ 정상'}`);
    console.log(`  * 체결 가속도: ${strengthAcc}%p (감속 기준 <= -5%p) -> ${isAccRisk ? '⚠️ 위험' : '✅ 정상'}`);
    console.log(`  * 블록오더 비중: ${(largeRatio*100).toFixed(1)}% (대형매도우위 기준 >= 15% 이면서 대형체결점수 <= 0) -> ${isBlockDumpRisk ? '⚠️ 위험' : '✅ 정상'}`);
    console.log(`  * 외국계 창구 순매수액: ${netForeignMoney}억원 (이탈 기준 < 0) -> ${isForeignExitRisk ? '⚠️ 위험' : '✅ 정상'}`);
    console.log(`- 활성화된 리스크 요인 (${activeRiskCount}개):`);
    activeRisks.forEach(r => console.log(`  => ${r}`));
    console.log(`- 즉각 매도(조기 청산 권고) 대상 여부: ${isImmediateSell ? '🚨 즉각 매도 대상!' : '🟢 정상 (보유/진입 가능)'}`);
}

async function run() {
    // 1. Check local ai_cache.json
    console.log("1. Checking local ai_cache.json...");
    try {
        if (fs.existsSync('ai_cache.json')) {
            const fileData = fs.readFileSync('ai_cache.json', 'utf8');
            const parsed = JSON.parse(fileData);
            const sig = parsed.data?.pulse?.data || parsed.pulse?.data || parsed.data || parsed.prediction || parsed;
            const candidates = sig?.candidates || [];
            const c = candidates.find(item => item.name.includes('주성') || item.code === '036930');
            if (c) {
                console.log("Found in local ai_cache.json:");
                analyzeCandidate(c);
            } else {
                console.log("Jusung Engineering NOT found in local ai_cache.json candidates.");
            }
        } else {
            console.log("Local ai_cache.json does not exist.");
        }
    } catch (err) {
        console.error("Error reading local cache:", err.message);
    }

    // 2. Check Supabase database cache
    console.log("\n2. Checking Supabase database stock_master_map...");
    try {
        const { data, error } = await supabase
            .from('stock_master_map')
            .select('*')
            .eq('name', '__ai_cache__')
            .maybeSingle();

        if (error) {
            console.error("Error fetching __ai_cache__ from DB:", error.message);
        } else if (data) {
            const parsed = JSON.parse(data.code);
            const sig = parsed.data?.pulse?.data || parsed.pulse?.data || parsed.data || parsed.prediction || parsed;
            const candidates = sig?.candidates || [];
            const c = candidates.find(item => item.name.includes('주성') || item.code === '036930');
            if (c) {
                console.log("Found in Supabase database __ai_cache__:");
                analyzeCandidate(c);
            } else {
                console.log("Jusung Engineering NOT found in DB __ai_cache__ candidates.");
            }
        } else {
            console.log("No __ai_cache__ row in DB.");
        }
    } catch (err) {
        console.error("Error querying DB:", err.message);
    }

    // 3. Check stock_detail_cache directly
    console.log("\n3. Checking Supabase stock_detail_cache table directly for '036930'...");
    try {
        const { data, error } = await supabase
            .from('stock_detail_cache')
            .select('*')
            .eq('symbol', '036930')
            .maybeSingle();

        if (error) {
            console.error("Error querying stock_detail_cache:", error.message);
        } else if (data) {
            console.log("Found row in stock_detail_cache:", {
                symbol: data.symbol,
                name: data.fundamental?.name || data.name,
                updated_at: data.updated_at
            });
            // Construct candidate-like object from stock_detail_cache row to run analysis
            const c = {
                code: data.symbol,
                name: data.fundamental?.name || '주성엔지니어링',
                isVetoed: false, // fallback
                totalScore: 0, // fallback
                metrics: data.advanced || {},
                scores: data.scores || {}
            };
            analyzeCandidate(c);
        } else {
            console.log("No row for '036930' found in stock_detail_cache.");
        }
    } catch (err) {
        console.error("Error querying stock_detail_cache table:", err.message);
    }
}

run();
