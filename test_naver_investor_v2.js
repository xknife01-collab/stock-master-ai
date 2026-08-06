import axios from 'axios';
import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';

async function testInvestor() {
    try {
        const res = await axios.get('https://finance.naver.com/sise/sise_deal_rank.naver?investor_gubun=9000', { responseType: 'arraybuffer' });
        const html = iconv.decode(res.data, 'EUC-KR');
        const $ = cheerio.load(html);
        console.log('Tables type_r1 count:', $('table.type_r1').length);
        $('table.type_r1').each((idx, table) => {
            console.log(`Table ${idx} Rows:`, $(table).find('tr').length);
            $(table).find('tr').each((i, tr) => {
               const name = $(tr).find('td.name a').text().trim();
               if(name) console.log('Row Name:', name);
            });
        });
    } catch (e) { console.error(e.message); }
}
testInvestor();
