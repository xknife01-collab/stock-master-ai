import axios from 'axios';
import iconv from 'iconv-lite';
import * as cheerio from 'cheerio';

async function checkBoxes() {
    try {
        const res = await axios.get('https://finance.naver.com/sise/', { responseType: 'arraybuffer' });
        const html = iconv.decode(res.data, 'EUC-KR');
        const $ = cheerio.load(html);
        console.log('--- ALL CLASS .box_type_m ---');
        $('.box_type_m').each((i, el) => {
            console.log(`Box ${i} title:`, $(el).find('h3, th.h3').text().trim());
        });
        console.log('--- TOP 10 ID/CLASS ---');
        $('*').each((i, el) => {
           if (i < 100 && $(el).attr('class')) {
              // console.log($(el).attr('class'));
           }
        });
    } catch (e) { console.error(e.message); }
}
checkBoxes();
