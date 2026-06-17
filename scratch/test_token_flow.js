import dotenv from 'dotenv';
dotenv.config();
import { getAccessToken, clearLocalTokenCache, invalidateSharedToken } from '../lib/kisCore.js';

(async () => {
    console.log("Memory Token before test:", await getAccessToken());
    
    // Clear and invalidate to simulate expired token
    console.log("Invalidating token...");
    await invalidateSharedToken();
    
    console.log("Memory Token after invalidation:", await getAccessToken());
    
    // Fetch again
    const token1 = await getAccessToken();
    console.log("Token 1 fetched:", token1);
    
    const token2 = await getAccessToken();
    console.log("Token 2 fetched (should be identical to Token 1):", token2);
    
    console.log("Match:", token1 === token2);
})();
