import express from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { aiModel, vertexModel } from '../lib/ai.js';
import { getAccessToken, KIS_BASE_URL, getKisHeaders } from '../lib/kisCore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = express.Router();

const ragDiaryPath = path.join(__dirname, '../rag_diary.json');
const aiCachePath = path.join(__dirname, '../ai_cache.json');
const patternInsightsPath = path.join(__dirname, '../pattern_insights.json');

// --- Helper Functions ---

const getPatternInsights = () => {
    if (!fs.existsSync(patternInsightsPath)) return [];
    try { return JSON.parse(fs.readFileSync(patternInsightsPath, 'utf8')); } catch (e) { return []; }
};

const savePatternInsights = (newInsight) => {
    if (!newInsight || typeof newInsight !== 'string' || newInsight.length < 5) return;
    const insights = getPatternInsights();
    // 중복 제거 및 최신 순 저장 (최근 50개 유지)
    if (!insights.includes(newInsight)) {
        insights.unshift({ date: new Date().toISOString(), insight: newInsight });
        if (insights.length > 50) insights.pop();
        fs.writeFileSync(patternInsightsPath, JSON.stringify(insights, null, 2), 'utf8');
    }
};

const getRagDiary = () => {
    if (!fs.existsSync(ragDiaryPath)) return [];
    try { return JSON.parse(fs.readFileSync(ragDiaryPath, 'utf8')); } catch (e) { return []; }
};

const saveRagDiary = (news, signal) => {
    const diary = getRagDiary();
    diary.unshift({ 
        time: new Date().toISOString(), 
        news_summary: news.substring(0, 120) + '...', 
        prediction: {
            theme: signal.theme,
            themeProb: signal.themeProb,
            stock: signal.stock,
            symbol: signal.symbol,
            price: signal.price,
            targetPrice: signal.targetPrice || signal.tp,
            stopLoss: signal.stopLoss || signal.sl,
            fundamental: signal.fundamental,
            macro: signal.macro,
            bearCase: signal.bearCase,
            reason: signal.reason,
            feedback: signal.feedback
        },
        symbol: signal.symbol,
        price: signal.price || 0,
        // 픽 실적 추적용: 다음 시간에 수익률 계산
        shortTermPicks: (signal.shortTermPicks || []).map(p => ({ n: p.n, c: p.c, p: p.p })),
        longTermPicks: (signal.longTermPicks || []).map(p => ({ n: p.n, c: p.c, p: p.p }))
    });
    if (diary.length > 48) diary.pop(); // 48시간치 보관
    fs.writeFileSync(ragDiaryPath, JSON.stringify(diary, null, 2), 'utf8');
};

const fetchStockPrice = async (symbol) => {
    try {
        const token = await getAccessToken();
        const response = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-price`, {
            params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol },
            headers: {
                ...getKisHeaders('FHKST01010100'),
                'authorization': `Bearer ${token}`
            }
        });
        return parseInt(response.data.output.stck_prpr);
    } catch (e) {
        console.error(`Price fetch failed for ${symbol}:`, e.message);
        return null;
    }
};

const getAiCache = () => {
    if (!fs.existsSync(aiCachePath)) return { signal: null, hourKey: null };
    try { return JSON.parse(fs.readFileSync(aiCachePath, 'utf8')); } catch (e) { return { signal: null, hourKey: null }; }
};

const saveAiCache = (pulseData, hourKey) => {
    // pulseData에서 순수 데이터(signal/prediction 객체)만 추출
    let dataToSave = pulseData.data || pulseData.signal || pulseData.prediction || pulseData;
    if (dataToSave.pulse) dataToSave = dataToSave.pulse;
    if (dataToSave.data) dataToSave = dataToSave.data;
    
    fs.writeFileSync(aiCachePath, JSON.stringify({ pulse: dataToSave, hourKey }, null, 2), 'utf8');
};

const fetchNaverNews = async () => {
    if (!process.env.NAVER_CLIENT_ID || !process.env.NAVER_CLIENT_SECRET) return "네이버 뉴스 키가 등록되지 않았습니다.";
    try {
        const response = await axios.get('https://openapi.naver.com/v1/search/news.json', {
            params: { query: '주식 시장 환율 USD/KRW 미국 금리 10년물 국채 시황 분석', display: 30, sort: 'date' },
            headers: {
                'X-Naver-Client-Id': process.env.NAVER_CLIENT_ID,
                'X-Naver-Client-Secret': process.env.NAVER_CLIENT_SECRET
            }
        });
        return response.data.items.map(it => it.title.replace(/<[^>]*>?/g, '').replace(/&quot;/g, '"')).join('\n');
    } catch (e) { 
        console.error('Naver News Fetch Error:', e.message);
        return "뉴스 데이터를 불러오지 못했습니다."; 
    }
};

/**
 * 실시간 가격 갱신 헬퍼
 */
const refreshRecommendedPrices = async (signal) => {
    if (!signal) return;
    
    // 1. 메인 픽 가격 갱신 (symbol 필드가 있는 경우)
    if (signal.symbol) {
        const freshPrice = await fetchStockPrice(signal.symbol);
        if (freshPrice) signal.price = freshPrice.toString();
    }

    // 2. 단기/장기 추천주 리스트 갱신
    const updatePicks = async (picks) => {
        if(!picks || !Array.isArray(picks)) return;
        await Promise.all(picks.map(async (item) => {
            const freshPrice = await fetchStockPrice(item.c);
            if (freshPrice) item.p = freshPrice.toString();
        }));
    };

    await Promise.all([
        updatePicks(signal.shortTermPicks),
        updatePicks(signal.longTermPicks)
    ]);
};

// 숫자 데이터 정제 헬퍼
const cleanNum = (val) => {
    if (!val) return "";
    return val.toString().replace(/[^0-9]/g, '');
};

const cleanSignal = (s) => {
    if (!s) return;
    s.price = cleanNum(s.price);
    s.tp = cleanNum(s.tp);
    s.sl = cleanNum(s.sl);
    if (s.shortTermPicks) s.shortTermPicks.forEach(p => { 
        p.p = cleanNum(p.p); p.tp = cleanNum(p.tp); p.sl = cleanNum(p.sl); 
    });
    if (s.longTermPicks) s.longTermPicks.forEach(p => { 
        p.p = cleanNum(p.p); p.tp = cleanNum(p.tp); p.sl = cleanNum(p.sl); 
    });
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const fetchMarketSnapshot = async () => {
    try {
        const token = await getAccessToken();
        const results = [];
        
        // 거래량 상위 15개 종목 가져오기
        const volRes = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/volume-rank`, {
            params: {
                FID_COND_MRKT_DIV_CODE: 'J', FID_COND_SCR_DIV_CODE: '20171',
                FID_INPUT_ISCD: '0000', FID_DIV_CLS_CODE: '0', 
                FID_BLNG_CLS_CODE: '0', FID_TRGT_CLS_CODE: '0',
                FID_TRGT_EXLS_CLS_CODE: '0', FID_INPUT_PRICE_1: '0', FID_INPUT_PRICE_2: '0',
                FID_VOL_CNT: '0', FID_INPUT_DATE_1: ''
            },
            headers: { ...getKisHeaders('FHPST01710000'), 'authorization': `Bearer ${token}` }
        });

        if (volRes.data.rt_cd === '0' && volRes.data.output) {
            volRes.data.output.slice(0, 15).forEach(it => {
                results.push(`${it.hts_kor_isnm}(${it.mksc_shrn_iscd}): ${it.stck_prpr}원 (${it.prdy_ctrt}%)`);
            });
        }
        
        return results.join(', ');
    } catch (e) {
        console.error('Market Snapshot fetch failed:', e.message);
        return '시장 가격 정보를 불러오지 못했습니다.';
    }
};

// --- State ---
const initialCache = getAiCache();
let cachedAiSignal = initialCache.signal;
let lastCachedHourKey = initialCache.hourKey;
let fetchingAiSignalPromise = null;

// --- Routes ---

router.get('/pulse', async (req, res) => {
    const now = new Date();
    const currentHourKey = `${now.getFullYear()}-${now.getMonth()+1}-${now.getDate()}-${now.getHours()}`;
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // 캐시 확인 (Pulse와 공유)
    const cache = getAiCache();
    let pulseData = cache.pulse;
    // 중첩 구조 대응
    if (pulseData?.pulse) pulseData = pulseData.pulse;
    if (pulseData?.data) pulseData = pulseData.data;

    if (pulseData && cache.hourKey === currentHourKey) {
        // 캐시된 데이터라도 가격은 실시간으로 갱신하여 반환
        await refreshRecommendedPrices(pulseData);
        cleanSignal(pulseData);
        return res.json({ time: timeStr, data: pulseData });
    }

    if (fetchingAiSignalPromise) {
        try {
            const data = await fetchingAiSignalPromise;
            let finalData = data.data || data;
            if (finalData.data) finalData = finalData.data;
            return res.json({ time: timeStr, data: finalData });
        } catch (e) { 
            const cache = getAiCache();
            let pulseData = cache.pulse;
            if (pulseData?.pulse) pulseData = pulseData.pulse;
            if (pulseData?.data) pulseData = pulseData.data;

            if (pulseData) {
                // 폴백 데이터라도 주가는 실시간으로 갱신
                await refreshRecommendedPrices(pulseData);
                return res.json({ time: "Last Sync (Fallback)", data: pulseData, error: e.message });
            }
            return res.status(500).json({ error: 'AI processing failed' }); 
        }
    }

    fetchingAiSignalPromise = (async () => {
        try {
            return await executeHourlyPulse();
        } finally {
            fetchingAiSignalPromise = null;
        }
    })();

    try {
        const result = await fetchingAiSignalPromise;
        const outData = result.data || result;
        res.json({ time: timeStr, data: outData });
    } catch (error) {
        console.error('Pulse logic failed, falling back to cache:', error.message);
        const cache = getAiCache();
        // 다양한 중첩 구조 대응
        let pulseData = cache.pulse;
        if (pulseData?.pulse) pulseData = pulseData.pulse;
        if (pulseData?.data) pulseData = pulseData.data;

        if (pulseData) {
            // 폴백 데이터라도 주가는 실시간으로 갱신
            await refreshRecommendedPrices(pulseData);
            return res.json({ time: "Last Sync (Fallback)", data: pulseData, error: error.message });
        }
        res.status(500).json({ error: error.message });
    }
});

// --- Pulse Logic (Extracted for Cron) ---
export const executeHourlyPulse = async () => {
    const now = new Date();
    const currentHourKey = `${now.getFullYear()}-${now.getMonth()+1}-${now.getDate()}-${now.getHours()}`;
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    try {
        console.log(`🤖 [${timeStr}] 1단계: 시장 분석 및 종목 후보 선별 시작...`);
        const currentNews = await fetchNaverNews();
        const diary = getRagDiary();
        const patterns = getPatternInsights();
        const lastAnalysis = diary[0];
        
        let performanceReport = "과거 데이터 없음";
        if (lastAnalysis) {
            const lastP = lastAnalysis.prediction || lastAnalysis.signal || {};
            const mainTheme = lastP.theme || "알 수 없음";
            
            const allPicks = [
                ...(lastAnalysis.shortTermPicks || []),
                ...(lastAnalysis.longTermPicks || [])
            ];
            
            if (allPicks.length > 0) {
                console.log(`📊 [Pulse] 직전 분석('${mainTheme}') 실적 추적 중...`);
                let totalYield = 0;
                let hitCount = 0;
                
                const performanceResults = await Promise.all(allPicks.map(async (p) => {
                    const currentP = await fetchStockPrice(p.c);
                    const lastPVal = parseInt(p.p?.replace(/[^0-9]/g, '')) || 0;
                    if (currentP && lastPVal > 0) {
                        const yieldRate = parseFloat(((currentP - lastPVal) / lastPVal * 100).toFixed(2));
                        totalYield += yieldRate;
                        if (yieldRate > 0) hitCount++;
                        return `[${p.n}] ${yieldRate}%`;
                    }
                    return null;
                }));
                
                const validResults = performanceResults.filter(r => r !== null);
                const avgYield = validResults.length > 0 ? (totalYield / validResults.length).toFixed(2) : 0;
                const hitRate = validResults.length > 0 ? (hitCount / validResults.length * 100).toFixed(1) : 0;
                
                performanceReport = `
                주요 성적 요약:
                - 직전 주도 테마: '${mainTheme}'
                - 전체 추천 대비 상승 적중률: ${hitRate}%
                - 전체 추천 평균 수익률: ${avgYield}%
                - 세부 종목별 결과: ${validResults.join(', ')}
                `.trim();
            }
        }

        const longTermMemory = patterns.length > 0 ? patterns.map(p => `- ${p.insight}`).join('\n') : '장기 교훈 없음.';

        // --- Pass 1: Selection Prompt ---
        const selectionPrompt = `너는 뉴스 분석 전문가야. 아래 뉴스를 토대로 현재 가장 유망한 '투자 테마'를 정하고, 그 테마와 연계된 상장 종목 5~8개를 선정해서 상장 코드로 알려줘.
        [뉴스 데이터]
        ${currentNews}
        
        [출력 양식 (JSON)]
        { "theme": "주도 테마명", "candidates": [{"n": "종목명", "s": "상장코드"}] }`;

        const selectionRaw = await fetchAiContent(selectionPrompt);
        const candidates = selectionRaw?.candidates || [];
        const mainTheme = selectionRaw?.theme || "분석중";

        // --- 중간 단계: KIS 실시간 가격 조회 ---
        console.log(`📊 [${timeStr}] 2단계: 후보 종목(${candidates.length}개) 실시간 가격 동기화 중...`);
        const syncedPrices = [];
        for (const c of candidates) {
            const price = await fetchStockPrice(c.s);
            if (price) {
                syncedPrices.push(`${c.n}(${c.s}): ${price}원`);
                await sleep(150); // 한투 API 부하 관리
            }
        }
        const priceCtx = syncedPrices.length > 0 ? syncedPrices.join(', ') : "가격 정보 없음";

        // --- Pass 2: Final Analysis Prompt ---
        console.log(`🧠 [${timeStr}] 3단계: 정확한 실시간 가격을 기반으로 최종 리포트 생성 중...`);
        const finalPrompt = `너는 퀀트 트레이더야. [테마: ${mainTheme}]와 아래 [실시간 가격]을 바탕으로 최종 리포트를 작성해.
        [실시간 가격 (Snapshot)]
        ${priceCtx}

        [뉴스/매크로 재료]
        ${currentNews}

        [장기 교훈]
        ${longTermMemory}

        [지시사항]
        1. 반드시 [실시간 가격] 리스트에 있는 종목 중에서 TOP PICK을 선정해.
        2. 리스트에 적힌 가격을 'price' 필드에 정확히 입력해. (예: 189,000원 -> "189000")
        3. 단순한 뉴스를 넘어 해당 기업의 시가총액과 재무 건전성(우량주/잡주)을 테마와 연결하여 철저히 검증할 것.
        4. 현재 환율과 금리가 해당 종목에 미치는 구체적인 취약점이나 수혜 여부를 반드시 'macro' 필드에 포함할 것.
        5. 하락 시나리오(Bear Case) 작성 시, 투자자가 즉시 포지션을 탈출해야 할 '구체적인 위험 징후'를 명시할 것.
        6. 목표가(tp)는 무조건 현재가보다 높게, 손절가(sl)는 낮게 설정해.
        7. JSON 형식으로만 응답해.

        [출력 양식]
        {
          "signal": {
            "theme": "${mainTheme}",
            "themeProb": "90%",
            "stock": "TOP PICK 종목명",
            "symbol": "TOP PICK 코드",
            "price": "현재가(숫자만)",
            "tp": "목표가(숫자만)",
            "sl": "손절가(숫자만)",
            "fundamental": "판단 결과",
            "macro": "매크로 요약",
            "bearCase": "리스크 케이스",
            "reason": "선정 이유",
            "feedback": "투자 조언",
            "shortTermPicks": [{"n": "명", "c": "코드", "p": "현재가", "tp": "목", "sl": "손", "r": "이유"}],
            "longTermPicks": [{"n": "명", "c": "코드", "p": "현재가", "tp": "목", "sl": "손", "r": "이유"}],
            "newInsight": "새로운 교훈"
          }
        }`;

        const finalRaw = await fetchAiContent(finalPrompt);
        if (!finalRaw) throw new Error('Final analysis stage failed');
        const signalData = finalRaw.signal || finalRaw;

        if (signalData) {
            cleanSignal(signalData);
            // 최종 검증: 다시 한번 실시간가 동기화 (오차 방지)
            await refreshRecommendedPrices(signalData);

            saveAiCache({ pulse: { data: signalData } }, currentHourKey);
            saveRagDiary(currentNews, signalData);
            
            if (signalData.newInsight) {
                savePatternInsights(signalData.newInsight);
                console.log(`🧠 [Memory] 새로운 교훈 저장: ${signalData.newInsight}`);
            }
            
            return { data: signalData, time: timeStr };
        } else {
            throw new Error('AI output format invalid');
        }
    } catch (error) {
        console.error('Pulse AI Error:', error.message);
        throw error;
    }
};

// --- AI Helper (Used in passes) ---
const fetchAiContent = async (p) => {
    try {
        const result = await aiModel.generateContent(p);
        const text = result.response.text().trim();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        return JSON.parse(jsonMatch ? jsonMatch[0] : text);
    } catch(e) {
        console.warn('Gemini 실패, Vertex 폴백...', e.message);
        try {
            const vResult = await vertexModel.generateContent(p);
            const vText = vResult.response.candidates[0].content.parts[0].text;
            const vJsonMatch = vText.match(/\{[\s\S]*\}/);
            return JSON.parse(vJsonMatch ? vJsonMatch[0] : vText);
        } catch(vErr) { 
            console.error('Vertex fallback 실패:', vErr.message);
            return null; 
        }
    }
};

// --- History Endpoint ---
router.get('/history', (req, res) => {
    try { res.json(getRagDiary()); } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

export default router;
