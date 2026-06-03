import fs from 'fs';

const content = fs.readFileSync('routes/aiApi.js', 'utf8');
const lines = content.split('\n');
const results = [];
lines.forEach((line, i) => {
  if (line.includes('candidates') && (line.includes('JSON') || line.includes('s":') || line.includes('c":'))) {
    results.push({ line: i + 1, content: line.trim() });
  }
});
console.log('Prompt structures found:', JSON.stringify(results, null, 2));
