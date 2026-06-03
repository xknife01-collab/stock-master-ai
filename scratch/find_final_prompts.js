import fs from 'fs';

const content = fs.readFileSync('routes/aiApi.js', 'utf8');
const lines = content.split('\n');
const results = [];
lines.forEach((line, i) => {
  if (line.includes('shortTermPicks') && (line.includes('output') || line.includes('양식') || line.includes('Format') || line.includes('JSON'))) {
    results.push({ line: i + 1, content: line.trim() });
  }
});
console.log('Final prompt formats:', JSON.stringify(results, null, 2));
