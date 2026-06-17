import { runStartupGuard } from '../lib/startupGuard.js';

async function test() {
    console.log("Starting runStartupGuard test...");
    
    // Clear freeze state to test if guard sets it
    process.env.SAFE_CACHE_FREEZE = 'false';
    
    const result = await runStartupGuard();
    
    console.log("\n--- TEST RESULT ---");
    console.log("runStartupGuard returned:", result);
    console.log("SAFE_CACHE_FREEZE is now:", process.env.SAFE_CACHE_FREEZE);
    console.log("-------------------");
    
    process.exit(0);
}

test().catch(e => {
    console.error(e);
    process.exit(1);
});
