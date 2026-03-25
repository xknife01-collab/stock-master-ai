import axios from 'axios';
import iconv from 'iconv-lite';
import * as cheerio from 'cheerio';

async function testIframe() {
    try {
        const url = 'https://finance.naver.com/sise/sise_deal_rank_iframe.naver?sosok=01&investor_gubun=9000&type=buy';
        const res = await axios.get(url, { responseType: 'arraybuffer' });
        const html = iconv.decode(res.data, 'EUC-KR');
        const $ = cheerio.load(html);
        console.log('HTML Length:', html.length);
        console.log('Table exists:', $('table.type_5').length);
        console.log('Rows count:', $('table.type_5 tr').length);
        $('table.type_5 tr').each((i, el) => {
            console.log(`Row ${i} Text:`, $(el).text().trim());
        });
    } catch (e) { console.error(e.message); }
}
testIframe();
