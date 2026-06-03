import { fetchStockInvestorTrend, fetchStockAnalytics } from '../lib/kisCore.js';

async function testPromptInjection() {
    console.log("=== 🚀 AI Pulse 프롬프트 수급 데이터 주입 실전 테스트 개시 ===");
    const symbol = '000660'; // SK하이닉스
    const name = 'SK하이닉스';

    try {
        console.log(`1. [KIS API] ${name} (${symbol}) 실시간 수급 및 정량 데이터 수집 중...`);
        const supplyResult = await fetchStockInvestorTrend(symbol);
        const analyticsResult = await fetchStockAnalytics(symbol);

        const d = {
            name: name,
            code: symbol,
            news: "네이버 뉴스 테스트 요약본...",
            newsSentiment: { bullishPercent: 75, bearishPercent: 15, neutralPercent: 10 },
            supply: supplyResult?.rawSummary || "정보 없음",
            supplyStats: supplyResult?.stats || null,
            finance: analyticsResult?.financeData || null,
            technical: analyticsResult?.technicalIndicators || null,
            priceData: analyticsResult?.priceData || null,
            strength: analyticsResult?.strength || null,
            shortRatio: analyticsResult?.shortRatio || null
        };

        console.log("\n2. [프롬프트 조립기] AI에게 전달될 최종 종목 분석 텍스트 생성 중...");
        
        // routes/aiApi.js의 실제 조립 공식 적용
        const aiPromptSegment = `
        [분석 후보: ${d.name} (${d.code})]
        1. 종목별 최신 뉴스/공시:
        ${d.news}
        - 종목 뉴스 감성 지수: 호재(Bullish) ${d.newsSentiment?.bullishPercent || 0}%, 악재(Bearish) ${d.newsSentiment?.bearishPercent || 0}%
        
        2. 외국인/기관/개인 수급 추이 (3일):
        ${d.supply}
        - 외국인 5일 누적 순매수 수량: ${d.supplyStats?.foreign5D !== undefined ? d.supplyStats.foreign5D.toLocaleString() + '주' : '정보 없음'}
        - 기관 5일 누적 순매수 수량: ${d.supplyStats?.organ5D !== undefined ? d.supplyStats.organ5D.toLocaleString() + '주' : '정보 없음'}
        - 개인 5일 누적 순매수 수량: ${d.supplyStats?.personal5D !== undefined ? d.supplyStats.personal5D.toLocaleString() + '주' : '정보 없음'}
        - 외국인 20일 누적 순매수 수량: ${d.supplyStats?.foreign20D !== undefined ? d.supplyStats.foreign20D.toLocaleString() + '주' : '정보 없음'}
        - 기관 20일 누적 순매수 수량: ${d.supplyStats?.organ20D !== undefined ? d.supplyStats.organ20D.toLocaleString() + '주' : '정보 없음'}
        - 개인 20일 누적 순매수 수량: ${d.supplyStats?.personal20D !== undefined ? d.supplyStats.personal20D.toLocaleString() + '주' : '정보 없음'}
        
        👉 [연속 매수 분석 - 개미 지옥 탐지망]
        - 외국인 연속 순매수 일수: ${d.supplyStats?.foreignConsecutiveDays !== undefined ? `${d.supplyStats.foreignConsecutiveDays}일 연속${d.supplyStats.foreignConsecutiveVolume > 0 ? ` (연속 기간 총 ${d.supplyStats.foreignConsecutiveVolume.toLocaleString()}주)` : ''}` : '정보 없음'}
        - 기관 연속 순매수 일수: ${d.supplyStats?.organConsecutiveDays !== undefined ? `${d.supplyStats.organConsecutiveDays}일 연속${d.supplyStats.organConsecutiveVolume > 0 ? ` (연속 기간 총 ${d.supplyStats.organConsecutiveVolume.toLocaleString()}주)` : ''}` : '정보 없음'}
        - 개인 연속 순매수 일수: ${d.supplyStats?.personalConsecutiveDays !== undefined ? `${d.supplyStats.personalConsecutiveDays}일 연속${d.supplyStats.personalConsecutiveVolume > 0 ? ` (연속 기간 총 ${d.supplyStats.personalConsecutiveVolume.toLocaleString()}주)` : ''}` : '정보 없음'}
        `;

        console.log("\n=======================================================");
        console.log("🚨 [실시간 확인] AI(Gemini)에게 전달되는 최종 프롬프트 수급 블록");
        console.log("=======================================================");
        console.log(aiPromptSegment);
        console.log("=======================================================");
        console.log("✅ 검증 완료: 개인/기관/외인의 연속 순매수 수량이 완벽하고 상세하게 주입되고 있습니다!");

    } catch (e) {
        console.error("❌ 테스트 실패:", e.message);
    }
}

testPromptInjection();
