import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import WebSocket from 'ws';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY || '';

let supabase = null;

if (supabaseUrl && supabaseKey) {
  try {
    // Node 20 WebSocket 이슈 해결을 위해 ws 주입 (realtime & global)
    supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false },
        global: { fetch: fetch.bind(globalThis) },
        realtime: { transport: WebSocket }
    });
    console.log('⚡ [Supabase] 클라우드 DB 클라이언트 초기화 완료.');
  } catch (error) {
    console.error('❌ [Supabase] 클라이언트 초기화 중 오류 발생:', error.message);
  }
} else {
  console.warn('⚠️ [Supabase] .env에 SUPABASE_URL 및 SUPABASE_KEY가 설정되지 않았습니다. 로컬 Mock DB 폴백 모드로 동작합니다.');
}

export default supabase;
