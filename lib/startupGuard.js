import { fetchStockFullDetailFromKIS } from './kisCore.js';

export async function runStartupGuard() {
    console.log("🛡️ [Startup Guard] Initiating KIS API and Data Integrity self-test...");
    try {
        // Test with Samsung Electronics (005930)
        const testSymbol = '005930';
        const result = await fetchStockFullDetailFromKIS(testSymbol);
        
        if (result && result.fundamental && result.advanced) {
            console.log("✅ [Startup Guard] Integrity self-test passed! KIS API and schemas are fully operational.");
            process.env.SAFE_CACHE_FREEZE = 'false';
            return true;
        } else {
            throw new Error("Empty or malformed result object returned.");
        }
    } catch (e) {
        console.error("\n======================================================================");
        console.error("🚨 [Startup Guard] KIS API SCHEMA DRIFT / INTEGRITY FAILURE DETECTED!");
        console.error(`🚨 Detailed Error: ${e.message}`);
        console.error("🚨 ACTION: Freezing all database cache updates to protect history!");
        console.error("🚨 The system will continue to serve stable historical cached data.");
        console.error("======================================================================\n");
        process.env.SAFE_CACHE_FREEZE = 'true';
        return false;
    }
}
