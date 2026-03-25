import axios from 'axios';
import fs from 'fs';
import iconv from 'iconv-lite';

async function downloadNaverSise() {
    try {
        const res = await axios.get('https://finance.naver.com/sise/', { 
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
            }
        });
        const html = iconv.decode(res.data, 'EUC-KR');
        fs.writeFileSync('naver_sise.html', html, 'utf8');
        console.log('Saved naver_sise.html');
    } catch (e) {
        console.error(e.message);
    }
}
downloadNaverSise();
