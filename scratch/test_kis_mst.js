import fs from 'fs';
import path from 'path';
import iconv from 'iconv-lite';

const __dirname = path.resolve();

async function run() {
    const tmpDir = path.join(__dirname, 'tmp_mst');
    const targets = [
        { name: 'KOSPI', file: 'kospi_code.mst' },
        { name: 'KOSDAQ', file: 'kosdaq_code.mst' }
    ];

    const stockMap = {};

    for (const target of targets) {
        const mstFile = path.join(tmpDir, target.file);
        if (!fs.existsSync(mstFile)) {
            console.error(`File not found: ${target.file}`);
            continue;
        }

        const buffer = fs.readFileSync(mstFile);
        let recordLength = 0;
        for (let i = 0; i < buffer.length; i++) {
            if (buffer[i] === 0x0a) {
                recordLength = i + 1;
                break;
            }
        }
        console.log(`${target.name} Detected Record Byte Length:`, recordLength);

        let count = 0;
        for (let offset = 0; offset < buffer.length; offset += recordLength) {
            if (offset + recordLength > buffer.length) break;
            
            const record = buffer.slice(offset, offset + recordLength);
            
            // Slice by byte index:
            // Code: bytes 0 to 9
            // StdCode: bytes 9 to 21
            // Name: bytes 21 to 61 (40 bytes length)
            const codeBuf = record.slice(0, 9);
            const stdCodeBuf = record.slice(9, 21);
            const nameBuf = record.slice(21, 61);

            const code = iconv.decode(codeBuf, 'cp949').trim();
            const stdCode = iconv.decode(stdCodeBuf, 'cp949').trim();
            const name = iconv.decode(nameBuf, 'cp949').trim();

            if (code.length === 6 && /^\d+$/.test(code)) {
                stockMap[name] = code;
                count++;
            }
        }
        console.log(`Parsed ${count} stocks from ${target.name}.`);
    }

    console.log('Total domestic stocks parsed:', Object.keys(stockMap).length);
    console.log('Sample stock entries:');
    const samples = ['삼성전자', 'SK하이닉스', '한미반도체', '이수페타시스', 'HPSP', '리노공업', '테크윙'];
    for (const s of samples) {
        console.log(`${s} -> ${stockMap[s] || 'NOT FOUND'}`);
    }
}

run().catch(console.error);
