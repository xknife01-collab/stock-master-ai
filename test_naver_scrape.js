import axios from 'axios';
import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';

async function testScrape() {
    try {
        const res = await axios.get('https://finance.naver.com/sise/sise_group.naver?type=upjong', { responseType: 'arraybuffer' });
        const html = iconv.decode(res.data, 'EUC-KR');
        const $ = cheerio.load(html);
        const name = $('table.type_1 tr td a').first().text().trim();
        console.log('Sample Sector Name:', name);
    } catch (e) {
        console.error('Scrape Failed:', e.message);
    }
}
testScrape();
