import axios from 'axios';
import iconv from 'iconv-lite';
import * as cheerio from 'cheerio';

const testDashboard = async () => {
    try {
        const response = await axios.get('https://finance.naver.com/sise/', { responseType: 'arraybuffer' });
        const html = iconv.decode(response.data, 'EUC-KR');
        const $ = cheerio.load(html);
        
        const parseTable = (selector) => {
            const results = [];
            $(selector).each((i, row) => {
                const rowData = [];
                $(row).find('td').each((j, td) => {
                    rowData.push({
                        text: $(td).text().trim().replace(/\s+/g, ' '),
                        code: $(td).find('a').attr('href')?.split('code=')[1] || null
                    });
                });
                if(rowData.length > 0) results.push(rowData);
            });
            return results;
        };

        const topStocks = parseTable('#siselist_tab_1 tbody tr');
        console.log('✅ Top Stocks (1):', topStocks.length > 0 ? topStocks[0] : 'EMPTY');
    } catch (e) {
        console.error('❌ 스크래핑 에러:', e.message);
    }
};

testDashboard();
