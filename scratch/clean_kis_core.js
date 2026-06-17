import fs from 'fs';

try {
    const raw = fs.readFileSync('lib/kisCore.js');
    const cleanStr = raw.toString('utf8');
    fs.writeFileSync('lib/kisCore.js', cleanStr, 'utf8');
    console.log("lib/kisCore.js re-saved as clean UTF-8.");
} catch (e) {
    console.error(e);
}
