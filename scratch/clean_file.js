import fs from 'fs';

try {
    const raw = fs.readFileSync('routes/aiApi.js');
    // Read as string (which handles invalid bytes by replacing them with \uFFFD)
    const cleanStr = raw.toString('utf8');
    // Write it back as a clean UTF-8 file
    fs.writeFileSync('routes/aiApi.js', cleanStr, 'utf8');
    console.log("File re-saved as clean UTF-8.");
} catch (e) {
    console.error(e);
}
