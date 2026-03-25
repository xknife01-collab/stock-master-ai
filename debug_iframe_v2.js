import axios from 'axios';
import iconv from 'iconv-lite';
import * as cheerio from 'cheerio';

async function testIframe() {
    try {
        const url = 'https://finance.naver.com/sise/sise_deal_rank_iframe.naver?sosok=01&investor_gubun=9000&type=buy';
        const res = await axios.get(url, { responseType: 'arraybuffer' });
        const html = iconv.decode(res.data, 'EUC-KR');
        console.log('HTML Start:', html.substring(0, 1000));
        const $ = cheerio.load(html);
        console.log('--- ALL TABLES ---');
        $('table').each((i, el) => {
            console.log(`Table ${i} class:`, $(el).attr('class'));
        });
    } catch (e) { console.error(e.message); }
}
testIframe();
