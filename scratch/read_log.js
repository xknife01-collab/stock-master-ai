import fs from 'fs';
import path from 'path';

try {
    const logPath = path.resolve('c:/Users/zkfnt/Desktop/stock ai/stock/backend_server.log');
    if (fs.existsSync(logPath)) {
        // Let's try reading as buffer first, detect UTF-8 or UTF-16
        const buffer = fs.readFileSync(logPath);
        // check BOM
        let encoding = 'utf8';
        if (buffer[0] === 0xff && buffer[1] === 0xfe) {
            encoding = 'utf16le';
        } else if (buffer[0] === 0xfe && buffer[1] === 0xff) {
            encoding = 'utf16be';
        }
        console.log(`Detected encoding: ${encoding}`);
        const content = buffer.toString(encoding);
        const lines = content.split('\n');
        console.log(`Total lines: ${lines.length}`);
        
        // Search for crashes, exit, or uncaught exception
        console.log("\n--- Searching for crash/error/exception traces ---");
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.toLowerCase().includes('error') || 
                line.toLowerCase().includes('exception') || 
                line.toLowerCase().includes('failed') || 
                line.toLowerCase().includes('node') ||
                line.toLowerCase().includes('exit') || 
                line.toLowerCase().includes('crash') || 
                line.toLowerCase().includes('throw')) {
                // print line with its line number
                console.log(`Line ${i+1}: ${line.trim()}`);
            }
        }
        
        console.log("\nLast 100 lines:");
        console.log(lines.slice(-100).join('\n'));
    } else {
        console.log("File does not exist at " + logPath);
    }
} catch (e) {
    console.error(e);
}
