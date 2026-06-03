import fs from 'fs';

const content = fs.readFileSync('routes/aiApi.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('selectionRaw')) {
    console.log(`Line ${i + 1}: ${line}`);
  }
});
