import fs from 'fs';
import * as cheerio from 'cheerio';

function parse() {
    try {
        const html = fs.readFileSync('naver_sise.html', 'utf8');
        const $ = cheerio.load(html);
        
        // KOSPI
        const kospiVal = $('#kospi_now').text().trim();
        const kospiChange = $('#kospi_change').text().trim();
        
        // KOSDAQ
        const kosdaqVal = $('#kosdaq_now').text().trim();
        const kosdaqChange = $('#kosdaq_change').text().trim();

        // KOSPI200
        const kpi200Val = $('#kospi200_now').text().trim();
        const kpi200Change = $('#kospi200_change').text().trim();

        console.log({
            kospi: { val: kospiVal, change: kospiChange },
            kosdaq: { val: kosdaqVal, change: kosdaqChange },
            kospi200: { val: kpi200Val, change: kpi200Change }
        });
    } catch (e) {
        console.error('Parse failed:', e.message);
    }
}
parse();
