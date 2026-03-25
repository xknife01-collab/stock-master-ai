const axios = require('axios');
const iconv = require('iconv-lite');
const cheerio = require('cheerio');

async function check(investor, type) {
    try {
        const url = `https://finance.naver.com/sise/sise_deal_rank_iframe.naver?sosok=01&investor_gubun=${investor}&type=${type}`;
        const res = await axios.get(url, { responseType: 'arraybuffer' });
        const html = iconv.decode(res.data, 'EUC-KR');
        const $ = cheerio.load(html);
        
        console.log(`\n--- Verification for Investor ${investor} (${type}) ---`);
        $('table.type_1').each((i, table) => {
            const first = $(table).find('tr a').first().text().trim();
            if (first) {
                console.log(`Table ${i} First Item: ${first}`);
            }
        });
    } catch (e) {
        console.error(e);
    }
}

async function runAll() {
    await check('9000', 'buy');
    await check('1000', 'buy');
}

runAll();
