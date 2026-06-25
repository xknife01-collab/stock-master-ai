import dotenv from 'dotenv';
dotenv.config();

// 간단한 시뮬레이션용 데이터 및 로직 검증 함수
async function runSimulation() {
    console.log("=== 📡 AI 스코어링 및 VETO 완화 시뮬레이션 시작 ===");

    // Mock candidates 데이터
    const mockCandidates = [
        {
            name: "하나마이크론",
            code: "086520",
            change: "3.5",
            metrics: {
                strength: "91.5", // 95% 미만으로 원래라면 체결강도 VETO 대상
                strengthAcceleration: 7.2, // +5%p 이상으로 VETO 유예 조건 충족
                disparity5: "103.2",
                disparity1: "101.5",
                disparity20: "100.8",
                shortRatio: "4.5",
                creditBalance: "2.3",
                investor1D: { foreign: 15000, organ: 20000, personal: -35000 },
                investor5D: { foreign: -50000, organ: -20000, personal: 70000 },
                investorMoney5D: { foreign: -15, organ: -6, personal: 21 },
                price: 15000,
                transactionValue: 12000000000, // 120억원 (10억 이상)
                volumeRate: 250,
                maAlignment: "정배열"
            },
            memberTrend: {
                foreignBuyVolume: 50000,
                foreignSellVolume: 10000,
                foreignNetBuy: 40000 // 4만주 * 15000원 = 6억원 순매수
            },
            largeTrade: {
                totalLargeValue: 3500000000,
                buyLargeValue: 2800000000,
                sellLargeValue: 700000000,
                largeRatio: 0.35 // 35%
            }
        },
        {
            name: "일반탈락주",
            code: "999999",
            change: "-2.0",
            metrics: {
                strength: "88.0", // 90% 미만으로 VETO 대상
                strengthAcceleration: 2.1, // 가속도 부족
                disparity5: "101.2",
                disparity1: "98.5",
                disparity20: "99.0",
                shortRatio: "14.5", // 공매도 높음
                creditBalance: "1.2",
                investor1D: { foreign: -10000, organ: -5000, personal: 15000 },
                investor5D: { foreign: -20000, organ: -10000, personal: 30000 },
                investorMoney5D: { foreign: -5, organ: -3, personal: 8 },
                price: 10000,
                transactionValue: 500000000, // 5억원 (10억 미만 -> VETO 대상)
                volumeRate: 80,
                maAlignment: "역배열"
            },
            memberTrend: {
                foreignBuyVolume: 1000,
                foreignSellVolume: 5000,
                foreignNetBuy: -4000
            },
            largeTrade: {
                totalLargeValue: 0,
                buyLargeValue: 0,
                sellLargeValue: 0,
                largeRatio: 0
            }
        }
    ];

    // routes/aiApi.js 의 로직과 100% 동일하게 복제하여 계산
    for (const c of mockCandidates) {
        console.log(`\n--------------------------------------------`);
        console.log(`🔎 [분석 대상 종목] ${c.name} (${c.code})`);

        const m = c.metrics;
        const txVal = m.transactionValue;
        const credBal = parseFloat(m.creditBalance);
        const forceRecommend = false;
        const isSafe = false; // 일반 모드
        const isBullMarket = false;

        // 1. 신용잔고 VETO
        if (credBal > 6) {
            console.log(`❌ [VETO] 신용잔고율 과다: ${credBal}%`);
            continue;
        }

        // 2. 데이터 불완전성 VETO
        const strVal = parseFloat(m.strength) || 0;
        if (txVal === 0 || strVal === 0 || strVal === 100) {
            console.log(`❌ [VETO] 데이터 불완전`);
            continue;
        }

        // 3. 저유동성 VETO
        if (txVal < 1000000000) {
            console.log(`❌ [VETO] 저유동성: ${(txVal / 100000000).toFixed(2)}억원 (기준 10억 미만)`);
            continue;
        }

        // 스코어링 연산
        let strengthScore = 0;
        if (strVal >= 120) strengthScore = 30;
        else if (strVal >= 108) strengthScore = 22;
        else if (strVal >= 100) strengthScore = 15;
        else if (strVal >= 90) strengthScore = -10;
        else if (strVal >= 80) strengthScore = -25;
        else strengthScore = -50;

        let disparityScore = 0;
        const disp5 = parseFloat(m.disparity5);
        const disp1 = parseFloat(m.disparity1);
        const inv1D = m.investor1D;
        const isDumping = inv1D.foreign < 0 && inv1D.organ < 0;

        if (disp5 >= 100 && disp1 >= 100) disparityScore = 10;
        else disparityScore = -5;

        let shortScore = 0;
        const sr = parseFloat(m.shortRatio);
        if (sr < 5) shortScore = 5;
        else shortScore = -10;

        // 4. 수급 점수 및 골든크로스
        let supplyScore = 15; // 임시 기본점수
        let goldenCrossBonus = 0;
        const inv5D = m.investor5D;
        const isPrevSelling = inv5D.foreign < 0 || inv5D.organ < 0;
        const isTodayBuying = inv1D.foreign > 0 && inv1D.organ > 0;
        const isSupplyGoldenCross = isPrevSelling && isTodayBuying;
        if (isSupplyGoldenCross && strVal >= 95) {
            supplyScore = 35;
            goldenCrossBonus = 25;
        }

        // 8. 거래대금 점수
        let moneyInflowScore = 0;
        const txValEok = txVal / 100000000;
        if (txValEok >= 100) moneyInflowScore += 3;
        if (m.volumeRate >= 200) moneyInflowScore += 5;

        // 9. 외국계 창구 실시간 순매수 급증 점수
        let memberTrendScore = 0;
        const netFwdBuy = c.memberTrend?.foreignNetBuy || 0;
        const netFwdBuyMoney = Math.round((netFwdBuy * m.price) / 100000000);
        if (netFwdBuyMoney >= 10) memberTrendScore = 10;
        else if (netFwdBuyMoney >= 5) memberTrendScore = 7;
        else if (netFwdBuyMoney >= 1) memberTrendScore = 4;
        else if (netFwdBuyMoney > 0) memberTrendScore = 2;

        // 10. 대형 체결 실시간 감지 점수
        let largeTradeScore = 0;
        const largeRatio = c.largeTrade?.largeRatio || 0;
        if (largeRatio >= 0.3) largeTradeScore += 5;
        else if (largeRatio >= 0.15) largeTradeScore += 3;
        const buyLargeVal = c.largeTrade?.buyLargeValue || 0;
        const sellLargeVal = c.largeTrade?.sellLargeValue || 0;
        if (buyLargeVal > sellLargeVal * 1.5 && buyLargeVal > 0) {
            largeTradeScore += 3;
        }

        // 11. 체결강도 가속도 점수
        let strengthAccScore = 0;
        const strengthAcc = m.strengthAcceleration || 0;
        if (strengthAcc >= 10) strengthAccScore = 10;
        else if (strengthAcc >= 5) strengthAccScore = 5;

        // 총점 계산
        const rawTotalScore = strengthScore + disparityScore + shortScore + supplyScore + moneyInflowScore + goldenCrossBonus + memberTrendScore + largeTradeScore + strengthAccScore;
        const totalScore = rawTotalScore; // 백테스트 페널티 제외 단순 비교

        // VETO 여부 판정
        let isVetoed = false;
        const vetoReasons = [];

        // 체결강도 절대 약세 VETO 기준
        const minStrengthRequired = 95; // 일반 모드 기준 95%
        const isStrengthVetoOverridden = strengthAcc >= 5 && strVal >= 90;

        if (strVal < minStrengthRequired && !isStrengthVetoOverridden) {
            isVetoed = true;
            vetoReasons.push(`체결강도 약세 감지 (체결강도: ${strVal}% < 기준: ${minStrengthRequired}%)`);
        } else if (isStrengthVetoOverridden && strVal < minStrengthRequired) {
            console.log(`✨ [VETO Override 감지] 체결강도가 기준(${minStrengthRequired}%)보다 낮은 ${strVal}%이나, 체결강도 가속도(+${strengthAcc}%p)가 감지되어 VETO 적용 유예.`);
        }

        // 고이격 VETO
        const limitDisp5 = 108;
        if (disp5 > limitDisp5) {
            isVetoed = true;
            vetoReasons.push(`5일 이격도 과열 (${disp5}%)`);
        }

        const shouldBypassTrends = (strengthAcc >= 5 && !isDumping); // 가속도 돌입 시 트렌드 VETO 바이패스
        const isDownwardAlignment = m.maAlignment.includes("역배열");

        if (!shouldBypassTrends && isDownwardAlignment) {
            isVetoed = true;
            vetoReasons.push(`역배열 하락 추세 종목 제외`);
        } else if (shouldBypassTrends && isDownwardAlignment) {
            console.log(`✨ [VETO Override 감지] 역배열이나 체결강도 가속도(+${strengthAcc}%p) 및 수급 유지로 인해 VETO 적용 유예.`);
        }

        console.log(`- 체결강도 점수: ${strengthScore}점`);
        console.log(`- 외국계 창구 순매수 보너스: ${memberTrendScore}점 (순매수액: ${netFwdBuyMoney}억원)`);
        console.log(`- 대형 체결(블록오더) 보너스: ${largeTradeScore}점 (비중: ${(largeRatio*100).toFixed(1)}%)`);
        console.log(`- 체결강도 가속도 보너스: ${strengthAccScore}점 (가속도: +${strengthAcc}%p)`);
        console.log(`=> 퀀트 종합 총점: ${totalScore}점`);
        console.log(`=> 최종 VETO 여부: ${isVetoed ? "🔴 VETO 탈락" : "🟢 VETO 통과 (추천 대상)"}`);
        if (isVetoed) {
            console.log(`   (탈락 사유: ${vetoReasons.join(' | ')})`);
        }
    }
}

runSimulation();
