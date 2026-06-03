import fs from 'fs';

const content = fs.readFileSync('rag_diary.json', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('036220')) {
    console.log(`Line ${i + 1}: ${line}`);
  }
});
