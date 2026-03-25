import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        if (!process.env.NAVER_CLIENT_ID || !process.env.NAVER_CLIENT_SECRET) {
            return res.status(500).json({ error: 'Naver API keys missing' });
        }
        const response = await axios.get('https://openapi.naver.com/v1/search/news.json', {
            params: { query: '주식', display: 15, sort: 'date' },
            headers: {
                'X-Naver-Client-Id': process.env.NAVER_CLIENT_ID,
                'X-Naver-Client-Secret': process.env.NAVER_CLIENT_SECRET
            }
        });
        
        const news = response.data.items.map(it => ({
            title: it.title.replace(/<[^>]*>?/g, '').replace(/&quot;/g, '"'),
            link: it.originallink || it.link,
            pubDate: new Date(it.pubDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            description: it.description.replace(/<[^>]*>?/g, '').replace(/&quot;/g, '"')
        }));
        
        res.json(news);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

export default router;
