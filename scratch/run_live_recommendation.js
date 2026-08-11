import { executeHourlyPulse } from '../routes/aiApi.js';
import dotenv from 'dotenv';
dotenv.config();

async function runLivePulse() {
  console.log('🚀 [Live AI Recommendation Engine Execution] Starting 100% real-time KIS quant + Gemini AI pulse...');
  const start = Date.now();
  try {
    const result = await executeHourlyPulse(true);
    const elapsed = ((Date.now() - start) / 1000).toFixed(2);
    console.log(`\n======================================================`);
    console.log(`✅ [AI Pulse Output Verification] Completed in ${elapsed}s`);
    console.log(`======================================================\n`);
    
    const pulseData = result?.data || result?.pulse?.data || result?.pulse || {};
    
    console.log(`📌 [표기 시각]: ${result?.time || '실시간 N/A'}`);
    console.log(`📌 [장 개장 여부]: ${result?.marketOpen ? '🟢 정규장 진행 중' : '🔴 장외 (최종 분석 렌더링)'}`);
    console.log(`\n👑 [AI 최우선 픽 종목]`);
    console.log(`- 주도 테마: ${pulseData.theme || 'N/A'} (적합도 ${pulseData.themeProb || 'N/A'})`);
    console.log(`- 종목명: ${pulseData.stock || 'N/A'} (${pulseData.symbol || 'N/A'})`);
    console.log(`- 현재가: ${pulseData.price ? Number(pulseData.price).toLocaleString() + '원' : 'N/A'}`);
    console.log(`- 목표가(TP): ${pulseData.tp ? Number(pulseData.tp).toLocaleString() + '원' : 'N/A'}`);
    console.log(`- 손절가(SL): ${pulseData.sl ? Number(pulseData.sl).toLocaleString() + '원' : 'N/A'}`);
    console.log(`- 펀더멘털 평가: ${pulseData.fundamental || 'N/A'}`);
    console.log(`\n📝 [AI 추천 사유]`);
    console.log(pulseData.reason || 'N/A');
    
    console.log(`\n⚠️ [리스크 및 매크로 요인 (Bear Case)]`);
    console.log(pulseData.bearCase || 'N/A');
    
    console.log(`\n💡 [매매 피드백]`);
    console.log(pulseData.feedback || 'N/A');
    
    if (Array.isArray(pulseData.shortTermPicks) && pulseData.shortTermPicks.length > 0) {
      console.log(`\n⚡ [단기 스윙 추천 종목]`);
      pulseData.shortTermPicks.forEach(p => {
        console.log(`  • ${p.n} (${p.c}): 현재가 ${Number(p.p).toLocaleString()}원 / 목표가 ${Number(p.tp).toLocaleString()}원 / 손절가 ${Number(p.sl).toLocaleString()}원 / 타겟: ${p.t}`);
      });
    }
    
    if (Array.isArray(pulseData.longTermPicks) && pulseData.longTermPicks.length > 0) {
      console.log(`\n💎 [장기 가치 추천 종목]`);
      pulseData.longTermPicks.forEach(p => {
        console.log(`  • ${p.n} (${p.c}): 현재가 ${Number(p.p).toLocaleString()}원 / 목표가 ${Number(p.tp).toLocaleString()}원 / 이유: ${p.r}`);
      });
    }
    
    if (Array.isArray(pulseData.candidates) && pulseData.candidates.length > 0) {
      console.log(`\n📊 [퀀트 스코어링 상위 5개 후보 종목]`);
      pulseData.candidates.slice(0, 5).forEach((c, idx) => {
        console.log(`  ${idx + 1}. ${c.name} (${c.code}): 총점 ${c.totalScore}점 / 현재가 ${Number(c.price).toLocaleString()}원 / VETO: ${c.isVetoed ? '❌ ' + c.vetoReason : '🟢 통과'}`);
      });
    }
  } catch (err) {
    console.error('❌ [Live Pulse Failure]:', err.message);
  }
}

runLivePulse();
