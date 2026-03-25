import express from 'express';
import axios from 'axios';
import iconv from 'iconv-lite';
import * as cheerio from 'cheerio';

const router = express.Router();

let cachedMacro = null;
let lastFetch = 0;
const CACHE_TTL = 300000; // 5분

router.get('/', async (req, res) => {
    const now = Date.now();
    if (cachedMacro && (now - lastFetch < CACHE_TTL)) {
        return res.json(cachedMacro);
    }

    try {
        const response = await axios.get('https://finance.naver.com/marketindex/', { 
            responseType: 'arraybuffer',
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const html = iconv.decode(response.data, 'EUC-KR');
        const $ = cheerio.load(html);

        const indicators = [];

        // 환율, 유가, 금 등 메인 지표 추출
        $('.market1 .data').each((i, el) => {
            const name = $(el).find('.h_lst').text().trim();
            const value = $(el).find('.value').text().trim();
            const change = $(el).find('.change').text().trim();
            const status = $(el).find('.blind').text().trim(); // 상승/하락
            
            // 필요한 것만 필터링 (USD/KRW, WTI, Gold)
            if (name.includes('미국 USD') || name.includes('WTI') || name.includes('국제 금')) {
                let label = name;
                if (name.includes('미국 USD')) label = 'USD/KRW';
                if (name.includes('WTI')) label = 'WTI Oil';
                if (name.includes('국제 금')) label = 'Gold';

                indicators.push({
                    label,
                    value,
                    change,
                    isUp: status.includes('상승') || status.includes('상한')
                });
            }
        });

        // 미국 10년물 국채 금리 (별도 섹션일 수 있음)
        // 보통 '시장지표' 하단이나 다른 탭에 있는데, 네이버 메인에도 종종 노출됨.
        // 만약 못 찾으면 기본 레이아웃에서 다른 방식 사용
        if (indicators.length < 4) {
            // 국채 금리 등은 다른 셀렉터일 가능성
            $('.market2 .data').each((i, el) => {
                const name = $(el).find('.h_lst').text().trim();
                const value = $(el).find('.value').text().trim();
                const change = $(el).find('.change').text().trim();
                const status = $(el).find('.blind').text().trim();

                if (name.includes('미국채 10년')) {
                    indicators.push({
                        label: 'US 10Y Bond',
                        value,
                        change,
                        isUp: status.includes('상승')
                    });
                }
            });
        }

        // 만약 미국채를 여전히 못 찾았다면, 다른 데이터라도 채움 (예: 달러인덱스)
        if (!indicators.some(it => it.label === 'US 10Y Bond')) {
             $('.market1 .data').each((i, el) => {
                const name = $(el).find('.h_lst').text().trim();
                if (name.includes('달러인덱스')) {
                     const value = $(el).find('.value').text().trim();
                     const change = $(el).find('.change').text().trim();
                     const status = $(el).find('.blind').text().trim();
                     indicators.push({ label: 'DXY', value, change, isUp: status.includes('상승') });
                }
             });
        }

        cachedMacro = indicators;
        lastFetch = now;
        res.json(indicators);
    } catch (e) {
        console.error('Macro Fetch Error:', e.message);
        res.status(500).json({ error: 'Failed to fetch macro data' });
    }
});

export default router;
