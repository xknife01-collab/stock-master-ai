import axios from 'axios';
import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';

async function test() {
    const response = await axios.get('https://finance.naver.com/sise/', { responseType: 'arraybuffer' });
    const html = iconv.decode(response.data, 'EUC-KR');
    const $ = cheerio.load(html);
    
    console.log("Checking Top Stocks Table 1 (Rising)...");
    $('#siselist_tab_1 tbody tr').each((i, row) => {
        const tds = $(row).find('td');
        if ($(tds).length >= 10) {
            const nameTd = $(tds[3]);
            const name = nameTd.text().trim();
            const link = nameTd.find('a').attr('href');
            console.log(`Rank ${i+1}: ${name} | Link: ${link}`);
        }
    });
}
test();
