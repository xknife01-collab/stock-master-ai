import fs from 'fs';

const content = fs.readFileSync('src/components/AI/AISignalSection.jsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('time') || line.includes('Date') || line.includes('Format') || line.includes('오후') || line.includes('오전')) {
    console.log(`Line ${i + 1}: ${line.trim()}`);
  }
});
