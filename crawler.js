import axios from 'axios';
import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';

async function testFetch() {
  try {
    const response = await axios.get('https://finance.naver.com/sise/', { responseType: 'arraybuffer' });
    const decoded = iconv.decode(response.data, 'EUC-KR');
    const $ = cheerio.load(decoded);
    
    // Top 상한가
    const topStocks = [];
    $('#siselist_tab_0 tbody tr').each((i, el) => {
      const name = $(el).find('.tltle').text();
      const num = $(el).find('.num').eq(0).text();
      if(name) topStocks.push({ name, price: num });
    });
    console.log('Top:', topStocks.slice(0,5));

    // 외국인 순매수
    const foreign = [];
    $('.frgn_deal .box_type_m').eq(0).find('tbody tr').each((i, el) => {
      const name = $(el).find('.tltle').text();
      const num = $(el).find('.num').eq(0).text();
      if(name) foreign.push({ name, num });
    });
    console.log('Foreign:', foreign.slice(0,5));

  } catch(e) {
    console.error(e);
  }
}
testFetch();
