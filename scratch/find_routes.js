import fs from 'fs';
const content = fs.readFileSync('routes/aiApi.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
    if (line.includes('syncSingleStock')) {
        console.log(`${idx + 1}: ${line.trim()}`);
    }
});
