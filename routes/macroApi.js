import express from 'express';
import axios from 'axios';
import iconv from 'iconv-lite';
import * as cheerio from 'cheerio';

const router = express.Router();

let cachedMacro = null;
let lastFetch = 0;
const CACHE_TTL = 300000; // 5분

export const fetchMacroIndicators = async () => {
    try {
        const response = await axios.get('https://finance.naver.com/marketindex/', { 
            responseType: 'arraybuffer',
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const html = iconv.decode(response.data, 'EUC-KR');
        const $ = cheerio.load(html);

        const indicators = [];

        $('.data_lst li').each((i, el) => {
            const name = $(el).find('h3').text().trim() || $(el).find('.h_lst').text().trim();
            const value = $(el).find('.value').text().trim();
            const change = $(el).find('.change').text().trim();
            
            const blindText = $(el).text();
            const isUp = blindText.includes('상승') || blindText.includes('상한') || $(el).find('.head_info').hasClass('point_up');

            if (!name || !value) return;

            let label = null;
            if (name.includes('미국 USD')) label = 'USD/KRW';
            else if (name.includes('WTI')) label = 'WTI Oil';
            else if (name.includes('국제 금')) label = 'Gold';
            else if (name.includes('달러인덱스')) label = 'DXY';
            else if (name.includes('일본 JPY')) label = 'JPY/KRW';
            else if (name.includes('유럽연합 EUR')) label = 'EUR/KRW';
            else if (name.includes('중국 CNY')) label = 'CNY/KRW';

            if (label) {
                indicators.push({
                    label,
                    value: value.replace(/,/g,''),
                    change,
                    isUp
                });
            }
        });

        return indicators;
    } catch (e) {
        console.error('fetchMacroIndicators Error:', e.message);
        return [];
    }
};

router.get('/', async (req, res) => {
    const now = Date.now();
    if (cachedMacro && (now - lastFetch < CACHE_TTL)) {
        return res.json(cachedMacro);
    }

    const indicators = await fetchMacroIndicators();
    if (indicators && indicators.length > 0) {
        cachedMacro = indicators;
        lastFetch = now;
        res.json(indicators);
    } else {
        res.status(500).json({ error: 'Failed' });
    }
});

export default router;
