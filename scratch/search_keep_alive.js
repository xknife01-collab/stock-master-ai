import fs from 'fs';
import path from 'path';

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      if (f !== 'node_modules' && f !== '.git' && f !== '.next' && f !== 'dist') {
        walkDir(dirPath, callback);
      }
    } else {
      callback(dirPath);
    }
  });
}

walkDir('.', filePath => {
  if (filePath.endsWith('.js') || filePath.endsWith('.json') || filePath.endsWith('.yml')) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, i) => {
      if (line.includes('keepAlive') || line.includes('keep-alive') || line.includes('preventSleep') || line.includes('sleep') || line.includes('wake') || line.includes('cron-job') || line.includes('ping')) {
        console.log(`[${filePath}] Line ${i + 1}: ${line.trim()}`);
      }
    });
  }
});
