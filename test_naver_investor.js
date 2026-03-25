import axios from 'axios';
import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';

async function testInvestor() {
    try {
        const res = await axios.get('https://finance.naver.com/sise/sise_deal_rank.naver?investor_gubun=9000', { responseType: 'arraybuffer' });
        const html = iconv.decode(res.data, 'EUC-KR');
        const $ = cheerio.load(html);
        console.log('Tables count:', $('table.type_5').length);
        $('table.type_5').each((idx, table) => {
            console.log(`Table ${idx} Rows:`, $(table).find('tr').length);
            const firstRowName = $(table).find('tr td.name a').first().text().trim();
            console.log(`Table ${idx} First Name:`, firstRowName);
        });
    } catch (e) { console.error(e.message); }
}
testInvestor();
