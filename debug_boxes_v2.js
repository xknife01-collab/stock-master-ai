import axios from 'axios';
import iconv from 'iconv-lite';
import * as cheerio from 'cheerio';

async function checkBoxes() {
    try {
        console.log('Fetching...');
        const res = await axios.get('https://finance.naver.com/sise/', { responseType: 'arraybuffer' });
        console.log('Status:', res.status);
        console.log('Bytes:', res.data.length);
        const html = iconv.decode(res.data, 'EUC-KR');
        const $ = cheerio.load(html);
        const boxes = $('#contentarea_left .box_type_m');
        console.log('Boxes count:', boxes.length);
        boxes.each((i, el) => {
            const rowText = $(el).find('tr a').first().text().trim();
            console.log(`Box ${i} first link text:`, rowText);
        });
    } catch (e) { console.error('Error:', e.message); }
}
checkBoxes();
