import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

async function testNaverNews() {
    console.log('ID:', process.env.NAVER_CLIENT_ID);
    console.log('SECRET:', process.env.NAVER_CLIENT_SECRET ? 'PRESENT' : 'MISSING');
    
    try {
        const response = await axios.get('https://openapi.naver.com/v1/search/news.json', {
            params: { query: '주식', display: 15, sort: 'date' },
            headers: {
                'X-Naver-Client-Id': process.env.NAVER_CLIENT_ID,
                'X-Naver-Client-Secret': process.env.NAVER_CLIENT_SECRET
            }
        });
        console.log('Success!');
        response.data.items.forEach(it => {
            console.log(`[${it.pubDate}] ${it.title.replace(/<[^>]*>?/g, '')}`);
        });
    } catch (e) {
        console.error('Error:', e.response?.data || e.message);
    }
}

testNaverNews();
