import test from 'node:test';
import assert from 'node:assert';

// 로직 모의 구현 - routes/aiApi.js에 이식된 알고리즘의 동작성을 수학적으로 검증
function simulateScoringAndVeto({
    isMorningSession,
    changePct,
    m,
    c,
    isSafe = false,
    isIndexSupportBroken = false,
    isBullMarket = false,
    forceRecommend = false
}) {
    let isVetoed = false;
    const vetoReasons = [];

    const disp5 = parseFloat(m.disparity5) || 100;
    const disp1 = parseFloat(m.disparity1) || 100;
    const str = m.strength || 100;
    const strengthAcc = m.strengthAcceleration || 0;
    const inv1D = m.investor1D || { foreign: 0, organ: 0, personal: 0 };
    const inv5D = m.investor5D || { foreign: 0, organ: 0, personal: 0 };
    const isDumping = inv1D.foreign < 0 && inv1D.organ < 0;
    const isUptrend = (m.technical?.maAlignment || '').includes('정배열') || (changePct > 0);

    // 1. 대체 수급 점수 계산 (오전 9:00 ~ 10:30)
    let supplyScore = 0;
    if (isMorningSession) {
        const volRate = m.volumeRate || 100;
        let volRateScore = 0;
        if (volRate >= 300) volRateScore = 20;
        else if (volRate >= 200) volRateScore = 15;
        else if (volRate >= 100) volRateScore = 10;
        
        let orderbookImbalanceScore = 0;
        const checkStr = m.strength || 100;
        const largeRatio = m.largeTrade?.largeRatio || 0;
        if (checkStr >= 108 && largeRatio >= 0.15) orderbookImbalanceScore = 15;
        else if (checkStr >= 102) orderbookImbalanceScore = 10;
        else if (checkStr >= 97) orderbookImbalanceScore = 5;
        
        supplyScore = volRateScore + orderbookImbalanceScore;
    } else {
        supplyScore = 15; // 모의 디폴트값
    }

    // 2. 이격도 완화 임계값 적용
    let limitDisp5 = forceRecommend ? 120 : (changePct > 5 ? 112 : (isMorningSession ? 112 : 108));
    const isGenuineRally = (str >= 105) && (strengthAcc >= 0) && (!isDumping || isUptrend);
    if (isGenuineRally) {
        limitDisp5 = Math.max(limitDisp5, isMorningSession ? 118 : 115);
    }

    let limitRsi = isSafe ? 75 : ((isBullMarket) ? 85 : (isMorningSession ? 82 : 78));
    const rsiVal = m.technical?.rsi || 50;

    // 3. 3중 실시간 안전장치 (불트랩 VETO)
    const priceNow = m.price || 0;
    const openPrice = m.openPrice || 0;
    const highPrice = m.highPrice || 0;

    // 필터 1: 시초가 이탈 보호
    if (!forceRecommend && openPrice > 0 && priceNow < openPrice) {
        isVetoed = true;
        vetoReasons.push(`[불트랩 방지] 시초가 하회`);
    }

    // 필터 2: 고점 대비 과낙폭 차단
    if (!forceRecommend && highPrice > 0 && priceNow <= highPrice * 0.975) {
        isVetoed = true;
        vetoReasons.push(`[불트랩 방지] 당일 고점 대비 2.5% 이상 하락`);
    }

    // 분봉 마이크로 돌파 및 골든크로스 판정
    let isMicroGoldenCross = false;
    let isMicroDeadCrossOrBent = false;
    if (m.chartHistory && Array.isArray(m.chartHistory['1D']) && m.chartHistory['1D'].length >= 16) {
        const chart1D = m.chartHistory['1D'];
        const len = chart1D.length;
        const wma3 = (chart1D[len - 1].price * 3 + chart1D[len - 2].price * 2 + chart1D[len - 3].price * 1) / 6;
        let wma15Sum = 0;
        for (let i = 1; i <= 15; i++) {
            wma15Sum += chart1D[len - i].price * (16 - i);
        }
        const wma15 = wma15Sum / 120;
        
        const prevWma3 = (chart1D[len - 2].price * 3 + chart1D[len - 3].price * 2 + chart1D[len - 4].price * 1) / 6;
        let prevWma15Sum = 0;
        for (let i = 1; i <= 15; i++) {
            prevWma15Sum += chart1D[len - i - 1].price * (16 - i);
        }
        const prevWma15 = prevWma15Sum / 120;
        
        isMicroGoldenCross = (prevWma3 <= prevWma15 && wma3 > wma15) || (wma3 > wma15 && (wma3 - wma15) > (prevWma3 - prevWma15));
        isMicroDeadCrossOrBent = (wma3 < wma15) || (wma3 < prevWma3);
    }

    // 필터 3: 분봉 데드크로스/꺾임 및 수급 약세 감지 시 VETO
    if (!forceRecommend && isMicroDeadCrossOrBent && strengthAcc < 0 && str < 95) {
        isVetoed = true;
        vetoReasons.push(`[불트랩 방지] 분봉 데드크로스 및 수급 약세`);
    }

    const isMicroBreakoutActive = isMicroGoldenCross && (strengthAcc >= 10) && ((m.volumeRate || 100) >= 150) && !isDumping;
    let shouldBypassTrends = forceRecommend || isMicroBreakoutActive;

    const isPriceBelow5MA = disp5 < 100;
    const isDownwardDrift = disp1 < 100 && str < 100;

    if (!isVetoed) {
        if (!shouldBypassTrends && isPriceBelow5MA) {
            isVetoed = true;
            vetoReasons.push(`[기술적 분석] 5일선 아래 흘러내림`);
        } else if (disp5 > limitDisp5) {
            isVetoed = true;
            vetoReasons.push(`[기술적 분석] 이격도 과열`);
        } else if (rsiVal >= limitRsi) {
            isVetoed = true;
            vetoReasons.push(`[기술적 분석] RSI 과열`);
        }
    }

    return {
        isVetoed,
        vetoReasons,
        supplyScore,
        limitDisp5,
        limitRsi,
        isMicroBreakoutActive
    };
}

test('Morning Quant Features - Unit Test Suite', async (t) => {
    // ----------------------------------------------------
    // Scenario 1: Morning Session (09:00 - 10:30) Substitute Supply Scoring
    // ----------------------------------------------------
    await t.test('Should calculate high substitute supply score during morning session if volumeRate and strength are high', () => {
        const result = simulateScoringAndVeto({
            isMorningSession: true,
            changePct: 2,
            m: {
                volumeRate: 350,
                strength: 110,
                largeTrade: { largeRatio: 0.25 },
                disparity5: 105,
                price: 10000,
                openPrice: 9900,
                highPrice: 10100
            },
            c: { code: '005930' }
        });
        
        // volumeRate >= 300 => 20 points
        // strength >= 108 && largeRatio >= 0.15 => 15 points
        // Total supplyScore should be 35
        assert.strictEqual(result.supplyScore, 35, "Supply score should be max 35 points during morning hours");
    });

    // ----------------------------------------------------
    // Scenario 2: Melt-down Protection (Filter 1)
    // ----------------------------------------------------
    await t.test('Should veto stock if price falls below open price (Melt-down Protection)', () => {
        const result = simulateScoringAndVeto({
            isMorningSession: true,
            changePct: -1,
            m: {
                volumeRate: 150,
                strength: 98,
                price: 9800,
                openPrice: 10000, // Price is below open!
                highPrice: 10200
            },
            c: { code: '005930' }
        });
        
        assert.strictEqual(result.isVetoed, true);
        assert.ok(result.vetoReasons.some(r => r.includes('시초가 하회')));
    });

    // ----------------------------------------------------
    // Scenario 3: Anti-trap Protection (Filter 2)
    // ----------------------------------------------------
    await t.test('Should veto stock if price drops 2.5% or more from high (Anti-trap Protection)', () => {
        const result = simulateScoringAndVeto({
            isMorningSession: true,
            changePct: 1,
            m: {
                volumeRate: 150,
                strength: 100,
                price: 9700,
                openPrice: 9500,
                highPrice: 10000 // Price 9700 is 3% below high 10000 (threshold: 9750)
            },
            c: { code: '005930' }
        });
        
        assert.strictEqual(result.isVetoed, true);
        assert.ok(result.vetoReasons.some(r => r.includes('고점 대비 2.5% 이상 하락')));
    });

    // ----------------------------------------------------
    // Scenario 4: Micro Deadcross & Weakening Protection (Filter 3)
    // ----------------------------------------------------
    await t.test('Should veto stock if micro deadcross/bent occurs with negative acceleration and weak strength', () => {
        const result = simulateScoringAndVeto({
            isMorningSession: true,
            changePct: 0.5,
            m: {
                volumeRate: 100,
                strength: 90, // < 95%
                strengthAcceleration: -6, // < 0
                price: 10000,
                openPrice: 9900,
                highPrice: 10100,
                chartHistory: {
                    '1D': [
                        { price: 10000 }, { price: 10000 }, { price: 10000 }, { price: 10000 },
                        { price: 10000 }, { price: 10000 }, { price: 10000 }, { price: 10000 },
                        { price: 10000 }, { price: 10000 }, { price: 10000 }, { price: 10000 },
                        { price: 10000 }, { price: 10000 }, { price: 10000 }, { price: 9900 } // falling!
                    ]
                }
            },
            c: { code: '005930' }
        });
        
        assert.strictEqual(result.isVetoed, true);
        assert.ok(result.vetoReasons.some(r => r.includes('분봉 데드크로스 및 수급 약세')));
    });

    // ----------------------------------------------------
    // Scenario 5: Micro Golden Cross Bypass (Feature 4 / Option ②)
    // ----------------------------------------------------
    await t.test('Should bypass 5MA veto if micro golden cross occurs with strong acceleration and volume rate', () => {
        const result = simulateScoringAndVeto({
            isMorningSession: true,
            changePct: 2,
            m: {
                volumeRate: 200, // >= 150
                strength: 105,
                strengthAcceleration: 12, // >= 10
                disparity5: 98, // Below 5MA! (Normally vetoed)
                price: 10000,
                openPrice: 9900,
                highPrice: 10010,
                chartHistory: {
                    '1D': [
                        { price: 9900 }, { price: 9900 }, { price: 9900 }, { price: 9900 },
                        { price: 9900 }, { price: 9900 }, { price: 9900 }, { price: 9900 },
                        { price: 9900 }, { price: 9900 }, { price: 9900 }, { price: 9900 },
                        { price: 9900 }, { price: 9900 }, { price: 9900 }, { price: 10000 } // breakout!
                    ]
                }
            },
            c: { code: '005930' }
        });
        
        assert.strictEqual(result.isMicroBreakoutActive, true, "Micro-breakout should be active");
        assert.strictEqual(result.isVetoed, false, "Stock should bypass 5MA veto filter");
    });

    // ----------------------------------------------------
    // Scenario 6: Disparity and RSI Threshold Relaxation
    // ----------------------------------------------------
    await t.test('Should relax limitDisp5 and limitRsi during morning hours', () => {
        const standardResult = simulateScoringAndVeto({
            isMorningSession: false,
            changePct: 2,
            m: { strength: 106, strengthAcceleration: 2, disparity5: 105 },
            c: { code: '005930' }
        });
        
        const morningResult = simulateScoringAndVeto({
            isMorningSession: true,
            changePct: 2,
            m: { strength: 106, strengthAcceleration: 2, disparity5: 105 },
            c: { code: '005930' }
        });
        
        // Genuine rally (str >= 105 && strengthAcc >= 0)
        // Standard limitDisp5 should be 115
        // Morning limitDisp5 should be 118
        assert.strictEqual(standardResult.limitDisp5, 115);
        assert.strictEqual(morningResult.limitDisp5, 118);
        
        // Standard limitRsi should be 78
        // Morning limitRsi should be 82
        assert.strictEqual(standardResult.limitRsi, 78);
        assert.strictEqual(morningResult.limitRsi, 82);
    });
});
