import fs from 'fs';

const content = fs.readFileSync('routes/aiApi.js', 'utf8');
const lines = content.split('\n');
console.log('--- Lines 285-305 ---');
console.log(lines.slice(284, 305).join('\n'));
console.log('--- Lines 345-365 ---');
console.log(lines.slice(344, 365).join('\n'));
