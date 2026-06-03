import fs from 'fs';

const content = fs.readFileSync('src/App.jsx', 'utf8');
const lines = content.split('\n');
let start = -1;
let end = -1;
lines.forEach((line, i) => {
  if (line.includes('const fetchData =')) {
    start = i;
  }
  if (start !== -1 && end === -1 && line.trim() === '};' && i > start) {
    end = i;
  }
});

if (start !== -1 && end !== -1) {
  console.log(lines.slice(start, end + 1).join('\n'));
} else {
  console.log('fetchData not found or incomplete. Printing surrounding lines:');
  const pulseIndex = lines.findIndex(l => l.includes('pulse'));
  if (pulseIndex !== -1) {
    console.log(lines.slice(pulseIndex - 20, pulseIndex + 20).join('\n'));
  }
}
