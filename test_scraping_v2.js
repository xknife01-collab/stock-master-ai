import axios from 'axios';
import iconv from 'iconv-lite';
import * as cheerio from 'cheerio';

const testDashboard = async () => {
    try {
        const response = await axios.get('https://finance.naver.com/sise/', { responseType: 'arraybuffer' });
        const html = iconv.decode(response.data, 'EUC-KR');
        const $ = cheerio.load(html);
        
        // Let's try to find any table with id starting with siselist_tab_
        $('[id^=siselist_tab_]').each((i, table) => {
            const id = $(table).attr('id');
            const rows = $(table).find('tr');
            console.log(`Table ${id} has ${rows.length} rows`);
            
            if (rows.length > 0) {
                const firstRow = $(rows[2]).find('td'); // Usually rows[0] is header, rows[2] is first data row
                console.log(`First data row (${id}):`, firstRow.map((i, el) => $(el).text().trim()).get());
            }
        });

    } catch (e) {
        console.error('❌ 스크래핑 에러:', e.message);
    }
};

testDashboard();
