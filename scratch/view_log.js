import fs from 'fs';
import path from 'path';

const logPath = 'C:\\Users\\zkfnt\\.gemini\\antigravity\\brain\\3c868268-8e43-4002-938f-c009b5c3cfed\\.system_generated\\logs\\overview.txt';

try {
    const data = fs.readFileSync(logPath, 'utf8');
    const lines = data.split('\n');
    console.log(`Read ${lines.length} lines.`);
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('"step_index":743')) {
            console.log(`--- Match at line ${i} ---`);
            const parsed = JSON.parse(line);
            const calls = parsed.tool_calls;
            if (calls) {
                const writeCall = calls.find(tc => tc.name === 'write_to_file');
                if (writeCall) {
                    let code = writeCall.args.CodeContent;
                    
                    // Simple replacement of escape sequences
                    if (code.startsWith('"')) {
                        code = code.slice(1, -1);
                    }
                    code = code.replace(/\\r\\n/g, '\n')
                               .replace(/\\n/g, '\n')
                               .replace(/\\"/g, '"')
                               .replace(/\\\\/g, '\\');
                               
                    fs.writeFileSync('scratch/test_realtime_stress.js', code, 'utf8');
                    console.log('Successfully wrote the restored clean test script to scratch/test_realtime_stress.js');
                    break;
                }
            }
        }
    }
} catch (err) {
    console.error(err);
}
