import dotenv from 'dotenv';
dotenv.config();
import supabase from '../lib/supabaseClient.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const parseNum = (val, fallback = 0) => {
    if (val === undefined || val === null || val === '-') return fallback;
    const parsed = parseFloat(val);
    return isNaN(parsed) ? fallback : parsed;
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

        const dataSheet = `
👑 [삼성전자 005930 실시간 수급 및 기술 상태]
- 현재가: ${fund.price?.toLocaleString()} 원 (${fund.change}% 전일대비)
- Valuation: PER ${fund.per}배 | PBR ${fund.pbr}배 | ROE ${fund.roe}% | 부채비율 ${fund.debtRatio}%
- 기술적 지표: 5일 이격도 ${adv.disparity5}% | 20일 이격도 ${adv.disparity20}% | RSI ${tech.rsi}
- 수급 지표: 체결강도 ${adv.strength}% | 체결강도 가속도 ${adv.strengthAcceleration || 0}%p
- 공매도 비중: ${adv.shortRatio}%
- 수급 현황 (당일): 외인 ${inv.foreign1D?.toLocaleString()} 주 | 기관 ${inv.organ1D?.toLocaleString()} 주 | 개인 ${inv.personal1D?.toLocaleString()} 주
- 수급 현황 (5일 누적): 외인 ${inv.foreign5D?.toLocaleString()} 주 | 기관 ${inv.organ5D?.toLocaleString()} 주 | 개인 ${inv.personal5D?.toLocaleString()} 주
- 수급 현황 (20일 누적): 외인 ${inv.foreign20D?.toLocaleString()} 주 | 기관 ${inv.organ20D?.toLocaleString()} 주 | 개인 ${inv.personal20D?.toLocaleString()} 주
        `;

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `
당신은 대한민국 최고 권위의 퀀트 트레이딩 AI 비서입니다.
사용자가 삼성전자를 매수한 후 "바닥을 기고 있어서 걱정이다/답답하다"는 하소연을 했습니다.
아래 실시간 퀀트 데이터 시트(특히 20일 누적 수급 등)를 분석하여, 사용자를 위로하고 시장의 본질을 일깨워주는 "웅장하고 힘찬 분석 및 해법"을 제시하십시오.

반드시 다음 키워드 및 개념을 자연스럽고 웅장하게 포함하십시오:
1. "0.1초 만에" (예: "0.1초 만에 삼성전자의 깊은 수급 저변을 스캔한 결과...")
2. "웅장하게" 또는 거대하고 웅장한 포부와 확신을 담은 톤앤매너
3. 구체적인 수치 (현재가 297,000원, 20일 누적 외인 매도세 -4,800만 주 및 개인 매수세 +4,700만 주 등)
4. 왜 바닥을 기고 있는지의 원인 규명: 외인의 역대급 물량 투하(20일 누적 -48,621,181 주)를 개인이 홀로 다 받아내면서 매물 소화 과정이 필요하여 주가가 옆으로 기고 있다는 점을 설명.
5. 기술적 지표 분석: 20일 이격도 90.76%, RSI 36.9라는 수치는 역사적인 과매도/바닥 구간임을 기술적으로 명시.
6. 장기적 비전과 위로: 거대한 고목이 뿌리를 더 깊게 내리기 위한 인고의 시간(바닥 다지기)이라는 점을 웅장하게 서술하고, 목표가 320,000원과 손절가 285,000원을 기준으로 차분히 대응할 것을 권유.

출력 포맷:
- 👑 **0.1초 팩트 진단: 삼성전자가 바닥을 기는 이유** (핵심 수급 원인 요약)
- 📊 **실시간 수급 불균형 현황** (외인/개인 20일 누적 수치 비교 표)
- ⚔️ **기술적 바닥 증거 (이격도 & RSI)** (왜 지금이 절호의 바닥 구간인지 서술)
- 🚀 **AI 웅장한 처방전 & 대응 전략** (목표가/손절가 리마인드 및 멘탈 케어 가이드라인)

주의: 투자 분석은 매우 전문적이고 확신에 차 있어야 하며, 톤앤매너는 웅장하고 힘차야 합니다.
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
