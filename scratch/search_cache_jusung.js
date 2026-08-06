import fs from 'fs';

try {
    const data = fs.readFileSync('ai_cache.json', 'utf8');
    const parsed = JSON.parse(data);
    console.log("ai_cache.json keys:", Object.keys(parsed));
    
    // Check if there is data.pulse or pulse or data
    const pulse = parsed.data?.pulse || parsed.pulse || parsed.data;
    console.log("pulse keys:", Object.keys(pulse || {}));
    
    const candidates = pulse?.data?.candidates || pulse?.candidates || [];
    console.log("Number of candidates in ai_cache:", candidates.length);
    
    // Let's print all names and codes in candidates
    candidates.forEach((c, idx) => {
        if (c.name?.includes('주성') || c.code === '036930') {
            console.log(`Found candidate at index ${idx}:`, JSON.stringify(c, null, 2));
        }
    });

    // Let's search the whole JSON string for '036930'
    const index = data.indexOf('036930');
    if (index !== -1) {
        console.log(`\n'036930' found at string index ${index}. Let's show surrounding text:`);
        console.log(data.slice(Math.max(0, index - 200), Math.min(data.length, index + 300)));
    } else {
        console.log("\nTicker '036930' not found in raw ai_cache.json string.");
    }
} catch (e) {
    console.error("Error:", e.message);
}
