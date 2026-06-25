import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cachePath = path.join(__dirname, '../ai_cache.json');

function run() {
    if (!fs.existsSync(cachePath)) {
        console.error("Cache file does not exist.");
        return;
    }
    const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    const candidates = cache.pulse?.candidates || cache.pulse?.data?.candidates || [];
    console.log(`Total Candidates: ${candidates.length}`);
    
    const sorted = [...candidates].sort((a, b) => b.totalScore - a.totalScore);
    console.log("\n--- CANDIDATE RANKING IN CACHE ---");
    sorted.forEach((c, idx) => {
        console.log(`${idx + 1}. ${c.name} (${c.code}) | Score: ${c.totalScore} | Vetoed: ${c.isVetoed} | Veto Reason: ${c.vetoReason || 'None'} | Transaction Value: ${c.metrics?.transactionValue?.toLocaleString()} KRW | Strength: ${c.metrics?.strength}%`);
    });
}

run();
