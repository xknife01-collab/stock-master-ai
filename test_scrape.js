const axios = require('axios');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');

async function test() {
    const response = await axios.get('https://finance.naver.com/sise/', { responseType: 'arraybuffer' });
    const html = iconv.decode(response.data, 'EUC-KR');
    const $ = cheerio.load(html);
    
    const sectors = [];
    $('#contentarea_left .box_type_m').eq(0).find('table.type_1 tr').each((i, row) => {
        const tds = $(row).find('td');
        if (tds.length >= 2) {
            sectors.push({
                name: $(tds[0]).text().trim(),
                change: $(tds[1]).text().trim(),
                width: $(tds[2]).find('span').attr('style')?.replace('width:','') || '0%'
            });
        }
    });

    const themes = [];
    $('#contentarea_left .box_type_m').eq(1).find('table.type_1 tr').each((i, row) => {
        const tds = $(row).find('td');
        if (tds.length >= 2) {
            themes.push({
                name: $(tds[0]).text().trim(),
                change: $(tds[1]).text().trim(),
                lead: $(tds[2]).text().trim()
            });
        }
    });

    console.log("Sectors:", sectors.slice(0, 10));
    console.log("Themes:", themes.slice(0, 10));
}
test();
