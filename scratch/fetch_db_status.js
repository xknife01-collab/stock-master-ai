import supabase from '../lib/supabaseClient.js';
import fs from 'fs';

async function fetchDbStatus() {
    if (!supabase) {
        console.error('Supabase not configured');
        return;
    }
    try {
        console.log('Retrieving __ai_cache__ from Supabase...');
        const { data: cacheData, error: cacheErr } = await supabase
            .from('stock_master_map')
            .select('code')
            .eq('name', '__ai_cache__')
            .maybeSingle();

        if (cacheErr) {
            console.error('Cache retrieve error:', cacheErr);
        } else if (cacheData) {
            const parsed = JSON.parse(cacheData.code);
            console.log('--- __ai_cache__ metadata ---');
            console.log('tenMinKey:', parsed.tenMinKey);
            console.log('halfHourKey:', parsed.halfHourKey);
            console.log('savedTime:', parsed.savedTime);
            console.log('Theme:', parsed.pulse?.data?.theme || parsed.pulse?.theme);
            console.log('Stock:', parsed.pulse?.data?.stock || parsed.pulse?.stock);
            console.log('------------------------------');
        } else {
            console.log('__ai_cache__ not found in DB');
        }

        console.log('Retrieving __rag_diary__ from Supabase...');
        const { data: diaryData, error: diaryErr } = await supabase
            .from('stock_master_map')
            .select('code')
            .eq('name', '__rag_diary__')
            .maybeSingle();

        if (diaryErr) {
            console.error('Diary retrieve error:', diaryErr);
        } else if (diaryData) {
            const parsed = JSON.parse(diaryData.code);
            console.log('--- __rag_diary__ latest entries ---');
            parsed.slice(0, 5).forEach((entry, i) => {
                console.log(`[${i}] Time: ${entry.time}`);
                console.log(`    Theme: ${entry.prediction?.theme}`);
                console.log(`    Stock: ${entry.prediction?.stock} (${entry.prediction?.symbol})`);
            });
            console.log('------------------------------------');
        } else {
            console.log('__rag_diary__ not found in DB');
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

fetchDbStatus();
