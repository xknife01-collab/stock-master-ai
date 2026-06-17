import * as cheerio from 'cheerio';
import fs from 'fs';

function parseSise() {
    const html = fs.readFileSync('naver_sise.html', 'utf-8');
    const $ = cheerio.load(html);

    // Find headers
    const headers = [];
    $('table.type_2 thead tr th').each((i, el) => {
        headers.push($(el).text().trim());
    });
    console.log("Headers:", headers);

    // Find first 3 data rows
    const rows = [];
    $('table.type_2 tbody tr').each((i, tr) => {
        const cols = [];
        $(tr).find('td').each((j, td) => {
            cols.push($(td).text().trim());
        });
        if (cols.length > 1) {
            rows.push(cols);
        }
    });

    console.log("First 3 rows:");
    rows.slice(0, 3).forEach((r, idx) => {
        console.log(`Row ${idx + 1}:`, r);
    });
}

parseSise();
