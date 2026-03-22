import express from 'express';
import axios from 'axios';
import cors from 'cors';
import iconv from 'iconv-lite';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

// Vertex AI SDK Import
import { VertexAI } from '@google-cloud/vertexai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.BACKEND_PORT || 5000;

app.use(cors());
app.use(express.json());

// Google Gemini API (API Studio) Setup
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const aiModel = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

// Google Vertex AI (Cloud) Setup
const vertexAI = new VertexAI({
    project: process.env.GOOGLE_CLOUD_PROJECT,
    location: process.env.GOOGLE_CLOUD_REGION
});
const vertexModel = vertexAI.getGenerativeModel({ model: "gemini-1.5-flash-002" });

// RAG Diary (오답노트) 경로
const ragDiaryPath = path.join(__dirname, 'rag_diary.json');

// Memory Cache for AI Signal (매시간 정각마다 갱신하기 위함)
let cachedAiSignal = null;
let lastCachedHour = -1;

const KIS_BASE_URL = 'https://openapi.koreainvestment.com:9443'; // 실전 투자용
// const KIS_BASE_URL = 'https://openapivts.koreainvestment.com:29443'; // 모의 투자용

let accessToken = '';
let tokenExpires = 0;

let isFetchingToken = false;

// KIS Access Token 발급 함수
const getAccessToken = async () => {
    if (isFetchingToken) return accessToken;
    isFetchingToken = true;
    try {
        const response = await axios.post(`${KIS_BASE_URL}/oauth2/tokenP`, {
            grant_type: 'client_credentials',
            appkey: process.env.VITE_KIS_APP_KEY,
            appsecret: process.env.VITE_KIS_APP_SECRET
        });

        accessToken = response.data.access_token;
        // 토큰 유효기간 (보통 86400초, 24시간)
        tokenExpires = Date.now() + (response.data.expires_in * 1000);
        console.log('✅ KIS Access Token 발급 성공');
        return accessToken;
    } catch (error) {
        console.error('❌ Token 발급 에러:', error.response?.data || error.message);
        throw error;
    } finally {
        isFetchingToken = false;
    }
};

// 미들웨어: 토근 만료 시 자동 갱신
const ensureToken = async (req, res, next) => {
    if (!accessToken || Date.now() >= tokenExpires - 60000) { // 만료 1분 전 갱신
        try {
            await getAccessToken();
        } catch (error) {
            return res.status(500).json({ error: 'Failed to authenticate with KIS' });
        }
    }
    next();
};

// 주식 현재가 조회 API
app.get('/api/stock/:symbol', ensureToken, async (req, res) => {
    const { symbol } = req.params;
    try {
        const response = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-price`, {
            params: {
                fid_cond_mrkt_div_code: 'J', // 주식
                fid_input_iscd: symbol // 종목코드
            },
            headers: {
                'authorization': `${accessToken}`, // Bearer 제거 시도
                'appkey': process.env.VITE_KIS_APP_KEY,
                'appsecret': process.env.VITE_KIS_APP_SECRET,
                'tr_id': 'FHKST01010100' // 현재가 조회 TR ID
            }
        });

        const data = response.data.output;
        res.json({
            name: data.hstc_nm || symbol,
            price: parseFloat(data.stck_prpr),
            change: parseFloat(data.prdy_ctrt),
            high: parseFloat(data.stck_hgpr),
            low: parseFloat(data.stck_lwpr),
            volume: parseFloat(data.acml_vol)
        });
    } catch (error) {
        console.error(`❌ ${symbol} 조회 에러:`, error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to fetch stock data' });
    }
});

// 주식 일봉 차트 정보 조회
app.get('/api/history/:symbol', ensureToken, async (req, res) => {
    const { symbol } = req.params;
    const range = req.query.range || '1M';
    const queryPrice = req.query.price ? parseFloat(req.query.price.replace(/[^0-9.]/g, '')) : null;

    const generateMockChart = (basePrice, rangeType) => {
        let pointCount = 30;
        let step = 1;
        let volatility = 0.03;
        let bias = 0.01;

        if (rangeType === '1W') {
            pointCount = 7;
            volatility = 0.02;
            bias = 0.005;
        } else if (rangeType === '1Y') {
            pointCount = 52;
            step = 7;
            volatility = 0.06;
            bias = 0.02;
        }

        const data = [];
        let cur = basePrice * (rangeType === '1Y' ? 0.7 : 0.9); 
        
        for(let i=pointCount; i>=0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - (i * step));
            cur += cur * (Math.random() * volatility - bias);
            if(i === 0) cur = basePrice;

            const dateStr = rangeType === '1Y' 
                ? `${(d.getFullYear()%100)}.${(d.getMonth()+1).toString().padStart(2,'0')}` 
                : `${(d.getMonth()+1).toString().padStart(2,'0')}/${(d.getDate()).toString().padStart(2,'0')}`;
            
            data.push({
                date: dateStr,
                price: parseFloat(cur.toFixed(2))
            });
        }
        return data;
    };

    // 인덱스 특수 처리
    if (['KOSPI', 'KOSDAQ', 'KOSPI200'].includes(symbol)) {
        const basePrices = { 'KOSPI': 5781.20, 'KOSDAQ': 1161.52, 'KOSPI200': 862.50 };
        return res.json(generateMockChart(basePrices[symbol], range));
    }

    // 6자리 코드가 아닌 문자(테마명, 한글 종목명)인 경우 가상 차트 반환
    if (!/^\d{6}$/.test(symbol)) {
        return res.json(generateMockChart(queryPrice || 50000, range));
    }

    try {
        const response = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice`, {
            params: {
                FID_COND_MRKT_DIV_CODE: 'J',
                FID_INPUT_ISCD: symbol,
                FID_INPUT_DATE_1: '20230101',
                FID_INPUT_DATE_2: new Date().toISOString().slice(0,10).replace(/-/g,''),
                FID_PERIOD_DIV_CODE: 'D',
                FID_ORG_ADJ_PRC: '0'
            },
            headers: {
                'authorization': `Bearer ${accessToken}`,
                'appkey': process.env.VITE_KIS_APP_KEY,
                'appsecret': process.env.VITE_KIS_APP_SECRET,
                'tr_id': 'FHKST03010100'
            }
        });

        if (response.data.rt_cd === '0') {
            const historyData = response.data.output2.reverse().map(item => ({
                date: item.stck_bsop_date.slice(4, 8),
                price: parseInt(item.stck_clpr)
            }));
            res.json(historyData);
        } else {
            res.json(generateMockChart(queryPrice || 10000, range));
        }
    } catch (error) {
        console.error(`❌ ${symbol} 차트 조회 에러 fallback 가동:`, error.response?.data || error.message);
        res.json(generateMockChart(queryPrice || 10000, range));
    }
});

// 실시간 뉴스 가져오기 (Naver API)
async function fetchNaverNews() {
    if (!process.env.NAVER_CLIENT_ID || !process.env.NAVER_CLIENT_SECRET) return "네이버 뉴스 키가 등록되지 않았습니다.";
    try {
        const response = await axios.get('https://openapi.naver.com/v1/search/news.json', {
            params: { query: '주식 OR 글로벌증시 OR 코스피 OR 테마주', display: 20, sort: 'date' },
            headers: {
                'X-Naver-Client-Id': process.env.NAVER_CLIENT_ID,
                'X-Naver-Client-Secret': process.env.NAVER_CLIENT_SECRET
            }
        });
        return response.data.items.map(it => it.title.replace(/<[^>]*>?/g, '').replace(/&quot;/g, '"')).join('\n');
    } catch (e) {
        return "뉴스 데이터를 불러오지 못했습니다.";
    }
}

// 오답노트 (RAG DB) 읽기
function getRagDiary() {
    if (!fs.existsSync(ragDiaryPath)) return [];
    try {
        return JSON.parse(fs.readFileSync(ragDiaryPath, 'utf8'));
    } catch (e) {
        return [];
    }
}

// 오답노트 (RAG DB) 쓰기
function saveRagDiary(news, prediction) {
    const diary = getRagDiary();
    diary.unshift({ time: new Date().toISOString(), news_summary: news.substring(0, 100) + '...', prediction });
    // 최근 24시간(24개)만 보관
    if (diary.length > 24) diary.pop();
    fs.writeFileSync(ragDiaryPath, JSON.stringify(diary, null, 2), 'utf8');
}

// 멀티 에이전트 AI 시그널 리얼 타임 (Gemini 연동)
app.get('/api/ai-signal', async (req, res) => {
    const hr = new Date().getHours();
    
    // 캐시 반환 (같은 시간이면 재응답 방지 -> 요금/속도 최적화)
    if (cachedAiSignal && lastCachedHour === hr) {
        return res.json({ time: `${hr.toString().padStart(2, '0')}:00`, data: cachedAiSignal });
    }

    try {
        console.log('🤖 1시간 경과! 제미나이 AI에게 시장 분석(RAG)을 요청합니다...');
        const currentNews = await fetchNaverNews();
        const pastDiary = getRagDiary();

        // Gemini에게 보낼 막강한 프롬프트(Prompt)
        const prompt = `
너는 월스트리트 최고 수준의 퀀트 헤지펀드 AI(멀티에이전트 탑다운 방식)야.
너의 역할은 매시간 최신 글로벌 뉴스와 너의 과거 예측 일기장(오답노트)을 분석해서 현재 가장 오를 확률이 높은 [주도 테마]와 [개별 주식] 1개를 꼽아내는 거야.

[1. 현재 1시간 동안 발생한 최신 뉴스 헤드라인 20개]
${currentNews}

[2. 너의 과거 예측 및 오답노트 (RAG 검색 증강)]
${JSON.stringify(pastDiary)}

위 데이터를 바탕으로 반드시 다음과 같은 엄격한 형식의 JSON(순수 JSON, 마크다운 없이)으로 응답해:
{
  "theme": "예: AI 반도체/HBM",
  "themeProb": "예: 88%",
  "stock": "예: SK하이닉스",
  "reason": "예: 블룸버그 뉴스에서 엔비디아 수주 속보가 떴으며, 과거 오답노트 분석 결과 비슷한 텍스트 패턴에서 HBM 선단 공정 기업들이 빠르게 급등함.",
  "feedback": "예: [이전 시간 학습] 이전 예측에서 자동차주 피크아웃을 과소평가하여 롱 배팅했으나 오답 발생. RAG DB를 기반으로 오늘 텍스트에서 소비 둔화 키워드 가중치를 깎고 확실한 반도체 테마로 뷰를 전환함."
}
        `;

        // AI 선택 및 실행 (Vertex AI 우선 시도)
        let aiJson;
        try {
            console.log('⚡ Vertex AI (Enterprise)로 분석을 시도합니다...');
            const result = await vertexModel.generateContent(prompt);
            let textResult = result.response.candidates[0].content.parts[0].text;
            
            if(textResult.startsWith('```json')) {
                textResult = textResult.replace(/^```json\n?/, '').replace(/\n?```$/, '');
            }
            aiJson = JSON.parse(textResult.trim());
        } catch (vertexError) {
            console.warn('⚠️ Vertex AI 실패, Gemini API(Standard)로 전환합니다:', vertexError.message);
            // gemini-flash-latest 사용
            const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
            const result = await model.generateContent(prompt);
            let textResult = result.response.text().trim();
            if(textResult.startsWith('```json')) {
                textResult = textResult.replace(/^```json\n?/, '').replace(/\n?```$/, '');
            }
            aiJson = JSON.parse(textResult);
        }

        // 결과 저장 및 캐시
        cachedAiSignal = aiJson;
        lastCachedHour = hr;
        saveRagDiary(currentNews, aiJson);

        res.json({ time: `${hr.toString().padStart(2, '0')}:00`, data: aiJson });
    } catch (error) {
        console.error('AI Fetch Error:', error);
        const fallback = {
            theme: '데이터 소진/지연', 
            themeProb: '??%',
            stock: 'AI 연산 대기 중',
            reason: 'API 할당량이 초과되었거나 리전 지연으로 인해 일시적인 정체가 발생했습니다. 10분 후 자동으로 재시도합니다.',
            feedback: `시스템 복구 중: ${error.message}`
        };
        // 에러 발생 시에도 10분간은 API 호출을 중단하여 할당량을 보호합니다.
        cachedAiSignal = fallback;
        lastCachedHour = hr;
        setTimeout(() => { if (cachedAiSignal === fallback) cachedAiSignal = null; }, 600000);

        res.json({ time: `${hr.toString().padStart(2, '0')}:00`, data: fallback });
    }
});

// 실시간 대시보드 데이터 크롤링 (네이버 증권)
app.get('/api/dashboard', async (req, res) => {
    try {
        const response = await axios.get('https://finance.naver.com/sise/', { responseType: 'arraybuffer' });
        const html = iconv.decode(response.data, 'EUC-KR');
        const $ = cheerio.load(html);
        
        const parseTable = (selector) => {
            const results = [];
            $(selector).each((i, row) => {
                const rowData = [];
                $(row).find('td').each((j, td) => {
                    rowData.push({
                        text: $(td).text().trim().replace(/\s+/g, ' '),
                        isUp: $(td).find('img').attr('alt') === '상승' || $(td).hasClass('red01') || $(td).hasClass('red02'),
                        isDown: $(td).find('img').attr('alt') === '하락' || $(td).hasClass('nv01')
                    });
                });
                if(rowData.length > 0) results.push(rowData);
            });
            return results;
        };

        const safeText = (r, idx) => r[idx] ? r[idx].text : '';

        const getSafeTopStocks = (tableId) => parseTable(`#siselist_tab_${tableId} tbody tr`).filter(r => r.length >= 10).map((r, i) => ({
            r: (i+1).toString().padStart(2, '0'),
            c: safeText(r, 1) || '-',
            a: safeText(r, 2) || '-',
            n: safeText(r, 3),
            p: safeText(r, 4),
            d: safeText(r, 5).replace(/[^0-9,]/g, ''),
            pct: safeText(r, 6),
            v: safeText(r, 7),
            op: safeText(r, 8),
            hp: safeText(r, 9),
            lp: safeText(r, 10)
        })).slice(0, 10);

        const topStocks = Array.from({length: 8}).map((_, i) => getSafeTopStocks(i));

        const getSafeDeal = (tableId) => parseTable(`#frgn_deal_${tableId} tbody tr`).filter(r => r.length >= 3).map((r, i) => ({
            num: (i+1).toString().padStart(2, '0'),
            name: safeText(r, 0),
            price: safeText(r, 1),
            diff: safeText(r, 2).replace(/[^0-9,]/g, ''),
            isUp: r[2] && r[2].isUp ? true : (r[2] && r[2].isDown ? false : null)
        })).slice(0, 10);

        // Indices: 0(For Buy), 1(For Sell), 2(Inst Buy), 3(Inst Sell). If missing, return empty.
        const foreign = [getSafeDeal(0), getSafeDeal(1)];
        const inst = [getSafeDeal(2), getSafeDeal(3)];
        
        // 업종별 시세 크롤링
        const sectors = [];
        $('#contentarea_left .box_type_m').eq(0).find('table.type_1 tr').each((i, row) => {
            const tds = $(row).find('td');
            if (tds.length >= 2) {
                sectors.push({
                    name: $(tds[0]).text().trim(),
                    change: $(tds[1]).text().trim(),
                    width: $(tds[2]).find('span').attr('style')?.replace('width:', '') || '0%'
                });
            }
        });

        // 테마별 시세 크롤링
        const themes = [];
        $('#contentarea_left .box_type_m').eq(1).find('table.type_1 tr').each((i, row) => {
            const tds = $(row).find('td');
            if (tds.length >= 2) {
                themes.push({
                    name: $(tds[0]).text().trim(),
                    change: $(tds[1]).text().trim(),
                    lead: $(tds[2]).text().trim().replace(/상한|하한/g, '') // '상한한신공영' -> '한신공영'
                });
            }
        });
        
        res.json({ topStocks, foreign, inst, sectors: sectors.slice(0, 10), themes: themes.slice(0, 10) });
    } catch (e) {
        console.error('❌ 대시보드 크롤링 에러:', e.message);
        res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
});

// AI 추천 히스토리 (오답노트) 가져오기
app.get('/api/ai-history', (req, res) => {
    try {
        const diary = getRagDiary();
        res.json(diary);
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch AI history' });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Stock Proxy Server running at http://localhost:${PORT}`);
});
