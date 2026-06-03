import fs from 'fs';
import path from 'path';

const brainDir = 'C:\\Users\\zkfnt\\.gemini\\antigravity\\brain';
if (fs.existsSync(brainDir)) {
  fs.readdirSync(brainDir).forEach(convId => {
    const logDir = path.join(brainDir, convId, '.system_generated', 'logs');
    if (fs.existsSync(logDir)) {
      const overviewFile = path.join(logDir, 'overview.txt');
      if (fs.existsSync(overviewFile)) {
        const content = fs.readFileSync(overviewFile, 'utf8');
        if (content.includes('잠') || content.includes('keep') || content.includes('ping') || content.includes('sleep') || content.includes('cron-job')) {
          console.log(`[Conversation Log: ${convId}] Found sleep/keep-alive references!`);
          // Print matching snippets
          const lines = content.split('\n');
          lines.forEach(line => {
            if (line.includes('잠') || line.includes('keep') || line.includes('ping') || line.includes('sleep')) {
              console.log('   ->', line.trim().slice(0, 150));
            }
          });
        }
      }
    }
  });
} else {
  console.log('Brain directory does not exist!');
}
