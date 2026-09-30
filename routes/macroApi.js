import express from 'express';
import axios from 'axios';

const router = express.Router();

let cachedMacro = null;
let lastFetch = 0;
const CACHE_TTL = 60000; // 1분 캐시

export const fetchMacroIndicators = async () => {
    try {
        const [exchangeRes, energyRes, metalsRes] = await Promise.all([
            axios.get('https://api.stock.naver.com/marketindex/exchange', {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                timeout: 5000
            }),
            axios.get('https://api.stock.naver.com/marketindex/energy', {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                timeout: 5000
            }),
            axios.get('https://api.stock.naver.com/marketindex/metals', {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                timeout: 5000
            })
        ]);

        const indicators = [];

        // 1. 환율 및 달러 인덱스
        const exchangeList = exchangeRes.data?.normalList || [];
        exchangeList.forEach(item => {
            const name = item.name || '';
            let label = null;
            if (name.includes('미국 USD') || item.symbolCode === 'USD') label = 'USD/KRW';
            else if (name.includes('달러인덱스') || item.symbolCode === 'DXY') label = 'DXY';
            else if (name.includes('일본 JPY') || item.symbolCode === 'JPY') label = 'JPY/KRW';
            else if (name.includes('유럽 EUR') || item.symbolCode === 'EUR') label = 'EUR/KRW';
            else if (name.includes('중국 CNY') || item.symbolCode === 'CNY') label = 'CNY/KRW';

            if (label) {
                const isUp = item.fluctuationsType?.name === 'RISING' || Number(item.fluctuationsRatio) > 0;
                const changeSign = isUp ? '+' : (Number(item.fluctuationsRatio) < 0 ? '' : '');
                indicators.push({
                    label,
                    value: item.closePrice,
                    change: `${changeSign}${item.fluctuationsRatio}%`,
                    isUp
                });
            }
        });

        // 2. 에너지 (WTI)
        const energyList = Array.isArray(energyRes.data) ? energyRes.data : [];
        energyList.forEach(item => {
            const name = item.name || '';
            if (name.includes('WTI') || item.symbolCode === 'CL') {
                const isUp = item.fluctuationsType?.name === 'RISING' || Number(item.fluctuationsRatio) > 0;
                const changeSign = isUp ? '+' : (Number(item.fluctuationsRatio) < 0 ? '' : '');
                indicators.push({
                    label: 'WTI Oil',
                    value: item.closePrice,
                    change: `${changeSign}${item.fluctuationsRatio}%`,
                    isUp
                });
            }
        });

        // 3. 귀금속 (금)
        const metalsList = Array.isArray(metalsRes.data) ? metalsRes.data : [];
        metalsList.forEach(item => {
            const name = item.name || '';
            if (name.includes('국제 금') || item.symbolCode === 'GC') {
                const isUp = item.fluctuationsType?.name === 'RISING' || Number(item.fluctuationsRatio) > 0;
                const changeSign = isUp ? '+' : (Number(item.fluctuationsRatio) < 0 ? '' : '');
                indicators.push({
                    label: 'Gold',
                    value: item.closePrice,
                    change: `${changeSign}${item.fluctuationsRatio}%`,
                    isUp
                });
            }
        });

        const order = ['USD/KRW', 'DXY', 'WTI Oil', 'Gold', 'JPY/KRW', 'EUR/KRW', 'CNY/KRW'];
        indicators.sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label));

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
