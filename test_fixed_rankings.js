import axios from 'axios';
import iconv from 'iconv-lite';
import * as cheerio from 'cheerio';

async function fetchRankings(investor, type) {
    try {
        const url = `https://finance.naver.com/sise/sise_deal_rank_iframe.naver?sosok=01&investor_gubun=${investor}&type=${type}`;
        const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 3000 });
        const html = iconv.decode(res.data, 'EUC-KR');
        const $ = cheerio.load(html);
        const results = [];
        
        $('table.type_1').last().find('tr').each((i, el) => {
            const nameEl = $(el).find('td a');
            if (nameEl.length > 0) {
                const name = nameEl.text().trim();
                const code = (nameEl.attr('href') || '').split('code=')[1];
                const amount = $(el).find('td').eq(2).text().trim(); // 금액 (Amount)
                const vol = $(el).find('td').eq(1).text().trim(); // 수량 (Volume)
                results.push({
                    num: results.length + 1,
                    name,
                    symbol: code,
                    price: amount + '백만',
                    diff: vol,
                    isUp: type === 'buy'
                });
            }
        });
        return results.slice(0, 10);
    } catch (e) { 
        return []; 
    }
};

async function main() {
    for (const inv of ['9000', '1000']) {
        for (const type of ['buy', 'sell']) {
            console.log(`--- ${inv === '9000' ? 'Foreign' : 'Inst'} ${type.toUpperCase()} ---`);
            const res = await fetchRankings(inv, type);
            res.forEach(it => console.log(`${it.num}. ${it.name} (${it.price})`));
            console.log('');
        }
    }
}

main();
