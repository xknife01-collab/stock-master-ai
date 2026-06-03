import fs from 'fs';
import path from 'path';

const file = JSON.parse(fs.readFileSync('rag_diary.json', 'utf8'));
const results = [];
file.forEach((entry, i) => {
  if (entry.prediction && entry.prediction.stock === '주성엔지니어링') {
    results.push({ index: i, type: 'prediction', date: entry.time, data: entry.prediction });
  }
  if (entry.shortTermPicks) {
    entry.shortTermPicks.forEach(p => {
      if (p.n === '주성엔지니어링') {
        results.push({ index: i, type: 'shortTerm', date: entry.time, data: p });
      }
    });
  }
  if (entry.longTermPicks) {
    entry.longTermPicks.forEach(p => {
      if (p.n === '주성엔지니어링') {
        results.push({ index: i, type: 'longTerm', date: entry.time, data: p });
      }
    });
  }
});
console.log('Search results in rag_diary.json:', JSON.stringify(results, null, 2));
