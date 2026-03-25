import axios from 'axios';
import iconv from 'iconv-lite';
import * as cheerio from 'cheerio';

async function checkBoxes() {
    try {
        const res = await axios.get('https://finance.naver.com/sise/', { responseType: 'arraybuffer' });
        const html = iconv.decode(res.data, 'EUC-KR');
        const $ = cheerio.load(html);
        $('#contentarea_left .box_type_m').each((i, el) => {
            const title = $(el).find('h3, th.h3').text().trim();
            console.log(`Box ${i} title:`, title);
            const firstRow = $(el).find('tr td a').first().text().trim();
            console.log(`Box ${i} first item:`, firstRow);
        });
    } catch (e) { console.error(e.message); }
}
checkBoxes();
