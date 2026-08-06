import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

import { syncSingleStock } from '../lib/stockSync.js';
import supabase from '../lib/supabaseClient.js';
import { aiModel, vertexModel } from '../lib/ai.js';

// Replicate news fetching with sentiment Analysis
const fetchNaverNews = async (query) => {
    const defaultRes = { text: "뉴스 데이터를 불러오지 못했습니다.", sentiment: { bullishPercent: 0, bearishPercent: 0, neutralPercent: 100 } };
    if (!process.env.NAVER_CLIENT_ID || !process.env.NAVER_CLIENT_SECRET) {
        return { text: "네이버 뉴스 키가 등록되지 않았습니다.", sentiment: { bullishPercent: 0, bearishPercent: 0, neutralPercent: 100 } };
    }
    try {
        const response = await axios.get('https://openapi.naver.com/v1/search/news.json', {
            params: { query, display: 15, sort: 'date' },
            headers: {
                'X-Naver-Client-Id': process.env.NAVER_CLIENT_ID,
                'X-Naver-Client-Secret': process.env.NAVER_CLIENT_SECRET
            }
        });
        
        const items = response.data.items || [];
        if (items.length === 0) {
            return { text: "관련 뉴스 없음", sentiment: { bullishPercent: 0, bearishPercent: 0, neutralPercent: 100 } };
        }

        const titles = items.map(it => it.title.replace(/<[^>]*>?/g, '').replace(/&quot;/g, '"'));
        const text = titles.slice(0, 5).join('\n'); // Keep it concise for prompt

        const bullishKeywords = [
            '상승', '호재', '돌파', '급등', '흑자', '성장', '계약', '체결', '강세', '최고', '수혜', '신고가', 
            '상향', '호실적', '대박', '인수', '진입', '독점', '기대', '전망 밝', '주목', '러브콜', '성공', 
            '순항', '확대', '1위', '급증', '반등', '유입', '상승세', '신제품', '출시', '협력', '파란불', '훈풍',
            '어닝 서프라이즈', '서프라이즈', '날개', '독주', '러시', '활짝', '껑충', '최대 실적'
        ];

        const bearishKeywords = [
            '하락', '악재', '급락', '적자', '감소', '우려', '약세', '최저', '피소', '과징금', '논란', '붕괴', 
            '부진', '쇼크', '하향', '횡령', '배임', '취소', '경고', '위험', '소송', '분쟁', '축소', '실패', 
            '지연', '리스크', '둔화', '어닝쇼크', '포기', '급감', '이탈', '하락세', '찬바람', '먹구름', '빨간불',
            '급락세', '쇼크', '악화', '경고등', '반토막', '쇼크', '과열 우려'
        ];

        let bullishCount = 0;
        let bearishCount = 0;
        let neutralCount = 0;

        titles.forEach(title => {
            let pScore = 0;
            let nScore = 0;
            bullishKeywords.forEach(kw => { if (title.includes(kw)) pScore++; });
            bearishKeywords.forEach(kw => { if (title.includes(kw)) nScore++; });
            if (pScore > nScore) bullishCount++;
            else if (nScore > pScore) bearishCount++;
            else neutralCount++;
        });

        const total = bullishCount + bearishCount + neutralCount || 1;
        return {
            text,
            sentiment: {
                bullishPercent: Math.round((bullishCount / total) * 100),
                bearishPercent: Math.round((bearishCount / total) * 100),
                neutralPercent: Math.round((neutralCount / total) * 100)
            }
        };
    } catch (e) {
        return defaultRes;
    }
};

async function run() {
  console.log('🚀 한국금융지주 (071050) 실시간 데이터 동기화 및 심층 분석 시작...');
  
  // 1. Sync live data from KIS
  await syncSingleStock('071050', false);
  console.log('✅ 실시간 데이터 동기화 완료!');
  
  // 2. Fetch from Supabase
  const { data, error } = await supabase
    .from('stock_detail_cache')
    .select('*')
    .eq('symbol', '071050')
    .maybeSingle();
    
  if (error || !data) {
    console.error('❌ Supabase 조회 에러 또는 데이터 없음:', error?.message);
    return;
  }
  
  // 3. Fetch News
  const newsRes = await fetchNaverNews('한국금융지주 주식 전망 공시 뉴스');
  
  // 4. Calculate Quant Score & VETO Check
  const parseNum = (val, fallback = 0) => {
    if (val === undefined || val === null || val === '-') return fallback;
    const parsed = parseFloat(val);
    return isNaN(parsed) ? fallback : parsed;
  };
  
  const strength = parseNum(data.advanced?.strength, 100);
  const disparity20 = parseNum(data.advanced?.disparity20, 100);
  const disparity5 = parseNum(data.advanced?.disparity5, 100);
  const roe = parseNum(data.fundamental?.roe, 0);
  const pbr = parseNum(data.fundamental?.pbr, 0);
  const debtRatio = parseNum(data.fundamental?.debtRatio, 0);
  const shortRatio = parseNum(data.advanced?.shortRatio, 0);
  
  // Scoring logic matching routes/aiApi.js
  let strengthScore = 0;
  if (strength >= 120) strengthScore = 30;
  else if (strength >= 105) strengthScore = 20;
  else if (strength >= 95) strengthScore = 10;
  else if (strength < 80) strengthScore = -15;
  
  let disparityScore = 0;
  if (disparity20 >= 108) disparityScore = -15;
  else if (disparity20 >= 103) disparityScore = 0;
  else if (disparity20 >= 95) disparityScore = 15;
  else if (disparity20 >= 90) disparityScore = 8;
  else disparityScore = -10;
  
  let roeScore = roe >= 15 ? 10 : roe >= 5 ? 5 : roe < 0 ? -10 : 0;
  let pbrScore = pbr <= 1.5 ? 10 : pbr >= 8 ? -10 : 0;
  let shortScore = shortRatio >= 15 ? -15 : shortRatio >= 8 ? -5 : 0;
  
  const totalScore = 50 + strengthScore + disparityScore + roeScore + pbrScore + shortScore;
  
  const sector = data.fundamental?.sector || '';
  const isFinancialSector = sector.includes('금융') || sector.includes('은행') || sector.includes('보험') || sector.includes('증권');
  
  const vetoReasons = [];
  if (pbr > 15) vetoReasons.push(`고PBR 버블 (${pbr}배)`);
  if (roe < 0) vetoReasons.push(`ROE 적자 (${roe}%)`);
  if (!isFinancialSector && debtRatio > 350) vetoReasons.push(`고부채 위험 (${debtRatio}%)`);
  if (disparity5 > 109 || disparity20 > 108) vetoReasons.push(`이격과열 경고 (5일 이격도: ${disparity5}%, 20일 이격도: ${disparity20}%)`);
  
  console.log(`\n📊 [Scoring Results]`);
  console.log(`- 퀀트 종합 점수: ${totalScore}점`);
  console.log(`- 체결강도: ${strength}% (${strengthScore}점)`);
  console.log(`- 20일 이격도: ${disparity20}% (${disparityScore}점)`);
  console.log(`- ROE: ${roe}% (${roeScore}점)`);
  console.log(`- PBR: ${pbr}배 (${pbrScore}점)`);
  console.log(`- 공매도 비중: ${shortRatio}% (${shortScore}점)`);
  console.log(`- VETO 리스크 필터 작동 여부: ${vetoReasons.length > 0 ? '🔴 VETO 발동 (' + vetoReasons.join(', ') + ')' : '🟢 통과'}`);

  // 5. Ask Gemini
  const prompt = `너는 글로벌 매크로 분석가이자 퀀트 전문가야. 
  종목 [한국금융지주 (071050)]에 대해 제공된 계량 지표와 최신 뉴스, 그리고 계산된 퀀트 점수 및 리스크 필터를 종합하여 투자 의견을 도출해줘.

  [계량 및 기본 정보]
  - 종목명: 한국금융지주 (071050)
  - 현재가: ${data.fundamental?.price}원
  - 업종(섹터): 금융업
  - 체결강도: ${strength}%
  - 20일 이격도: ${disparity20}%
  - ROE: ${roe}%
  - PBR: ${pbr}배
  - 부채비율: ${debtRatio}%
  - 공매도 비중: ${shortRatio}%
  - 퀀트 종합 점수: ${totalScore}점 (기준점 60점 이상 시 진입 유망)
  - VETO 리스크 필터: ${vetoReasons.length > 0 ? '🔴 리스크 필터 작동 (' + vetoReasons.join(', ') + ')' : '🟢 통과'}

  [최신 뉴스 요약]
  ${newsRes.text}
  - 감성 지수: 호재(Bullish) ${newsRes.sentiment.bullishPercent}%, 악재(Bearish) ${newsRes.sentiment.bearishPercent}%, 중립(Neutral) ${newsRes.sentiment.neutralPercent}%

  [지침]
  1. 퀀트 종합 점수가 60점 이상이고 VETO 필터를 통과한 경우, 시장 진입이 가능한 것으로 평가해.
  2. 만약 VETO 필터가 작동했거나 점수가 60점 미만이면 보류 혹은 비추천으로 설정해.
  3. 모든 답변 문장(reason, feedback 등)은 최고 수준의 퀀트 분석가로서 위엄 있고 '웅장하게' 작성해. 그리고 실시간 데이터 분석의 속도감과 정밀함을 돋보이게 하기 위해 '0.1초 만에'라는 표현을 자연스럽게 활용해줘.
  4. 반드시 아래 JSON 형식으로만 응답해. 백틱(markdown) 없이 순수한 JSON 문자열로만 응답해.

  JSON Format:
  {
    "decision": "🟢 진입 가능" 또는 "🟡 진입 보류" 또는 "🔴 매수 금지 (VETO)",
    "reason": "웅장한 어조로 분석한 사유 (0.1초 만에 포착한 핵심 근거 포함)",
    "targetPrice": "목표가 (숫자만 문자열로, 진입 불가 시 '0')",
    "stopLoss": "손절가 (숫자만 문자열로, 진입 불가 시 '0')",
    "feedback": "앞으로의 투자 대응 조언 (웅장한 어조로)"
  }
  `;

  try {
    const runCall = async (model) => {
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      });
      return result.response.text ? result.response.text().trim() : result.response.candidates[0].content.parts[0].text.trim();
    };

    let textOut;
    try {
      textOut = await runCall(aiModel);
    } catch (e) {
      if (vertexModel) {
        textOut = await runCall(vertexModel);
      } else {
        throw e;
      }
    }
    
    console.log('\n🔮 [Gemini Deep Analysis Output]');
    console.log(textOut);
  } catch (gemErr) {
    console.error('AI 호출 실패:', gemErr.message);
  }
}

run();
