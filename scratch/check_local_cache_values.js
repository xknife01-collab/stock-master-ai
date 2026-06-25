import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const aiCachePath = path.join(__dirname, '../ai_cache.json');

console.log("aiCachePath exists:", fs.existsSync(aiCachePath));
if (fs.existsSync(aiCachePath)) {
    const content = JSON.parse(fs.readFileSync(aiCachePath, 'utf8'));
    console.log("Local cache keys:", Object.keys(content));
    console.log("tenMinKey:", content.tenMinKey);
    console.log("halfHourKey:", content.halfHourKey);
    console.log("hourKey:", content.hourKey);
    console.log("pulse theme:", content.pulse ? content.pulse.theme : null);
}
