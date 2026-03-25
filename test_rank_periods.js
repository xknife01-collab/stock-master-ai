import axios from 'axios';
import iconv from 'iconv-lite';
import * as cheerio from 'cheerio';

async function testRankingsPeriod(period) {
    const investor = '9000'; // Foreigner
    const type = 'buy'; // Net Buy
    const url = `https://finance.naver.com/sise/sise_deal_rank_iframe.naver?sosok=01&investor_gubun=${investor}&type=${type}&period=${period}`;
    
    console.log(`--- Period ${period} ---`);
    console.log(`Fetching from: ${url}`);
    
    try {
        const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 5000 });
        const html = iconv.decode(res.data, 'EUC-KR');
        const $ = cheerio.load(html);
        
        let count = 0;
        $('table.type_1 tr').each((i, el) => {
            const nameEl = $(el).find('td a');
            if (nameEl.length > 0) {
                count++;
                if (count > 5) return;
                const name = nameEl.text().trim();
                const amount = $(el).find('td').eq(2).text().trim();
                console.log(`${count}. ${name}: ${amount}백만`);
            }
        });
    } catch (e) {
        console.error('Error:', e.message);
    }
}

async function runAll() {
    await testRankingsPeriod(1);
    await testRankingsPeriod(5);
}

runAll();
