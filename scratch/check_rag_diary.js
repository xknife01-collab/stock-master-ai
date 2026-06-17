import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import supabase from '../lib/supabaseClient.js';

const ragDiaryPath = path.resolve(process.cwd(), 'rag_diary.json');

// Mocked cache
const stockMasterCache = {};

const getRagDiary = async () => {
    // 1. Supabase 클라우드 조회 우선 (서버리스 환경에서 로컬 파일 유실/초기화 방지)
    if (supabase) {
        try {
            if (stockMasterCache['__rag_diary__']) {
                const dbData = JSON.parse(stockMasterCache['__rag_diary__']);
                if (Array.isArray(dbData) && dbData.length > 0) {
                    try { fs.writeFileSync(ragDiaryPath, JSON.stringify(dbData, null, 2), 'utf8'); } catch (fsErr) {}
                    return dbData;
                }
            } else {
                const { data, error } = await supabase
                    .from('stock_master_map')
                    .select('code')
                    .eq('name', '__rag_diary__')
                    .maybeSingle();
                
                if (!error && data && data.code) {
                    const dbData = JSON.parse(data.code);
                    if (Array.isArray(dbData) && dbData.length > 0) {
                        stockMasterCache['__rag_diary__'] = data.code;
                        try { fs.writeFileSync(ragDiaryPath, JSON.stringify(dbData, null, 2), 'utf8'); } catch (fsErr) {}
                        return dbData;
                    }
                }
            }
        } catch (e) {
            console.error('❌ Failed to restore rag_diary from Supabase:', e.message);
        }
    }

    // 2. 클라우드 조회 실패 시 로컬 파일 폴백
    if (fs.existsSync(ragDiaryPath)) {
        try {
            return JSON.parse(fs.readFileSync(ragDiaryPath, 'utf8'));
        } catch (e) {
            console.error('Error reading local rag diary:', e.message);
        }
    }
    return [];
};

async function testSync() {
    console.log("=== Testing getRagDiary Cloud-First Logic ===");
    console.log("Current local file size:", fs.existsSync(ragDiaryPath) ? fs.readFileSync(ragDiaryPath, 'utf8').length : "Not Exists");
    
    console.log("Calling getRagDiary()...");
    const result = await getRagDiary();
    console.log("Result length:", result.length);
    
    console.log("New local file content length:", fs.readFileSync(ragDiaryPath, 'utf8').length);
}

testSync();
