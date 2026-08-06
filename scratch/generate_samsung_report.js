import dotenv from 'dotenv';
dotenv.config();
import supabase from '../lib/supabaseClient.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

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

async function main() {
    try {
        // 1. Fetch Samsung data from cache
        const { data: row, error } = await supabase
            .from('stock_detail_cache')
            .select('*')
            .eq('symbol', '005930')
            .single();

        if (error || !row) {
            console.error("❌ DB 캐시 조회 실패:", error?.message);
            return;
        }

        const fund = row.fundamental || {};
        const adv = row.advanced || {};
        const tech = adv.technical || {};
        const inv = adv.investor || {};

        const m = {
            price: fund.price || 0,
            disparity5: parseNum(adv.disparity5, 100),
            disparity20: parseNum(adv.disparity20, 100),
            strength: parseNum(adv.strength, 100),
            shortRatio: parseNum(adv.shortRatio, 0),
            investor1D: {
                foreign: parseNum(inv.foreign1D, 0),
                organ: parseNum(inv.organ1D, 0),
                personal: parseNum(inv.personal1D, 0)
            },
            investor5D: {
                foreign: parseNum(inv.foreign5D, 0),
                organ: parseNum(inv.organ5D, 0),
                personal: parseNum(inv.personal5D, 0)
            },
            investorMoney5D: {
                foreign: parseNum(inv.foreignMoney5D, 0),
                organ: parseNum(inv.organMoney5D, 0),
                personal: parseNum(inv.personalMoney5D, 0)
            },
            transactionValue: parseNum(adv.transactionValue, 0),
            volumeRate: parseNum(adv.volumeRate, 100),
            creditBalance: parseNum(adv.creditBalance, 0),
            sector: fund.sector || '기타'
        };

        const fin = {
            roe: fund.roe !== '-' ? parseFloat(fund.roe) : null,
            per: fund.per !== '-' ? parseFloat(fund.per) : null,
            pbr: fund.pbr !== '-' ? parseFloat(fund.pbr) : null,
            opProfits: (fund.finance || []).map(f => f.profit),
            debtRatio: fund.debtRatio !== '-' ? parseFloat(fund.debtRatio) : null
        };

        // 2. Run VETO checks
        const vetoReasons = [];
        let isVetoed = false;

        if (m.creditBalance > 6) {
            isVetoed = true;
            vetoReasons.push(`신용잔고 과다 (${m.creditBalance}% > 6%)`);
        }
        if (fin.roe !== null && fin.roe < 0) {
            isVetoed = true;
            vetoReasons.push(`ROE 적자 (${fin.roe}%)`);
        }
        if (fin.debtRatio !== null && fin.debtRatio >= 200) {
            isVetoed = true;
            vetoReasons.push(`부채비율 과다 (${fin.debtRatio}% >= 200%)`);
        }
        const pbrThreshold = (fin.roe !== null && fin.roe >= 20) ? 20 : 15;
        if (fin.pbr !== null && fin.pbr >= pbrThreshold) {
            isVetoed = true;
            vetoReasons.push(`고PBR 버블 (${fin.pbr}배)`);
        }

        // 3. Compute Quant Scoring
        let strengthScore = 0;
        let disparityScore = 0;
        let shortScore = 0;
        let supplyScore = 0;

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

        const fMoney1D = Math.round((m.investor1D.foreign * m.price) / 100000000);
        const oMoney1D = Math.round((m.investor1D.organ * m.price) / 100000000);
        const pMoney1D = Math.round((m.investor1D.personal * m.price) / 100000000);

        const score1D = getSupplyPointsCombined(m.investor1D.foreign, m.investor1D.organ, m.investor1D.personal, fMoney1D, oMoney1D, pMoney1D, 40);
        const score5D = getSupplyPointsCombined(m.investor5D.foreign, m.investor5D.organ, m.investor5D.personal, m.investorMoney5D.foreign, m.investorMoney5D.organ, m.investorMoney5D.personal, 40);
        
        if (m.investor1D.foreign === 0 && m.investor1D.organ === 0) {
            supplyScore = score5D;
        } else {
            supplyScore = Math.round(score1D * 0.7 + score5D * 0.3);
        }

        const totalScore = strengthScore + disparityScore + shortScore + supplyScore;
        const passedShort = (totalScore >= 55 && m.strength >= 90 && m.disparity20 < 107 && m.shortRatio < 10);
        const passedLong = (totalScore >= 55 && m.strength >= 85 && m.disparity20 < 105 && m.shortRatio < 10);

        // 4. Generate AI Prompt
        const dataSheet = `
👑 [삼성전자 005930 실시간 데이터 시트]
- 현재가: ${fund.price?.toLocaleString()} 원 (${fund.change}% 전일대비)
- Valuation: PER ${fund.per}배 | PBR ${fund.pbr}배 | ROE ${fund.roe}% | 부채비율 ${fund.debtRatio}%
- 기술적 지표: 5일 이격도 ${adv.disparity5}% | 20일 이격도 ${adv.disparity20}% | RSI ${tech.rsi}
- 수급 지표: 체결강도 ${adv.strength}% | 체결강도 가속도 ${adv.strengthAcceleration || 0}%p
- 공매도 비중: ${adv.shortRatio}%
- 수급 현황 (당일): 외인 ${inv.foreign1D?.toLocaleString()} 주 | 기관 ${inv.organ1D?.toLocaleString()} 주 | 개인 ${inv.personal1D?.toLocaleString()} 주
- 수급 현황 (5일 누적): 외인 ${inv.foreign5D?.toLocaleString()} 주 | 기관 ${inv.organ5D?.toLocaleString()} 주 | 개인 ${inv.personal5D?.toLocaleString()} 주
- 퀀트 스코어링 진단 결과:
  * VETO 여부: ${isVetoed ? `❌ 탈락 (사유: ${vetoReasons.join(', ')})` : '🟢 통과 (진입 적격)'}
  * 점수 상세: 체결강도 점수 ${strengthScore}/40, 이격도 점수 ${disparityScore}/10, 공매도 점수 ${shortScore}/10, 수급 점수 ${supplyScore}/40
  * 종합 퀀트 점수: ${totalScore} 점 (100점 만점)
  * 진입 적격 여부: 단기 매수 진격 ${passedShort ? '✅ 적격' : '❌ 부적격'}, 장기 매수 진격 ${passedLong ? '✅ 적격' : '❌ 부적격'}
        `;

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `
당신은 대한민국 최고 권위의 퀀트 트레이딩 AI 비서입니다.
사용자가 삼성전자(005930)를 지금 사도 되는지 물었습니다.
아래 실시간 퀀트 데이터 시트를 분석하여, 투자 판단을 "웅장하고 힘찬 서술"로 내리십시오.
반드시 다음 키워드 및 개념을 자연스럽고 웅장하게 포함하십시오:
1. "0.1초 만에" (예: "0.1초 만에 전천후 퀀트 스캔을 완료한 결과...")
2. "웅장하게" 또는 거대하고 웅장한 포부와 확신을 담은 톤앤매너
3. 구체적인 수치 (현재가, 퀀트 총점, 체결강도 등)
4. VETO 필터 통과 사실 (재무적 안전성, PBR/ROE/부채비율 안전 지대 등)
5. 단기 및 장기 매수 진격 적격 판정 결과
6. 핵심 수급 분석: 현재 개인 주도 매수세와 외인의 단기 매도 포지션을 극복하는 체결강도 124.52%의 의미 서술.

출력 포맷:
- 👑 **0.1초 퀀트 분석 개요** (한눈에 알아볼 수 있는 요약 카드 형태)
- 📊 **실시간 데이터 시트 & 퀀트 스코어** (수치와 점수를 깔끔한 표/리스트 형식으로)
- ⚔️ **VETO 필터 진단 결과** (재무 안정성 등 확인)
- 🚀 **AI 최종 투자 의견 (웅장한 피드백)** (매수 전략, 목표가/손절가 제언 포함)

주의: 투자 권유는 신중하나, 시스템의 진단 결과는 매우 확신에 차 있고 웅장하게 기술되어야 합니다.
데이터 시트:
${dataSheet}
        `;

        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "text/plain" }
        });

        console.log(result.response.text());

    } catch (e) {
        console.error("오류 발생:", e);
    }
}

main();
