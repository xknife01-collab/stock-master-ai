import supabase from '../lib/supabaseClient.js';

async function diagnoseDoosan() {
    console.log("=== Doosan Enerbility (034020) AI Engine Scoring Diagnosis ===");
    try {
        const { data: row, error } = await supabase
            .from('stock_detail_cache')
            .select('*')
            .eq('symbol', '034020')
            .single();

        if (error || !row) {
            console.error("Failed to fetch cache or no cache:", error);
            return;
        }

        const m = {
            price: row.fundamental?.price || 0,
            disparity1: parseFloat(row.advanced?.disparity1) || 100,
            disparity5: parseFloat(row.advanced?.disparity5) || 100,
            disparity20: parseFloat(row.advanced?.disparity20) || 100,
            strength: parseFloat(row.advanced?.strength) || 100,
            shortRatio: parseFloat(row.advanced?.shortRatio) || 0,
            investor1D: {
                foreign: parseFloat(row.advanced?.investor?.foreign1D) || 0,
                organ: parseFloat(row.advanced?.investor?.organ1D) || 0,
                personal: parseFloat(row.advanced?.investor?.personal1D) || 0
            },
            investor5D: {
                foreign: parseFloat(row.advanced?.investor?.foreign5D) || 0,
                organ: parseFloat(row.advanced?.investor?.organ5D) || 0,
                personal: parseFloat(row.advanced?.investor?.personal5D) || 0
            },
            transactionValue: parseFloat(row.advanced?.transactionValue) || 0,
            volumeRate: parseFloat(row.advanced?.volumeRate) || 100,
            creditBalance: parseFloat(row.advanced?.creditBalance) || 0,
            sector: row.fundamental?.sector || '기타',
            technical: row.advanced?.technical || null,
            strengthAcceleration: parseFloat(row.advanced?.strengthAcceleration) || 0,
            memberTrend: row.advanced?.memberTrend || null,
            largeTrade: row.advanced?.largeTrade || null
        };

        const changePct = parseFloat(row.advanced?.change || '0');
        const maAlignment = m.technical?.maAlignment || '혼조세';
        const isDumping = m.investor1D.foreign < 0 && m.investor1D.organ < 0;

        // VETO Conditions
        let isVetoed = false;
        const vetoReasons = [];

        // 1. Strength Veto
        const isCoreSemiconductor = ['005930', '000660', '042700', '007660', '403870', '067310'].includes('034020');
        const isUptrend = maAlignment.includes('정배열') || (changePct > 0);
        let minStrengthRequired = 95; // Assuming normal market stress
        if (isCoreSemiconductor || isUptrend) {
            minStrengthRequired = (changePct > 0) ? 80 : 90;
        }
        if (m.strength < minStrengthRequired) {
            isVetoed = true;
            vetoReasons.push(`[수급 분석] 체결강도 약세 (체결강도: ${m.strength}% < 기준: ${minStrengthRequired}%)`);
        }

        // 2. Trend Vetoes
        const isPriceBelow5MA = m.disparity5 < 100;
        const isDownwardDrift = m.disparity1 < 100 && m.strength < 100;
        let isVetoRebounding = (m.disparity5 < 100) && (m.disparity1 >= 100) && (m.strength >= 100) && (changePct > 0 || !isDumping);

        // Calculate totalScore first to check shouldBypassTrends
        let strengthScore = 0;
        if (m.strength >= 120) strengthScore = 30;
        else if (m.strength >= 108) strengthScore = 22;
        
        let disparityScore = (m.disparity5 >= 100 && m.disparity1 >= 100) ? 10 : -5;
        let shortScore = m.shortRatio < 5 ? 5 : 3;
        let supplyScore = 25; // estimated
        let indexRelativeScore = 15; // estimated
        let trendScore = maAlignment.includes('정배열') ? 15 : (maAlignment.includes('역배열') ? -15 : 5);
        let moneyInflowScore = 10;
        let memberTrendScore = 5;
        let largeTradeScore = 3;
        let strengthAccScore = 0;

        const rawTotalScore = strengthScore + disparityScore + shortScore + supplyScore + indexRelativeScore + trendScore + moneyInflowScore + memberTrendScore + largeTradeScore + strengthAccScore;
        const totalScore = rawTotalScore;

        const isSuperLeader = totalScore >= 70;
        const isSupplyGoldenCross = false; // dummy
        
        let shouldBypassTrends = (isSuperLeader && !isDumping) || (strengthAccScore >= 5 && !isDumping);

        if (isSupplyDeathCross(m.investor5D, m.investor1D, changePct)) {
            isVetoed = true;
            vetoReasons.push(`[수급 분석] 수급 하락 변곡점 감지`);
        } else if (!shouldBypassTrends && isPriceBelow5MA && !isVetoRebounding) {
            isVetoed = true;
            vetoReasons.push(`[기술적 분석] 5일선 아래 흘러내림 (5일 이격도: ${m.disparity5}%, 반등 요건 미충족)`);
        } else if (!shouldBypassTrends && isDownwardDrift) {
            isVetoed = true;
            vetoReasons.push(`[기술적 분석] 단기 하락 및 체결강도 약세 (1일 이격도: ${m.disparity1}%, 체결강도: ${m.strength}%)`);
        }

        console.log(`- 종목명: 두산에너빌리티`);
        console.log(`- 주가 등락률: ${changePct}%`);
        console.log(`- 체결강도: ${m.strength}%`);
        console.log(`- 5일 이격도: ${m.disparity5}%`);
        console.log(`- 이평선 정렬: ${maAlignment}`);
        console.log(`- 임시 연산 총점: ${totalScore}점 (역배열 패널티 -15점 반영)`);
        console.log(`- VETO 판정 여부: ${isVetoed}`);
        console.log(`- VETO 사유: ${vetoReasons.join(' | ')}`);

    } catch (e) {
        console.error(e);
    }
}

function isSupplyDeathCross(inv5D, inv1D, changePct) {
    const isPrevBuying = inv5D.foreign > 0 || inv5D.organ > 0;
    const isTodaySelling = inv1D.foreign < 0 || inv1D.organ < 0;
    const isPriceDropping = changePct < 0;
    return isPrevBuying && isTodaySelling && isPriceDropping;
}

diagnoseDoosan();
