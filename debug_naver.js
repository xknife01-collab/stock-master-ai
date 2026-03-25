import axios from 'axios';
import iconv from 'iconv-lite';
import * as cheerio from 'cheerio';

async function debugNaver() {
    try {
        const response = await axios.get('https://finance.naver.com/sise/', { responseType: 'arraybuffer' });
        const html = iconv.decode(response.data, 'EUC-KR');
        const $ = cheerio.load(html);
        
        console.log('--- Content Area Left Box Type M Count ---');
        console.log($('#contentarea_left .box_type_m').length);
        
        $('#contentarea_left .box_type_m').each((i, el) => {
            console.log(`\nBox ${i} title/text:`, $(el).find('h3, th.h3').text() || 'No title');
            const table = $(el).find('table');
            console.log(`Table exists: ${table.length > 0}`);
            if (table.length > 0) {
                console.log('First 2 rows text:');
                table.find('tr').slice(0, 3).each((j, row) => {
                    console.log(`Row ${j}:`, $(row).text().trim().replace(/\s+/g, ' '));
                });
            }
        });
        
    } catch (e) {
        console.error(e);
    }
}
debugNaver();
