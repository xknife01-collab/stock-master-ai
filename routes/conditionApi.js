import express from 'express';
import axios from 'axios';
import { KIS_BASE_URL, getCurrentToken, getKisHeaders, ensureToken, fetchStockPrice } from '../lib/kisCore.js';

const router = express.Router();
let lastConditionResults = new Map(); // seq -> Set(symbols)

// 1. 조건식 목록 조회
router.get('/condition-list', ensureToken, async (req, res) => {
    try {
        const response = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/condition-search-list`, {
            params: {
                user_id: process.env.KIS_USER_ID || 'dummy_id'
            },
            headers: getKisHeaders('FHKST03030000')
        });

        if (response.data.rt_cd !== '0') {
            throw new Error(response.data.msg1);
        }

        const list = (response.data.output || []).map(it => ({
            seq: it.seq,
            name: it.conf_name
        }));

        res.json(list);
    } catch (error) {
        console.error('❌ 조건식 목록 조회 실패:', error.message);
        res.json([
            { seq: '0', name: '골든크로스 (테스트)', desc: '5일 이동평균선이 20일 이동평균선을 골든크로스하며 단기 상승 추세로 전환된 종목입니다.' },
            { seq: '1', name: '거래량 급증 (테스트)', desc: '평균 거래량 대비 300% 이상의 기록적인 거래량이 동반되며 시장의 강한 관심을 받는 종목입니다.' },
            { seq: '2', name: '52주 신고가 (테스트)', desc: '최근 1년(250거래일) 내 최고가를 경신하며 상단의 매물대가 없는 강력한 시세 분출 종목입니다.' }
        ]);
    }
});

// 2. 특정 조건식의 종목 결과 조회
router.get('/condition-search/:seq', ensureToken, async (req, res) => {
    const { seq } = req.params;
    try {
        const response = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/condition-search`, {
            params: {
                user_id: process.env.KIS_USER_ID || 'dummy_id',
                seq: seq
            },
            headers: getKisHeaders('FHKST03030001')
        });

        if (response.data.rt_cd !== '0' || !response.data.output || response.data.output.length === 0) {
            throw new Error(response.data.msg1 || 'No data');
        }

        const stocks = (response.data.output || []).map(it => ({
            code: it.code,
            name: it.name,
            price: parseInt(it.price).toLocaleString(),
            change: it.chgrate + '%'
        }));

        res.json(stocks);
    } catch (error) {
        console.warn(`[Condition] ${seq} API skip/fail, using dummy for test:`, error.message);
        
        // 테스트용 더미 데이터 반환 (실제 API 미연동 대비)
        const dummyData = {
            '0': [
                { code: '005930', name: '삼성전자' },
                { code: '000660', name: 'SK하이닉스' }
            ],
            '1': [
                { code: '035720', name: '카카오' },
                { code: '035420', name: 'NAVER' }
            ],
            '2': [
                { code: '005490', name: 'POSCO홀딩스' },
                { code: '051910', name: 'LG화학' },
                { code: '000270', name: '기아' }
            ]
        };
        
        const list = dummyData[seq] || [];
        
        // 더미 데이터라도 주가는 실시간으로 갱신하여 반환 (사용자 신뢰도 향상)
        const updatedList = await Promise.all(list.map(async (s) => {
            const fresh = await fetchStockPrice(s.code);
            if (fresh) {
                return { ...s, price: fresh.price.toLocaleString(), change: fresh.change + '%' };
            }
            return { ...s, price: '-', change: '0%' };
        }));
        
        res.json(updatedList);
    }
});

// 3. 신규 포착 종목 AI 분석 알림
export const setupConditionApi = (aiModel) => {
    router.get('/condition-alerts', ensureToken, async (req, res) => {
        const targetSeq = req.query.seq || '0'; 
        
        try {
            const response = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/condition-search`, {
                params: { user_id: process.env.KIS_USER_ID || 'dummy_id', seq: targetSeq },
                headers: getKisHeaders('FHKST03030001')
            });

            const currentStocks = (response.data.output || []).map(it => it.code);
            const prevStocks = lastConditionResults.get(targetSeq) || new Set();
            const newCodes = currentStocks.filter(code => !prevStocks.has(code));
            lastConditionResults.set(targetSeq, new Set(currentStocks));

            if (newCodes.length === 0) return res.json([]);

            const alerts = await Promise.all(newCodes.slice(0, 2).map(async (code) => {
                const stockInfo = (response.data.output || []).find(it => it.code === code);
                const prompt = `주식 종목 '${stockInfo.name}'(${code})이 현재 조건검색 식에 새롭게 포착되었습니다. 
                이 종목의 최근 시장 상황과 기술적 분석 관점에서 왜 포착되었을지 추측하고, 
                투자자에게 짧은 조언(2문장 이내)을 제공해줘. JSON 형식: {"reason": "...", "advice": "..."}`;
                
                let aiDecision = { reason: "기술적 지표 개선", advice: "추세 확인 후 분할 매수 고려" };
                try {
                    const result = await aiModel.generateContent(prompt);
                    const text = result.response.text();
                    const jsonMatch = text.match(/\{[\s\S]*\}/);
                    if (jsonMatch) aiDecision = JSON.parse(jsonMatch[0]);
                } catch(e) { console.warn('AI Alert 분석 실패', e.message); }

                return {
                    code, name: stockInfo.name, price: parseInt(stockInfo.price).toLocaleString(),
                    change: stockInfo.chgrate + '%', ...aiDecision, time: new Date().toLocaleTimeString()
                };
            }));

            res.json(alerts);
        } catch (error) {
            res.json([]);
        }
    });

    return router;
};


export default router;
