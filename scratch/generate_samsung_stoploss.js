import dotenv from 'dotenv';
dotenv.config();
import { vertexModel } from '../lib/ai.js';
import { KIS_BASE_URL, getAccessToken, getKisHeaders, kisRequest } from '../lib/kisCore.js';

async function main() {
    try {
        const token = await getAccessToken();
        
        // 1. Fetch Samsung Electronics live price and day high/low
        const response = await kisRequest({
            method: 'get',
            url: `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-price`,
            params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: '005930' },
            headers: {
                ...getKisHeaders('FHKST01010100'),
                'authorization': `Bearer ${token}`
            }
        });
        
        const output = response.data?.output || {};
        const price = parseInt(output.stck_prpr || '0');
        const change = parseFloat(output.prdy_ctrt || '0');
        const low = parseInt(output.stck_lwpr || '0');
        const high = parseInt(output.stck_hgpr || '0');
        const open = parseInt(output.stck_oprc || '0');
        const sector = output.bstp_kor_isnm || '';

        // 2. Fetch KOSPI index to check systemic market risk
        const kospiResponse = await kisRequest({
            method: 'get',
            url: `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-index-price`,
            params: { 
                FID_COND_MRKT_DIV_CODE: 'U', 
                FID_INPUT_ISCD: '0001',
                FID_ETC_CLS_CODE: ''
            },
            headers: {
                ...getKisHeaders('FHPUP02100000'),
                'authorization': `Bearer ${token}`
            }
        });
        
        const kospiOutput = kospiResponse.data?.output || {};
        const kospiPrice = parseFloat(kospiOutput.bstp_nmpr || '0');
        const kospiChange = parseFloat(kospiOutput.prdy_ctrt || '0');

        const dataSheet = `
👑 [실시간 시장 위기 데이터 시트]
- 삼성전자 현재가: ${price.toLocaleString()} 원 (${change}% 전일대비)
- 금일 시가: ${open.toLocaleString()} 원 | 고가: ${high.toLocaleString()} 원 | 저가: ${low.toLocaleString()} 원
- 업종: ${sector}
- 코스피 지수: ${kospiPrice.toLocaleString()} (${kospiChange}% 전일대비)
- 손절 기준선: 285,000 원
        `;

        const prompt = `
당신은 대한민국 최고 권위의 퀀트 트레이딩 AI 비서입니다.
사용자가 삼성전자 주가가 285,000원 근방(현재가 287,000원, 금일 저가 283,000원)으로 떨어져서 "지금 285,000원이잖아 (손절선 도달한 거 아니냐)"라며 불안해하고 있습니다.
아래 실시간 데이터 시트를 바탕으로, 이 위기 상황에서 침착하고 현명하게 대응할 수 있도록 "웅장하고 힘찬 위기 분석 및 전술 가이드"를 제시하십시오.

반드시 다음 키워드 및 개념을 자연스럽고 웅장하게 포함하십시오:
1. "0.1초 만에" (예: "0.1초 만에 국내외 지수 및 삼성전자의 실시간 매물 분포를 입체 분석한 결과...")
2. "웅장하게" 또는 전장의 영웅이 전략을 제시하듯 품격 있고 웅장한 톤앤매너
3. 구체적인 수치 (현재가 287,000원, 오늘 최저가 283,000원, 코스피 하락률 등)
4. '종가(Closing Price) 확인 법칙'의 중요성 설명: 대형 우량주는 장중에 세력들의 '손절 유도(Stop Hunt)'나 개인의 투매 유발로 인해 일시적으로 손절선을 하향 돌파(최저가 283,000원)하더라도 장 마감 시(오후 3시 30분 종가) 다시 회복하는 경우가 많으므로, 반드시 장중 돌파가 아닌 **'종가 기준 확정 돌파'** 시에만 손절을 실행해야 함을 웅장하게 강조.
5. 코스피 지수 하락률을 언급하며, 개별 종목의 악재가 아닌 **'시장 전체의 체계적 리스크(하락장)'**로 인한 동반 하락이므로 패닉 셀을 피하고 침착함을 유지하라고 격려.
6. 구체적인 행동 행동 방침:
   - 1안: 종가 기준으로 285,000원이 붕괴된 채 마감한다면, 원칙에 따라 리스크 관리(손절 또는 비중 축소).
   - 2안: 종가에 285,000원 위로 말아 올려 마감한다면, 이는 강력한 아래꼬리 바닥 확인(지지선 방어 성공)이므로 보유 지속.

출력 포맷:
- 👑 **0.1초 긴급 대응 브리핑** (위기 극복 핵심 요약)
- 📊 **실시간 시장 위기 데이터 시트** (현재가, 오늘 저가, 코스피 지표 표)
- ⚔️ **전술 분석: 왜 지금 즉시 팔면 안 되는가?** (종가 법칙 & 시장 하락 원인 분석)
- 🚀 **AI 최종 위기 처방 및 액션 플랜** (종가 기준 대응 가이드라인)

데이터 시트:
${dataSheet}
        `;

        const result = await vertexModel.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "text/plain" }
        });

        const text = result.response.text ? result.response.text().trim() : result.response.candidates[0].content.parts[0].text.trim();
        console.log(text);

    } catch (e) {
        console.error("오류 발생:", e);
    }
}

main();
