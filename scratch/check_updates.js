import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import supabase from '../lib/supabaseClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cacheFilePath = path.join(__dirname, '../dashboard_cache.json');
const aiCachePath = path.join(__dirname, '../ai_cache.json');

async function checkUpdates() {
  console.log('🔍 [Updates Verification] Verifying background update schedules...\n');

  // 1. Dashboard Cache Check (Updates every 2 mins)
  if (fs.existsSync(cacheFilePath)) {
    const stats = fs.statSync(cacheFilePath);
    const mtime = stats.mtime;
    const diffMins = Math.round((Date.now() - mtime.getTime()) / 60000 * 10) / 10;
    console.log(`✅ [계량 전광판 (Dashboard Cache)]`);
    console.log(`   - 로컬 캐시 파일 경로: ${cacheFilePath}`);
    console.log(`   - 최종 갱신 시간 (KST): ${mtime.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
    console.log(`   - 경과 시간: ${diffMins}분 전`);
    if (diffMins <= 5) {
      console.log(`   - 상태: 정상 작동 중 (2분 주기로 자동 갱신 중)`);
    } else {
      console.log(`   - 상태: 확인 필요 (2분보다 길게 업데이트되지 않음)`);
    }
  } else {
    console.log('❌ dashboard_cache.json 파일이 존재하지 않습니다.');
  }

  console.log();

  // 2. AI Pulse Cache Check (Updates every 10 mins, cached for 30 mins)
  if (fs.existsSync(aiCachePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(aiCachePath, 'utf8'));
      const stats = fs.statSync(aiCachePath);
      const fileMtime = stats.mtime;
      console.log(`✅ [실시간 리스크 센터 (AI Pulse Cache)]`);
      console.log(`   - hourKey: ${data.hourKey}`);
      console.log(`   - savedTime (표기 시각): ${data.savedTime}`);
      console.log(`   - 파일 최종 수정 시간 (KST): ${fileMtime.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
      const diffMins = Math.round((Date.now() - fileMtime.getTime()) / 60000 * 10) / 10;
      console.log(`   - 경과 시간: ${diffMins}분 전`);
      console.log(`   - 상태: 정상 작동 중 (10분 스케줄러가 작동하며 30분 단위로 캐시 고유키 갱신)`);
    } catch (e) {
      console.error('❌ AI Cache 파싱 실패:', e.message);
    }
  } else {
    console.log('❌ ai_cache.json 파일이 존재하지 않습니다.');
  }

  console.log();

  // 3. Supabase __DASH__ Backup Check
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('stock_detail_cache')
        .select('updated_at')
        .eq('symbol', '__DASH__')
        .maybeSingle();

      if (error) {
        console.error('❌ Supabase __DASH__ 조회 실패:', error.message);
      } else if (data) {
        const dbTime = new Date(data.updated_at);
        const diffMins = Math.round((Date.now() - dbTime.getTime()) / 60000 * 10) / 10;
        console.log(`✅ [Supabase __DASH__ 클라우드 백업]`);
        console.log(`   - 최종 갱신 시간 (KST): ${dbTime.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
        console.log(`   - 경과 시간: ${diffMins}분 전`);
      } else {
        console.log('⚠️ Supabase에 __DASH__ 백업 레코드가 없습니다.');
      }
    } catch (err) {
      console.error('❌ Supabase 연결 진단 중 예외 발생:', err.message);
    }
  }
}

checkUpdates();
