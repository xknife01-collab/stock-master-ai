import fs from 'fs';

const content = fs.readFileSync('routes/aiApi.js', 'utf8');
const lines = content.split('\n');
const results = [];
lines.forEach((line, i) => {
  if (line.includes('correctStockSymbol')) {
    results.push({ line: i + 1, content: line.trim() });
  }
});
console.log('Occurrences of correctStockSymbol:', JSON.stringify(results, null, 2));
