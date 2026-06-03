import fs from 'fs';

const content = fs.readFileSync('routes/aiApi.js', 'utf8');
const lines = content.split('\n');
console.log(lines.slice(1240, 1400).join('\n'));
