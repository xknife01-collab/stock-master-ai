import fs from 'fs';

const content = fs.readFileSync('routes/aiApi.js', 'utf8');
const lines = content.split('\n');
const results = [];
lines.forEach((line, i) => {
  if (line.includes('fetchMarketRankings') || line.includes('fetchConditionResult') || line.includes('parseSupplyStocks')) {
    results.push({ line: i + 1, content: line.trim() });
  }
});
console.log('Ingestion occurrences:', JSON.stringify(results, null, 2));
