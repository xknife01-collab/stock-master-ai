import fs from 'fs';
import * as cheerio from 'cheerio';

function inspect() {
    const html = fs.readFileSync('naver_sise.html', 'utf8');
    const $ = cheerio.load(html);
    
    // Naver Finance KOSPI index is usually at a tag with id "KOSPI_now" or similar.
    // Let's print all tags with ID or class containing "now" or "change" or "sise"
    const ids = [];
    $('[id]').each((i, el) => {
        const id = $(el).attr('id');
        if (id.toLowerCase().includes('kospi') || id.toLowerCase().includes('kosdaq')) {
            ids.push({ id, text: $(el).text().trim().replace(/\s+/g, ' ') });
        }
    });
    console.log('Matching IDs:', ids);

    // Let's print the text content of the class "kospi_area" or similar
    console.log('KOSPI text:', $('.kospi_area').text().trim().replace(/\s+/g, ' '));
    console.log('KOSDAQ text:', $('.kosdaq_area').text().trim().replace(/\s+/g, ' '));
    console.log('KPI200 text:', $('.kpi200_area').text().trim().replace(/\s+/g, ' '));
}
inspect();
