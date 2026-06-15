import { fetchStockFullDetailFromKIS } from './kisCore.js';
import supabase from './supabaseClient.js';

async function updateStatusInDB(status, details = '') {
    if (!supabase) return;
    try {
        const payload = {
            status,
            updatedAt: new Date().toISOString(),
            details
        };
        const { error } = await supabase
            .from('stock_master_map')
            .upsert({ name: '__kis_status__', code: JSON.stringify(payload) }, { onConflict: 'name' });
        
        if (error) {
            console.error('❌ [Startup Guard] Failed to write shared status to DB:', error.message);
        } else {
            console.log(`💾 [Startup Guard] Shared KIS status updated to DB: ${status}`);
        }
    } catch (dbErr) {
        console.error('⚠️ [Startup Guard] Exception writing status to DB:', dbErr.message);
    }
}

export async function runStartupGuard() {
    console.log("🛡️ [Startup Guard] Initiating KIS API and Data Integrity self-test...");
    try {
        // Test with Samsung Electronics (005930)
        const testSymbol = '005930';
        const result = await fetchStockFullDetailFromKIS(testSymbol);
        
        if (result && result.fundamental && result.advanced) {
            console.log("✅ [Startup Guard] Integrity self-test passed! KIS API and schemas are fully operational.");
            process.env.SAFE_CACHE_FREEZE = 'false';
            await updateStatusInDB('connected');
            return true;
        } else {
            throw new Error("Empty or malformed result object returned.");
        }
    } catch (e) {
        if (e.message.includes('[Network Error]') || e.message.includes('[KIS API Error]')) {
            console.warn(`⚠️ [Startup Guard] KIS API temporary network error detected: ${e.message}`);
            console.warn("⚠️ [Startup Guard] Leaving cache active (SAFE_CACHE_FREEZE = false) to recover when network stabilizes.");
            process.env.SAFE_CACHE_FREEZE = 'false';
            await updateStatusInDB('disconnected', `Temporary network error: ${e.message}`);
            return false;
        }

        console.error("\n======================================================================");
        console.error("🚨 [Startup Guard] KIS API SCHEMA DRIFT / INTEGRITY FAILURE DETECTED!");
        console.error(`🚨 Detailed Error: ${e.message}`);
        console.error("🚨 ACTION: Freezing all database cache updates to protect history!");
        console.error("🚨 The system will continue to serve stable historical cached data.");
        console.error("======================================================================\n");
        process.env.SAFE_CACHE_FREEZE = 'true';
        await updateStatusInDB('disconnected', `Schema Drift / Integrity Failure: ${e.message}`);
        return false;
    }
}

let daemonStarted = false;

export function startStartupGuardDaemon() {
    if (daemonStarted) return;
    daemonStarted = true;
    
    console.log("🚀 [Startup Guard] Reconnection and Health Check Daemon started (5-minute interval).");
    
    setInterval(async () => {
        console.log("🔄 [Startup Guard Heartbeat] Verifying KIS API connection status...");
        try {
            const testSymbol = '005930';
            const result = await fetchStockFullDetailFromKIS(testSymbol);
            if (result && result.fundamental && result.advanced) {
                if (process.env.SAFE_CACHE_FREEZE === 'true') {
                    console.log("✅ [Startup Guard Heartbeat] KIS API connection restored! Unfreezing cache database updates.");
                }
                process.env.SAFE_CACHE_FREEZE = 'false';
                await updateStatusInDB('connected');
            }
        } catch (e) {
            if (e.message.includes('[Network Error]') || e.message.includes('[KIS API Error]')) {
                console.warn(`⚠️ [Startup Guard Heartbeat] Connection check failed (temporary error): ${e.message}`);
                await updateStatusInDB('disconnected', `Temporary network error: ${e.message}`);
            } else {
                console.error(`🚨 [Startup Guard Heartbeat] Real Schema drift detected in background check: ${e.message}`);
                process.env.SAFE_CACHE_FREEZE = 'true';
                await updateStatusInDB('disconnected', `Schema Drift / Integrity Failure: ${e.message}`);
            }
        }
    }, 5 * 60 * 1000); // 5 minutes
}

