import fs from 'fs';
import path from 'path';

const brainDir = 'C:\\Users\\zkfnt\\.gemini\\antigravity\\brain';
fs.readdirSync(brainDir).forEach(convId => {
  const overviewFile = path.join(brainDir, convId, '.system_generated', 'logs', 'overview.txt');
  if (fs.existsSync(overviewFile)) {
    const content = fs.readFileSync(overviewFile, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      if (line.includes('MODEL') && (line.includes('잠') || line.includes('keep') || line.includes('ping') || line.includes('sleep'))) {
        try {
          const obj = JSON.parse(line);
          if (obj.content && (obj.content.includes('잠') || obj.content.includes('keep') || obj.content.includes('ping') || obj.content.includes('sleep'))) {
             console.log(`[${convId}] [Line ${idx}]:`, obj.content.slice(0, 400));
          }
        } catch(e) {}
      }
    });
  }
});
