import fs from 'fs';
import iconv from 'iconv-lite';

try {
    const raw = fs.readFileSync('routes/aiApi.js');
    console.log("File length:", raw.length);
    // Let's test decoding with CP949 and UTF-8
    const utf8Str = raw.toString('utf8');
    const cp949Str = iconv.decode(raw, 'cp949');
    
    // Check if there are replacement characters in UTF-8
    const utf8HasReplacement = utf8Str.includes('\uFFFD');
    const cp949HasReplacement = cp949Str.includes('\uFFFD');
    
    console.log("UTF-8 has replacement characters:", utf8HasReplacement);
    console.log("CP949 has replacement characters:", cp949HasReplacement);
    
    // Let's check first 300 chars of each
    console.log("\n--- UTF-8 first 300 chars ---");
    console.log(utf8Str.substring(0, 300));
    
    console.log("\n--- CP949 first 300 chars ---");
    console.log(cp949Str.substring(0, 300));
} catch (e) {
    console.error(e);
}
