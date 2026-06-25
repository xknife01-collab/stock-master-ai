import { executeHourlyPulse } from '../routes/aiApi.js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  console.log('🚀 [Forced Pulse Run] Starting manual pulse execution to test veto logic...');
  try {
    const result = await executeHourlyPulse(true);
    console.log('✅ [Forced Pulse Run] Succeeded.');
    if (result && result.pulse) {
      console.log('- time:', result.savedTime || result.time);
      const candidates = result.pulse.data?.candidates || result.pulse.candidates || [];
      console.log(`- Candidates parsed: ${candidates.length}`);
      
      const samsung = candidates.find(c => c.code === '005930' || c.name === '삼성전자');
      if (samsung) {
        console.log(`\n========================================`);
        console.log(`📊 [삼성전자 최종 상태]`);
        console.log(`- 이름: ${samsung.name}`);
        console.log(`- VETO 여부: ${samsung.isVetoed} (${samsung.isVetoed ? '❌ 배제' : '🟢 통과'})`);
        console.log(`- VETO 사유: ${samsung.vetoReason || '없음'}`);
        console.log(`- 하락 변곡점 여부 (isSupplyDeathCross): ${samsung.isSupplyDeathCross}`);
        console.log(`========================================\n`);
      } else {
        console.log('⚠️ 삼성전자가 후보군 목록에 존재하지 않습니다.');
      }
    }
  } catch (err) {
    console.error('❌ [Forced Pulse Run] Failed:', err.message);
  }
}

run();
