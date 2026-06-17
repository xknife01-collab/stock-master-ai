import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import supabase from '../lib/supabaseClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ragDiaryPath = path.join(__dirname, '../rag_diary.json');
const aiCachePath = path.join(__dirname, '../ai_cache.json');

async function clearHistory() {
    console.log("🧹 Wiping AI Recommendation History...");

    // 1. Wipe local files
    try {
        fs.writeFileSync(ragDiaryPath, '[]', 'utf8');
        console.log("✅ Local rag_diary.json cleared to [].");
    } catch (e) {
        console.error("❌ Failed to clear local rag_diary.json:", e.message);
    }

    try {
        fs.writeFileSync(aiCachePath, '{}', 'utf8');
        console.log("✅ Local ai_cache.json cleared to {}.");
    } catch (e) {
        console.error("❌ Failed to clear local ai_cache.json:", e.message);
    }

    // 2. Wipe Supabase DB rows
    if (supabase) {
        try {
            console.log("📡 Connecting to Supabase to delete database cache rows...");
            const { error } = await supabase
                .from('stock_master_map')
                .delete()
                .in('name', ['__rag_diary__', '__ai_cache__']);

            if (error) {
                console.error("❌ Failed to delete Supabase records:", error.message);
            } else {
                console.log("✅ Successfully deleted __rag_diary__ and __ai_cache__ from Supabase 'stock_master_map' table.");
            }
        } catch (e) {
            console.error("❌ Supabase deletion exception:", e.message);
        }
    } else {
        console.log("⚠️ Supabase client not initialized. Skipping database wipe.");
    }

    console.log("🎉 History clearing process complete.");
    process.exit(0);
}

clearHistory();
