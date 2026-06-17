import dotenv from 'dotenv';
dotenv.config();

import supabase from '../lib/supabaseClient.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function printScores() {
    // 1. Get stock master mappings to convert codes to names
    const { data: masterData } = await supabase.from('stock_master_map').select('*');
    const masterMap = {};
    masterData.forEach(d => {
        masterMap[d.code] = d.name;
    });

    // 2. Load all cached details from Supabase stock_detail_cache
    const { data: cacheRows } = await supabase.from('stock_detail_cache').select('*');
    
    let outputText = "=== 안정기 모드 (Normal Mode) 기준 퀀트 점수 분석 ===\n\n";
    
    const results = cacheRows.map(row => {
        const symbol = row.symbol;
        const name = masterMap[symbol] || symbol;
        const adv = row.advanced || {};
        const fund = row.fundamental || {};

        const disparity20 = parseFloat(adv.disparity20) || 100;
        const strength = parseFloat(adv.strength) || 100;
        const volumeRate = parseFloat(adv.volumeRate) || 100;
        const shortRatio = parseFloat(adv.shortRatio) || 0;
        const creditBalance = parseFloat(adv.creditBalance) || 0;
        const transactionValue = parseFloat(adv.transactionValue) || 0;
        const prevTransactionValue = parseFloat(adv.prevTransactionValue) || 0;

        const roe = fund.roe !== null ? parseFloat(fund.roe) : null;
        const per = fund.per !== null ? parseFloat(fund.per) : null;
        const pbr = fund.pbr !== null ? parseFloat(fund.pbr) : null;
        const debtRatio = fund.debtRatio !== null ? parseFloat(fund.debtRatio) : null;

        // VETO Rules
        const isVetoedByCredit = creditBalance > 6;
        const isVetoedByLiquidity = false; // 거래대금 VETO 제거
        const pbrThreshold = (roe !== null && roe >= 20) ? 20 : 15;
        const isVetoedByFinance = (roe !== null && roe < 0) || (debtRatio !== null && debtRatio >= 200) || (pbr !== null && pbr >= pbrThreshold);

        // Scoring: 체결강도 순수 점수 (Max 40점)
        let strengthScore = 0;
        if (strength >= 120) strengthScore = 40;
        else if (strength >= 105) strengthScore = 30;
        else if (strength >= 100) strengthScore = 20;
        else if (strength >= 90) strengthScore = 10;
        else strengthScore = 0;

        let disparityScore = 0;
        if (disparity20 >= 98 && disparity20 <= 104) disparityScore = 10;
        else if (disparity20 > 104 && disparity20 <= 106) disparityScore = 7;
        else if (disparity20 < 98) disparityScore = 4;
        else if (disparity20 > 106 && disparity20 < 107) disparityScore = 0;
        else disparityScore = 0; // 과열 감점 페널티 제거 (0점 처리)

        let shortScore = 0;
        if (shortRatio < 5) shortScore = 10;
        else if (shortRatio >= 5 && shortRatio < 12) shortScore = 5;
        else if (shortRatio >= 12 && shortRatio < 15) shortScore = 0;
        else shortScore = -15;

        // Supply Score (Mock based on cache row data, max 40)
        let supplyScore = 20; // fallback
        if (adv.investor) {
            const f5 = adv.investor.foreign5D || 0;
            const o5 = adv.investor.organ5D || 0;
            if (f5 > 0 && o5 > 0) supplyScore = 40;
            else if (f5 > 0 || o5 > 0) supplyScore = 25;
            else if (f5 < 0 && o5 < 0) supplyScore = 8;
        }

        const totalScore = strengthScore + disparityScore + shortScore + supplyScore;

        return {
            name,
            symbol,
            strength,
            volumeRate,
            strengthScore,
            disparity20,
            disparityScore,
            shortRatio,
            shortScore,
            supplyScore,
            creditBalance,
            transactionValue,
            prevTransactionValue,
            pbr,
            debtRatio,
            roe,
            totalScore,
            isVetoedByCredit,
            isVetoedByLiquidity,
            isVetoedByFinance,
            vetoReason: isVetoedByCredit ? "신용잔고율 초과(>6%)" :
                        isVetoedByLiquidity ? "당일/전일 거래대금 미달(<50억)" :
                        isVetoedByFinance ? `재무 미달 (PBR:${pbr}배, 부채비율:${debtRatio}%, ROE:${roe}%)` : null
        };
    });

    // Sort by totalScore desc
    results.sort((a, b) => b.totalScore - a.totalScore);

    // Print top 40 non-vetoed candidates
    const nonVetoed = results.filter(c => !c.isVetoedByCredit && !c.isVetoedByLiquidity && !c.isVetoedByFinance);
    const top40 = nonVetoed.slice(0, 40);
    top40.forEach((c, idx) => {
        outputText += `[${idx+1}위] ${c.name} (${c.symbol}) - 총점: ${c.totalScore}점\n`;
        outputText += `  - 체결강도: ${c.strength}% / 거래량증가율: ${c.volumeRate}% (점수: ${c.strengthScore}점 / 40점)\n`;
        outputText += `  - 20일 이격도: ${c.disparity20}% (점수: ${c.disparityScore}점 / 20점)\n`;
        outputText += `  - 공매도 비중: ${c.shortRatio}% (점수: ${c.shortScore}점 / 10점)\n`;
        outputText += `  - 수급 점수: ${c.supplyScore}점 / 30점\n`;
        outputText += `  - 재무/신용/유동성 VETO 여부: ${c.vetoReason ? "❌ 탈락 - 사유: " + c.vetoReason : "✅ 합격"}\n`;
        outputText += `    (PBR: ${c.pbr}배 / 부채비율: ${c.debtRatio}% / 당일대금: ${Math.round(c.transactionValue/100000000)}억 / 전일대금: ${Math.round(c.prevTransactionValue/100000000)}억 / 거래량증가율: ${c.volumeRate}%)\n`;
        outputText += `--------------------------------------------------\n`;
    });

    fs.writeFileSync(path.join(__dirname, 'scores_output_clean.txt'), outputText, 'utf8');
    console.log("Successfully wrote clean scores report to scores_output_clean.txt!");

    // SK하이닉스(000660) 상세 추적 출력
    const hynixIndex = results.findIndex(c => c.symbol === '000660');
    if (hynixIndex !== -1) {
        const h = results[hynixIndex];
        console.log(`\n🔍 [SK하이닉스 검증 결과]`);
        console.log(`- 전체 순위: ${hynixIndex + 1}위`);
        console.log(`- 총점: ${h.totalScore}점`);
        console.log(`- 체결강도: ${h.strength}% (점수: ${h.strengthScore}점)`);
        console.log(`- 20일 이격도: ${h.disparity20}% (점수: ${h.disparityScore}점)`);
        console.log(`- 공매도 비중: ${h.shortRatio}% (점수: ${h.shortScore}점)`);
        console.log(`- 수급 점수: ${h.supplyScore}점`);
        console.log(`- VETO 사유: ${h.vetoReason || '없음 (✅ 합격)'}`);
    } else {
        console.log("\n❌ SK하이닉스(000660)를 결과 리스트에서 찾을 수 없습니다.");
    }

    // 삼성전자(005930) 상세 추적 출력
    const samsungIndex = results.findIndex(c => c.symbol === '005930');
    if (samsungIndex !== -1) {
        const s = results[samsungIndex];
        console.log(`\n🔍 [삼성전자 검증 결과]`);
        console.log(`- 전체 순위: ${samsungIndex + 1}위`);
        console.log(`- 총점: ${s.totalScore}점`);
        console.log(`- 체결강도: ${s.strength}% (점수: ${s.strengthScore}점)`);
        console.log(`- 20일 이격도: ${s.disparity20}% (점수: ${s.disparityScore}점)`);
        console.log(`- 공매도 비중: ${s.shortRatio}% (점수: ${s.shortScore}점)`);
        console.log(`- 수급 점수: ${s.supplyScore}점`);
        console.log(`- VETO 사유: ${s.vetoReason || '없음 (✅ 합격)'}`);
    } else {
        console.log("\n❌ 삼성전자(005930)를 결과 리스트에서 찾을 수 없습니다.");
    }
}

printScores();
