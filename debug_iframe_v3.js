import axios from 'axios';
import iconv from 'iconv-lite';
import * as cheerio from 'cheerio';

async function testIframe() {
    try {
        const url = 'https://finance.naver.com/sise/sise_deal_rank_iframe.naver?sosok=01&investor_gubun=9000&type=buy';
        const res = await axios.get(url, { responseType: 'arraybuffer' });
        const html = iconv.decode(res.data, 'EUC-KR');
        const $ = cheerio.load(html);
        console.log('--- TABLE 0 Snippet ---');
        console.log($('table').eq(0).text().trim().substring(0, 500));
        console.log('--- TABLE 1 Snippet ---');
        console.log($('table').eq(1).text().trim().substring(0, 500));
    } catch (e) { console.error(e.message); }
}
testIframe();
