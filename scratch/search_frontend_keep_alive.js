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

walkDir('src', filePath => {
  if (filePath.endsWith('.js') || filePath.endsWith('.jsx') || filePath.endsWith('.html')) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, i) => {
      if (line.includes('ping') || line.includes('keep') || line.includes('pulse') || line.includes('interval') || line.includes('wake') || line.includes('5000')) {
        console.log(`[${filePath}] Line ${i + 1}: ${line.trim()}`);
      }
    });
  }
});
