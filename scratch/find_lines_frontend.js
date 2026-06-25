import fs from 'fs';
import path from 'path';

const file = 'c:/Users/zkfnt/Desktop/stock ai/stock/src/components/AI/AISignalSection.jsx';
const content = fs.readFileSync(file, 'utf8');
const lines = content.split('\n');

lines.forEach((line, index) => {
    if (line.includes('getStatusBadge') || line.includes('vetoReason')) {
        console.log(`Line ${index + 1}: ${line}`);
    }
});
