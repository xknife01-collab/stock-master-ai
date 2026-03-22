import axios from 'axios';
import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';

async function testFetch() {
  try {
    const res = await axios.get('https://finance.naver.com/sise/', { responseType: 'arraybuffer' });
    const $ = cheerio.load(iconv.decode(res.data, 'EUC-KR'));
    
    // Top Gainers
    const topStocks = [];
    $('#siselist_tab_0 tbody tr').each((i, el) => {
      const texts = $(el).find('td').map((i, td) => $(td).text().trim()).get();
      if(texts.length > 5 && texts[3]) {
        topStocks.push({ name: texts[3], price: texts[4], diff: texts[5], pct: texts[6], vol: texts[8] });
      }
    });

    // Foreign
    const foreign = [];
    $('#frgn_deal_0 tbody tr').each((i, el) => {
      const name = $(el).find('td').eq(0).text().trim();
      const price = $(el).find('td').eq(1).text().trim();
      const diff = $(el).find('td').eq(2).text().trim();
      if(name) foreign.push({ name, price, diff });
    });

    console.log('Top:', topStocks.slice(0,3));
    console.log('Foreign:', foreign.slice(0,3));
  } catch(e) {
    console.error(e);
  }
}
testFetch();
