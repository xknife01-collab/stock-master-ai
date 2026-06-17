import fs from 'fs';
import path from 'path';
import supabase from './supabaseClient.js';

const cachePath = path.resolve(process.cwd(), 'supply_cache.json');

const defaultCache = {
    ai_supply: "",
    dashboard_9000_buy: [],
    dashboard_9000_sell: [],
    dashboard_1000_buy: [],
    dashboard_1000_sell: [],
    dashboard_volume_rank: [],
    dashboard_fluctuation_rank: []
};

// 📡 클라우드에서 수급 캐시 파일 복원 (서버 기동 시 호출)
export const restoreSupplyCacheFromCloud = async () => {
    if (!supabase) return;
    try {
        console.log("📡 [Supply Cache] Restoring supply cache from Supabase cloud...");
        const { data, error } = await supabase
            .from('stock_detail_cache')
            .select('fundamental')
            .eq('symbol', '__SUPPLY__')
            .maybeSingle();

        if (error) {
            console.error("⚠️ [Supply Cache] Failed to restore from cloud:", error.message);
            return;
        }

        if (data && data.fundamental) {
            fs.writeFileSync(cachePath, JSON.stringify(data.fundamental, null, 2), 'utf8');
            console.log("✅ [Supply Cache] Successfully restored supply cache from Supabase cloud.");
        } else {
            console.log("ℹ️ [Supply Cache] No supply cache found in cloud. Keeping local/default cache.");
        }
    } catch (e) {
        console.error("⚠️ [Supply Cache] Exception during cloud restore:", e.message);
    }
};

const readCache = () => {
    try {
        if (fs.existsSync(cachePath)) {
            return JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        }
    } catch (e) {
        console.error('Error reading supply cache:', e.message);
    }
    return defaultCache;
};

const writeCache = (data) => {
    try {
        fs.writeFileSync(cachePath, JSON.stringify(data, null, 2), 'utf8');

        // Supabase 클라우드 백업 (비동기로 실행해 지연 방지)
        if (supabase) {
            supabase.from('stock_detail_cache')
                .upsert({
                    symbol: '__SUPPLY__',
                    fundamental: data,
                    advanced: {},
                    updated_at: new Date().toISOString()
                }, { onConflict: 'symbol' })
                .then(({ error }) => {
                    if (error) {
                        console.error("⚠️ [Supply Cache] Cloud backup failed:", error.message);
                    } else {
                        console.log("💾 [Supply Cache] Cloud backup succeeded.");
                    }
                })
                .catch(err => {
                    console.error("⚠️ [Supply Cache] Exception during cloud backup:", err.message);
                });
        }
    } catch (e) {
        console.error('Error writing supply cache:', e.message);
    }
};

export const getSupplyCache = (key) => {
    const cache = readCache();
    return cache[key] || defaultCache[key];
};

export const saveSupplyCache = (key, data) => {
    const cache = readCache();
    cache[key] = data;
    writeCache(cache);
};
