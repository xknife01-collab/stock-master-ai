import fs from 'fs';
import path from 'path';

const overviewFile = 'C:\\Users\\zkfnt\\.gemini\\antigravity\\brain\\cdcdef6e-6162-4006-852c-f59c7f107441\\.system_generated\\logs\\overview.txt';
if (fs.existsSync(overviewFile)) {
  const content = fs.readFileSync(overviewFile, 'utf8');
  const lines = content.split('\n');
  lines.forEach(line => {
    if (line.includes('write_to_file') && (line.includes('keepAlive') || line.includes('keep-alive') || line.includes('prevent') || line.includes('ping') || line.includes('sleep'))) {
      console.log('Match cdcdef6e:', line.slice(0, 300));
    }
  });
}

const overviewFile2 = 'C:\\Users\\zkfnt\\.gemini\\antigravity\\brain\\c860e2e2-e22b-4510-b019-9fcdec4d9d81\\.system_generated\\logs\\overview.txt';
if (fs.existsSync(overviewFile2)) {
  const content = fs.readFileSync(overviewFile2, 'utf8');
  const lines = content.split('\n');
  lines.forEach(line => {
    if (line.includes('write_to_file') && (line.includes('keepAlive') || line.includes('keep-alive') || line.includes('prevent') || line.includes('ping') || line.includes('sleep'))) {
      console.log('Match c860e2e2:', line.slice(0, 300));
    }
  });
}
