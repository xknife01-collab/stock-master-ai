import axios from 'axios';
import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';

async function debugNaver() {
    try {
        const res = await axios.get('https://finance.naver.com/sise/', { 
            responseType: 'arraybuffer',
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const html = iconv.decode(res.data, 'EUC-KR');
        const $ = cheerio.load(html);
        console.log('--- Naver Sise Debug ---');
        console.log('Foreign Table 0 TR count:', $('#frgn_deal_0 tr').length);
        console.log('Foreign Table 0 HTML sample:', $('#frgn_deal_0').parent().html()?.substring(0, 200));
        console.log('Organ Table 0 TR count:', $('#organ_deal_0 tr').length);
        console.log('Industry Table (box_type_l) count:', $('.box_type_l').length);
    } catch (e) {
        console.error(e.message);
    }
}
debugNaver();
