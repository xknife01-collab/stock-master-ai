import * as cheerio from 'cheerio';
import axios from 'axios';

async function fetchSiseSum() {
    try {
        console.log("Fetching KOSPI sise_market_sum page 1...");
        const url = `https://finance.naver.com/sise/sise_market_sum.naver?sosok=0&page=1`;
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            responseType: 'arraybuffer',
            timeout: 10000
        });

        const decoder = new TextDecoder('euc-kr');
        const html = decoder.decode(response.data);
        const $ = cheerio.load(html);

        // Find the headers
        const headers = [];
        $('table.type_2 thead tr th').each((i, el) => {
            headers.push($(el).text().trim());
        });
        console.log("Headers:", headers);

        // Print first 3 rows
        let rowCount = 0;
        $('table.type_2 tbody tr').each((i, tr) => {
            const cols = [];
            const links = [];
            $(tr).find('td').each((j, td) => {
                cols.push($(td).text().trim().replace(/\s+/g, ' '));
                const a = $(td).find('a');
                if (a.length > 0) {
                    links.push(a.attr('href'));
                }
            });

            if (cols.length > 1) {
                rowCount++;
                if (rowCount <= 5) {
                    console.log(`Row ${rowCount}:`, cols);
                    console.log(`Links in Row ${rowCount}:`, links);
                }
            }
        });

    } catch (e) {
        console.error("Error:", e.message);
    }
}

fetchSiseSum();
