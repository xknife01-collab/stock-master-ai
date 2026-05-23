import express from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { aiModel, vertexModel } from '../lib/ai.js';
import { getAccessToken, KIS_BASE_URL, getKisHeaders, fetchStockPrice, fetchStockAnalytics, fetchStockInvestorTrend, fetchMarketRankings, fetchConditionResult } from '../lib/kisCore.js';
import { fetchMacroIndicators } from './macroApi.js';
import { getSupplyCache, saveSupplyCache } from '../lib/supplyCache.js';

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
    
    // Deduplication check: 30 min cooldown OR same hour
    const now = new Date();
    if (diary.length > 0) {
        const lastTime = new Date(diary[0].time).getTime();
        const lastHour = new Date(diary[0].time).getHours();
        const currentHour = now.getHours();
        const timeDiff = now.getTime() - lastTime;
        
        // If it's the same hour AND less than 30 mins, skip. 
        // If hour is different, it's a new scheduled pulse, so allow it.
        if (currentHour === lastHour && timeDiff < 30 * 60 * 1000) {
            console.log(`⏭️ [Diary] ${currentHour}시 분석이 이미 존재하며 시간 간격이 짧아 저장을 건너뜁니다.`);
            return;
        }
    }

    diary.unshift({ 
        time: now.toISOString(), 
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

const fetchNaverNews = async (query = '주식 시장 전망 시황') => {
    const defaultRes = { text: "뉴스 데이터를 불러오지 못했습니다.", sentiment: { bullishPercent: 0, bearishPercent: 0, neutralPercent: 100 } };
    if (!process.env.NAVER_CLIENT_ID || !process.env.NAVER_CLIENT_SECRET) {
        return { text: "네이버 뉴스 키가 등록되지 않았습니다.", sentiment: { bullishPercent: 0, bearishPercent: 0, neutralPercent: 100 } };
    }
    try {
        const response = await axios.get('https://openapi.naver.com/v1/search/news.json', {
            params: { query, display: 30, sort: 'date' },
            headers: {
                'X-Naver-Client-Id': process.env.NAVER_CLIENT_ID,
                'X-Naver-Client-Secret': process.env.NAVER_CLIENT_SECRET
            }
        });
        
        const items = response.data.items || [];
        if (items.length === 0) {
            return { text: "관련 뉴스 없음", sentiment: { bullishPercent: 0, bearishPercent: 0, neutralPercent: 100 } };
        }

        const titles = items.map(it => it.title.replace(/<[^>]*>?/g, '').replace(/&quot;/g, '"'));
        const text = titles.join('\n');

        // 감성 사전 정의
        const bullishKeywords = [
            '상승', '호재', '돌파', '급등', '흑자', '성장', '계약', '체결', '강세', '최고', '수혜', '신고가', 
            '상향', '호실적', '대박', '인수', '진입', '독점', '기대', '전망 밝', '주목', '러브콜', '성공', 
            '순항', '확대', '1위', '급증', '반등', '유입', '상승세', '신제품', '출시', '협력', '파란불', '훈풍',
            '어닝 서프라이즈', '서프라이즈', '날개', '독주', '러시', '활짝', '껑충', '최대 실적'
        ];

        const bearishKeywords = [
            '하락', '악재', '급락', '적자', '감소', '우려', '약세', '최저', '피소', '과징금', '논란', '붕괴', 
            '부진', '쇼크', '하향', '횡령', '배임', '취소', '경고', '위험', '소송', '분쟁', '축소', '실패', 
            '지연', '리스크', '둔화', '어닝쇼크', '포기', '급감', '이탈', '하락세', '찬바람', '먹구름', '빨간불',
            '급락세', '쇼크', '악화', '경고등', '반토막', '쇼크', '과열 우려'
        ];

        let bullishCount = 0;
        let bearishCount = 0;
        let neutralCount = 0;

        titles.forEach(title => {
            let pScore = 0;
            let nScore = 0;

            bullishKeywords.forEach(kw => {
                if (title.includes(kw)) pScore++;
            });

            bearishKeywords.forEach(kw => {
                if (title.includes(kw)) nScore++;
            });

            if (pScore > nScore) {
                bullishCount++;
            } else if (nScore > pScore) {
                bearishCount++;
            } else {
                neutralCount++;
            }
        });

        const total = titles.length;
        const bullishPercent = parseFloat(((bullishCount / total) * 100).toFixed(1));
        const bearishPercent = parseFloat(((bearishCount / total) * 100).toFixed(1));
        const neutralPercent = parseFloat(((neutralCount / total) * 100).toFixed(1));

        return {
            text,
            sentiment: {
                bullishPercent,
                bearishPercent,
                neutralPercent
            }
        };
    } catch (e) { 
        console.error('Naver News Fetch Error:', e.message);
        return defaultRes; 
    }
};

/**
 * 실시간 가격 갱신 헬퍼
 */
const refreshRecommendedPrices = async (signal) => {
    if (!signal) return;
    
    // 1. 메인 픽 가격 갱신 (symbol 필드가 있는 경우)
    if (signal.symbol) {
        const fresh = await fetchStockPrice(signal.symbol);
        if (fresh) signal.price = fresh.price.toString();
    }

    // 2. 단기/장기 추천주 리스트 갱신
    const updatePicks = async (picks) => {
        if(!picks || !Array.isArray(picks)) return;
        await Promise.all(picks.map(async (item) => {
            const fresh = await fetchStockPrice(item.c);
            if (fresh) item.p = fresh.price.toString();
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

/**
 * 과거 AI 추천 종목들의 1일, 3일, 5일 뒤 가격 추적 및 백테스트 데이터 업데이트
 */
const updateBacktestData = async (diary) => {
    // 최근 20개 기록에 대해서만 백테스팅 업데이트 수행 (API 호출 방지 및 속도 향상)
    const targets = diary.slice(0, 20);
    
    for (const entry of targets) {
        // 이미 5일 차까지 최종 완료(finalized)된 건은 패스
        if (entry.backtest && entry.backtest.finalized) {
            continue;
        }

        const symbol = entry.symbol;
        const recommendedPrice = parseFloat(entry.price);
        if (!symbol || isNaN(recommendedPrice) || recommendedPrice <= 0) {
            continue;
        }

        try {
            console.log(`🔍 [Backtest] 종목 추적 중: ${entry.prediction?.stock || symbol} (추천일시: ${entry.time})`);
            const analytics = await fetchStockAnalytics(symbol);
            if (!analytics || !analytics.priceData || analytics.priceData.length === 0) {
                console.log(`⚠️ [Backtest] ${symbol} 일봉 데이터 없음`);
                continue;
            }

            // KIS API 일자별 시세(신규->과거)를 시간순(과거->신규)으로 정렬
            const prices = [...analytics.priceData].reverse();
            
            // 추천 일시를 한국 표준시(KST) YYYYMMDD 포맷으로 변환
            const recKst = new Date(new Date(entry.time).getTime() + 9 * 60 * 60 * 1000);
            const recDateStr = recKst.toISOString().slice(0, 10).replace(/-/g, '');

            // 추천일 당일 또는 바로 다음 영업일 찾기
            let recIdx = prices.findIndex(p => p.date >= recDateStr);
            if (recIdx === -1) {
                console.log(`⚠️ [Backtest] 추천일(${recDateStr}) 이후의 일봉 매칭 실패`);
                continue;
            }

            const basePrice = recommendedPrice; // 추천 시점 실시간 가격 기준

            let day1Price = null, day1Yield = null;
            let day3Price = null, day3Yield = null;
            let day5Price = null, day5Yield = null;

            // 1 영업일 뒤 (recIdx + 1)
            if (recIdx + 1 < prices.length) {
                day1Price = parseFloat(prices[recIdx + 1].close);
                day1Yield = parseFloat(((day1Price - basePrice) / basePrice * 100).toFixed(2));
            }
            // 3 영업일 뒤 (recIdx + 3)
            if (recIdx + 3 < prices.length) {
                day3Price = parseFloat(prices[recIdx + 3].close);
                day3Yield = parseFloat(((day3Price - basePrice) / basePrice * 100).toFixed(2));
            }
            // 5 영업일 뒤 (recIdx + 5)
            if (recIdx + 5 < prices.length) {
                day5Price = parseFloat(prices[recIdx + 5].close);
                day5Yield = parseFloat(((day5Price - basePrice) / basePrice * 100).toFixed(2));
            }

            entry.backtest = {
                day1Price,
                day1Yield,
                day3Price,
                day3Yield,
                day5Price,
                day5Yield,
                finalized: day5Price !== null
            };

            console.log(`✅ [Backtest] 업데이트 완료: ${entry.prediction?.stock} [1D: ${day1Yield || '-'}%, 3D: ${day3Yield || '-'}%, 5D: ${day5Yield || '-'}%]`);
            await sleep(150); // API 레이트 리밋 제어
        } catch (e) {
            console.error(`❌ [Backtest Error] ${symbol} 추적 실패:`, e.message);
        }
    }
};

/**
 * 다이어리 전체 데이터를 요약하여 AI 프롬프트에 주입할 백테스팅 리포트 문자열 생성
 */
const compilePerformanceReport = (diary) => {
    const validEntries = diary.filter(entry => entry.backtest && (entry.backtest.day1Yield !== null || entry.backtest.day3Yield !== null || entry.backtest.day5Yield !== null));
    
    if (validEntries.length === 0) {
        return "과거 추천 종목 백테스팅 데이터 없음 (첫 가동 중)";
    }

    let d1Total = 0, d1Count = 0, d1Hits = 0;
    let d3Total = 0, d3Count = 0, d3Hits = 0;
    let d5Total = 0, d5Count = 0, d5Hits = 0;

    let bestPick = null;
    let worstPick = null;
    const detailLines = [];

    validEntries.forEach(entry => {
        const b = entry.backtest;
        const stockName = entry.prediction?.stock || entry.symbol;
        const themeName = entry.prediction?.theme || "미지정";
        const dateStr = entry.time.slice(5, 10).replace('-', '/'); // "MM/DD"

        if (b.day1Yield !== null) {
            d1Total += b.day1Yield;
            d1Count++;
            if (b.day1Yield > 0) d1Hits++;
        }
        if (b.day3Yield !== null) {
            d3Total += b.day3Yield;
            d3Count++;
            if (b.day3Yield > 0) d3Hits++;
        }
        if (b.day5Yield !== null) {
            d5Total += b.day5Yield;
            d5Count++;
            if (b.day5Yield > 0) d5Hits++;
        }

        // 베스트/워스트 판별 (3일 또는 5일 수익률 기준)
        const maxYield = Math.max(b.day1Yield || -999, b.day3Yield || -999, b.day5Yield || -999);
        const minYield = Math.min(b.day1Yield || 999, b.day3Yield || 999, b.day5Yield || 999);

        if (maxYield !== -999) {
            if (!bestPick || maxYield > bestPick.yield) {
                bestPick = { name: stockName, theme: themeName, yield: maxYield, date: dateStr };
            }
        }
        if (minYield !== 999) {
            if (!worstPick || minYield < worstPick.yield) {
                worstPick = { name: stockName, theme: themeName, yield: minYield, date: dateStr };
            }
        }

        detailLines.push(`* [${dateStr}] 테마: ${themeName} | 종목: ${stockName} (추천가: ${entry.price}원) -> 1일후: ${b.day1Yield !== null ? b.day1Yield + '%' : '대기'}, 3일후: ${b.day3Yield !== null ? b.day3Yield + '%' : '대기'}, 5일후: ${b.day5Yield !== null ? b.day5Yield + '%' : '대기'}`);
    });

    const d1Avg = d1Count > 0 ? (d1Total / d1Count).toFixed(2) : '0';
    const d1Rate = d1Count > 0 ? ((d1Hits / d1Count) * 100).toFixed(1) : '0';

    const d3Avg = d3Count > 0 ? (d3Total / d3Count).toFixed(2) : '0';
    const d3Rate = d3Count > 0 ? ((d3Hits / d3Count) * 100).toFixed(1) : '0';

    const d5Avg = d5Count > 0 ? (d5Total / d5Count).toFixed(2) : '0';
    const d5Rate = d5Count > 0 ? ((d5Hits / d5Count) * 100).toFixed(1) : '0';

    let report = `
[최근 추천 종목 백테스팅 성과 리포트]
- 분석 대상 과거 추천 건수: 총 ${validEntries.length}건
- 1 영업일 뒤 평균 수익률: ${d1Avg}% (적중 상승 성공률: ${d1Rate}%)
- 3 영업일 뒤 평균 수익률: ${d3Avg}% (적중 상승 성공률: ${d3Rate}%)
- 5 영업일 뒤 평균 수익률: ${d5Avg}% (적중 상승 성공률: ${d5Rate}%)
`;

    if (bestPick) {
        report += `- 가장 성공적이었던 추천: ${bestPick.name} (${bestPick.yield}%, 테마: ${bestPick.theme}, 추천일: ${bestPick.date})\n`;
    }
    if (worstPick) {
        report += `- 가장 성적이 부진했던 추천: ${worstPick.name} (${worstPick.yield}%, 테마: ${worstPick.theme}, 추천일: ${worstPick.date})\n`;
    }

    report += `\n- 과거 추천 상세 피드백 로그:\n${detailLines.slice(0, 10).join('\n')}`;

    return report;
};

/**
 * 외국인/기관 매매 상위 종목 가집계 (FHPTJ04400)
 */
const fetchSupplyRank = async () => {
    try {
        const token = await getAccessToken();
        const res = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/foreign-institution-total`, {
            params: {
                FID_COND_MRKT_DIV_CODE: 'V', // 가집계
                FID_COND_SCR_DIV_CODE: '1644',
                FID_INPUT_ISCD: '0000', // 전체
                FID_DIV_CLS_CODE: '0', // 수량
                FID_RANK_SORT_CLS_CODE: '0', // 순매수합계순
                FID_ETC_CLS_CODE: '0'
            },
            headers: { ...getKisHeaders('FHPTJ04400000'), 'authorization': `Bearer ${token}` }
        });
        if (res.data.output && res.data.output.length > 0) {
            const mapped = res.data.output.slice(0, 10).map(it => `${it.hts_kor_isnm}(${it.mksc_shrn_iscd}) [외국인:${it.frgn_ntby_qty}, 기관:${it.orgn_ntby_qty}]`).join(', ');
            saveSupplyCache('ai_supply', mapped);
            return mapped;
        }
        
        // Fallback to cache if empty
        const cached = getSupplyCache('ai_supply');
        if (cached) {
            console.log('📡 [Pulse] 장 마감/주말 데이터 공백으로 이전 거래일 수급 캐시 사용');
            return cached;
        }
        return "데이터 없음";
    } catch (e) {
        console.warn('Supply rank fetch fail:', e.message);
        // Fallback on error
        const cached = getSupplyCache('ai_supply');
        if (cached) return cached;
        return "데이터 불러오기 실패";
    }
};

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
    const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const timeStr = nowKst.getUTCHours().toString().padStart(2, '0') + ':' + nowKst.getUTCMinutes().toString().padStart(2, '0');

    try {
        const force = req.query.force === 'true';
        const result = await executeHourlyPulse(force);
        const outData = result.data || result;
        res.json({ time: timeStr, data: outData });
    } catch (error) {
        console.error('Pulse logic failed, falling back to cache:', error.message);
        const cache = getAiCache();
        let pulseData = cache.pulse;
        if (pulseData?.data) pulseData = pulseData.data;

        if (pulseData) {
            await refreshRecommendedPrices(pulseData);
            return res.json({ time: "Last Sync (Fallback)", data: pulseData, error: error.message });
        }
        res.status(500).json({ error: error.message });
    }
});

// --- Market Hours Detection Helper ---
export const isMarketOpen = () => {
    // 한국 시간(KST) 강제 보정 (UTC+9)
    const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const day = nowKst.getUTCDay(); // 0: 일, 1: 월, ..., 6: 토
    
    // 주말 제외
    if (day === 0 || day === 6) return false;
    
    const hours = nowKst.getUTCHours();
    const minutes = nowKst.getUTCMinutes();
    const timeVal = hours * 100 + minutes; // 예: 09:30 -> 930
    
    // 분석 활성 시간: 장 시작 전(08:30)부터 장 마감(15:30)까지
    return timeVal >= 830 && timeVal <= 1530;
};

// --- Pulse Logic (Extracted for Cron) ---
export const executeHourlyPulse = async (force = false) => {
    // 한국 시간(KST) 강제 보정
    const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const currentHalfHour = now.getUTCMinutes() < 30 ? '00' : '30';
    const currentHourKey = `${now.getUTCFullYear()}-${now.getUTCMonth()+1}-${now.getUTCDate()}-${now.getUTCHours()}-${currentHalfHour}`;
    const timeStr = now.getUTCHours().toString().padStart(2, '0') + ':' + now.getUTCMinutes().toString().padStart(2, '0');

    // 1. 이미 진행 중인 작업이 있으면 해당 약속 반환
    if (fetchingAiSignalPromise) {
        console.log(`⏳ [Pulse] 다른 작업이 진행 중입니다. 완료될 때까지 기다립니다...`);
        return await fetchingAiSignalPromise;
    }

    const cache = getAiCache();
    const marketOpen = isMarketOpen();

    // 2. 장외 시간 및 캐시 확인 (장외 시간이고 캐시가 있으면 Gemini 호출 없이 캐시 즉각 반환)
    if (!force && !marketOpen && cache && cache.pulse) {
        console.log(`💤 [Pulse] 장 마감 상태 (이전 분석 결과 캐시 고정 제공)`);
        let pulseData = cache.pulse.data || cache.pulse;
        await refreshRecommendedPrices(pulseData);
        cleanSignal(pulseData);
        return { data: pulseData, time: timeStr };
    }

    // 3. 캐시 확인 (해당 시간에 이미 완료된 결과가 있는지 - 30분 단위)
    if (!force && cache && cache.hourKey === currentHourKey && cache.pulse) {
        console.log(`✅ [Pulse] 이번 30분 주기(${currentHourKey})의 분석 결과가 이미 존재하여 캐시를 사용합니다.`);
        let pulseData = cache.pulse.data || cache.pulse;
        await refreshRecommendedPrices(pulseData);
        cleanSignal(pulseData);
        return { data: pulseData, time: timeStr };
    }

    // 4. 실행 프로세스 (잠금 설정)
    fetchingAiSignalPromise = (async () => {
        try {
            return await _executeHourlyPulseInternal(currentHourKey, timeStr);
        } finally {
            fetchingAiSignalPromise = null;
        }
    })();

    return await fetchingAiSignalPromise;
};

const _executeHourlyPulseInternal = async (currentHourKey, timeStr) => {
    const krNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
    try {
        console.log(`🤖 [${timeStr}] 1단계: 시장 분석 및 종목 후보 선별 시작...`);
        const currentNewsData = await fetchNaverNews();
        const currentNews = currentNewsData.text;
        const marketNewsSentiment = currentNewsData.sentiment;
        const macro = await fetchMacroIndicators();
        
        // 매크로 지표에 대한 시장 주류 해석(Sentiment) 힌트 추가
        const interpretMacro = (m) => {
            const val = parseFloat(m.value?.replace(/,/g, ''));
            const chg = parseFloat(m.change);
            if (m.label.includes('환율')) {
                if (chg > 0) return "수출주 채산성 개선 기대 및 외인 수급 하방 압력";
                return "원화 강세, 내수주 및 외인 유동성 공급에 긍정적";
            }
            if (m.label.includes('코스피') || m.label.includes('코스닥')) {
                if (chg > 0) return "시장 심리 회복 및 매수세 강화";
                return "과매도 구간 진입 여부 및 기술적 반등 확인 필요";
            }
            return "추세 확인 중";
        };

        const macroCtx = macro.map(m => `- ${m.label}: ${m.value} (${m.change}) [해석: ${interpretMacro(m)}]`).join('\n');

        // --- 다각화된 데이터 수집 (Discovery Funnel) ---
        console.log(`📡 [Pulse] 다각화된 시장 데이터 수집 중 (상승률/거래대금/HTS)...`);
        const [gainers, values, supplyList, htsGolden, htsVolume] = await Promise.all([
            fetchMarketRankings('GAIN'),    // 상승률 상위
            fetchMarketRankings('VALUE'),   // 거래대금 상위
            fetchSupplyRank(),              // 외인/기관 순매수 (기존)
            fetchConditionResult('0'),      // HTS: 골든크로스 (임의 seq)
            fetchConditionResult('1')       // HTS: 거래량 급증 (임의 seq)
        ]);

        // 데이터 레이블링 및 통합
        const discoveryMap = new Map(); // code -> info string

        const addToDiscovery = (list, tag) => {
            if (!Array.isArray(list)) return;
            list.forEach(it => {
                const existing = discoveryMap.get(it.code) || "";
                discoveryMap.set(it.code, `${existing}${tag} `);
            });
        };

        // 레이블링 규칙 적용
        addToDiscovery(gainers, "[🔥급등]");
        addToDiscovery(values, "[💰거래폭발]");
        addToDiscovery(htsGolden, "[📈골든크로스]");
        addToDiscovery(htsVolume, "[📊수급포착]");

        // 통합 리스트 생성 (순매수 상위는 별도로 pass)
        const discoveryCtx = Array.from(discoveryMap.entries())
            .map(([code, tags]) => {
                const name = [...gainers, ...values, ...htsGolden, ...htsVolume].find(x => x.code === code)?.name || "종목";
                return `${tags} ${name}(${code})`;
            }).join(', ');

        const diary = getRagDiary();
        const patterns = getPatternInsights();

        // 1. 과거 추천 종목 백테스팅 데이터 실시간 업데이트 및 파일 저장
        console.log(`📊 [Pulse] 과거 추천 종목 백테스팅 업데이트 및 성과 분석 중...`);
        await updateBacktestData(diary);
        fs.writeFileSync(ragDiaryPath, JSON.stringify(diary, null, 2), 'utf8');

        // 2. 성과 분석 리포트 컴파일
        const performanceReport = compilePerformanceReport(diary);

        const longTermMemory = patterns.length > 0 ? patterns.map(p => `- ${p.insight}`).join('\n') : '장기 교훈 없음.';

        // --- Pass 1: Selection Prompt ---
        const selectionPrompt = `너는 글로벌 매크로 분석가이자 퀀트 전문가야. 
        오늘은 ${krNow.getUTCFullYear()}년 ${krNow.getUTCMonth()+1}월 ${krNow.getUTCDate()}일 ${timeStr}야. 
        아래 [현재 매크로 상황], [외인/기관 수급 가집계], [최신 뉴스], [장기 기억]를 종합하여 
        지금 가장 강력한 '상승 모멘텀'을 가진 주도 테마 1개를 선정하고, 이에 포함되거나 연관된 유망 종목 '총 25개'를 선정해.

        **분석 가이드라인**
        1. [최신 뉴스]를 분석할 때, 발행 시각이 분석일(${krNow.getUTCFullYear()}-${krNow.getUTCMonth()+1}-${krNow.getUTCDate()})로부터 '24시간 이내'인 뉴스를 최우선 가중치(35%)로 반영해.
        2. 오래된 뉴스는 시장의 기대를 이미 선반영한 결과로 간주하고, '새로운 모멘텀'으로서의 가치를 낮게 평가해.
        3. 매크로 지표: 10%, 외인/기관 수급: 30%, 장기 기억(과거 패턴 및 최근 실적): 25%

        [현재 매크로 상황]
        ${macroCtx}

        [실시간 시장 포착 종목 (다각화된 신호)]
        * 레이블 안내: [🔥급등] 상승률 상위, [💰거래폭발] 거래대금 상위, [📈골든크로스] 기술적 지표 개선, [📊수급포착] 거래량 급계
        ${discoveryCtx}

        [외인/기관 수급 (장중 가집계 상위)]
        ${supplyList}

        [최신 뉴스 데이터]
        ${currentNews}
        
        [장기 기억 (과거 패턴 및 최근 실적)]
        ${longTermMemory}
        
        [최근 추천 성적 요약]
        ${performanceReport}

        [지시사항]
        1. 위의 가중치를 엄격히 준수하여 테마 및 종목을 선정해.
        2. 환율(USD/KRW)과 미국채 금리가 현재 섹션(수출주/금융주/성장주 등)에 미치는 영향을 매크로 비중(10%) 내에서 중요하게 고려해.
        3. 외인이나 기관의 수급이 실제로 들어오고 있는 종목을 'candidates'에 우선 포함시켜(30%).
        4. 과거에 반복되었던 패턴이나 최근의 성적(장기 기억)이 현재 상황과 일치하거나 긍정적인 경우 높은 점수(25%)를 부여해.
        5. **필터링 룰 (핵심):** 단순히 오늘 하루 3~5% 올랐다거나 외인 매수가 찍혔다고 해서 무조건 추천하면 안 돼. 네가 알고 있는 해당 종목/섹터의 '장기(구조적) 추세'를 반드시 판단해. 만약 근 1~2년간 전기차 캐즘, 공급 과잉 등으로 장기 우하향 중이던 섹터라면, 오늘의 반등이 '진짜 바닥 탈출(추세 전환)'을 증명할 만한 강력한 뉴스나 매크로 변화가 동반되지 않은 한 데드캣 바운스(Dead Cat Bounce)로 간주하고 강력히 배제해!
        6. **정직한 보류 권한:** 만약 너의 분석 결과, 현재 시장 상황이나 수급, 매크로 지표 상 '진짜 주도주'가 될 만한 종목이 단 하나도 발견되지 않는다면, 억지로 종목을 채우지 말고 candidates 리스트를 **빈 배열([])**로 반환해. 'Structural Decline'인 종목을 추천하는 것은 투자자에게 치명적인 손실을 입히는 행위임을 명심해.
        
        [출력 양식 (JSON)]
        { "theme": "주도 테마명", "candidates": [{"n": "종목명", "s": "상장코드"}] }`;

        const selectionRaw = await fetchAiContent(selectionPrompt);
        console.log('Selection Raw Output:', JSON.stringify(selectionRaw, null, 2));
        const candidates = selectionRaw?.candidates || [];
        const mainTheme = selectionRaw?.theme || "분석중";

        // --- 중간 단계: KIS 실시간 가격 조회 ---
        console.log(`📊 [${timeStr}] 2단계: 후보 종목(${candidates.length}개) 실시간 가격 동기화 중...`);
        const syncedPrices = [];
        for (const c of candidates) {
            const fresh = await fetchStockPrice(c.s);
            if (fresh) {
                syncedPrices.push(`${c.n}(${c.s}): ${fresh.price}원`);
                await sleep(150); // 한투 API 부하 관리
            }
        }
        const priceCtx = syncedPrices.length > 0 ? syncedPrices.join(', ') : "가격 정보 없음";

        // --- Pass 2: Final Analysis Prompt ---
        console.log(`🧠 [${timeStr}] 3단계: 주가 리스크 분석 및 최종 리포트 생성 중...`);
        
        // 대표 종목에 대해 심층 분석 데이터 수집 (리스크 체크용)
        const topPick = candidates[0];
        const topPickCode = topPick?.s;
        
        let stockSpecificNews = "";
        let stockNewsSentiment = null;
        let themeSpecificNews = ""; // 테마 전용 뉴스 추가
        let themeNewsSentiment = null;
        let stockSpecificSupply = "";
        let supplyStats = null;
        let topAnalytics = null;

        if (topPickCode) {
            console.log(`🔍 [Pulse] TOP PICK(${topPick.n}) 및 테마(${mainTheme}) 심층 데이터 수집 중...`);
            const [newsResult, themeNewsResult, supplyResult, analyticsResult] = await Promise.all([
                fetchNaverNews(`${topPick.n} 주식 전망 공시 뉴스`),
                fetchNaverNews(`${mainTheme} 산업 전망 시장 분석`), // 테마 전용 뉴스
                fetchStockInvestorTrend(topPickCode),
                fetchStockAnalytics(topPickCode)
            ]);
            stockSpecificNews = newsResult?.text || "데이터 부족";
            stockNewsSentiment = newsResult?.sentiment || null;
            themeSpecificNews = themeNewsResult?.text || "데이터 부족";
            themeNewsSentiment = themeNewsResult?.sentiment || null;
            stockSpecificSupply = supplyResult?.rawSummary || "정보 없음";
            supplyStats = supplyResult?.stats || null;
            topAnalytics = analyticsResult;

            console.log(`📑 [Pulse] 테마 뉴스 수집 결과: ${themeSpecificNews.length > 50 ? '성공' : '실패/부족'}`);
            console.log(`📊 [Pulse] 종목 수급 수집 결과: ${stockSpecificSupply}`);
        }

        const analyticsCtx = topPickCode ? `
        [TOP PICK: ${topPick.n} 전용 심층 데이터]
        1. 종목별 최신 뉴스/공시:
        ${stockSpecificNews || "데이터 부족"}
        - 종목 뉴스 감성 지수: 호재(Bullish) ${stockNewsSentiment?.bullishPercent || 0}%, 악재(Bearish) ${stockNewsSentiment?.bearishPercent || 0}%, 중립(Neutral) ${stockNewsSentiment?.neutralPercent || 0}%
        
        2. 해당 테마(${mainTheme}) 산업 전망 뉴스:
        ${themeSpecificNews || "데이터 부족"}
        - 테마 뉴스 감성 지수: 호재(Bullish) ${themeNewsSentiment?.bullishPercent || 0}%, 악재(Bearish) ${themeNewsSentiment?.bearishPercent || 0}%, 중립(Neutral) ${themeNewsSentiment?.neutralPercent || 0}%

        3. 외국인/기관 수급 추이 (3일):
        ${stockSpecificSupply}
        - 외국인 5일 누적 순매수 수량: ${supplyStats?.foreign5D !== undefined ? supplyStats.foreign5D.toLocaleString() + '주' : '정보 없음'}
        - 기관 5일 누적 순매수 수량: ${supplyStats?.organ5D !== undefined ? supplyStats.organ5D.toLocaleString() + '주' : '정보 없음'}
        - 외국인 20일 누적 순매수 수량: ${supplyStats?.foreign20D !== undefined ? supplyStats.foreign20D.toLocaleString() + '주' : '정보 없음'}
        - 기관 20일 누적 순매수 수량: ${supplyStats?.organ20D !== undefined ? supplyStats.organ20D.toLocaleString() + '주' : '정보 없음'}
        - 외국인 연속 순매수 일수: ${supplyStats?.foreignConsecutiveDays !== undefined ? supplyStats.foreignConsecutiveDays + '일 연속' : '정보 없음'}
        - 기관 연속 순매수 일수: ${supplyStats?.organConsecutiveDays !== undefined ? supplyStats.organConsecutiveDays + '일 연속' : '정보 없음'}
        
        4. 과거 실적 (재무):
        ${topAnalytics?.financeData ? topAnalytics.financeData.map(f => `- ${f.period}: 매출 ${f.revenue}억, 영업이익 ${f.profit}억`).join('\n        ') : "정보 없음"}

        5. 최근 60일(약 3개월) 주가/거래량 추이:
        ${topAnalytics?.priceData ? topAnalytics.priceData.map(p => `- ${p.date}: 종가 ${p.close}원, 거래량 ${p.vol}주`).join('\n        ') : "정보 없음"}

        6. 기술적 분석 지표 (정량 데이터):
        - RSI (14일 상대강도지수): ${topAnalytics?.technicalIndicators?.rsi || "정보 없음"} (참고: 70 이상 과열, 30 이하 과매도)
        - 5일 이동평균선: ${topAnalytics?.technicalIndicators?.ma5 || "정보 없음"}원
        - 20일 이동평균선: ${topAnalytics?.technicalIndicators?.ma20 || "정보 없음"}원
        - 60일 이동평균선: ${topAnalytics?.technicalIndicators?.ma60 || "정보 없음"}원
        - 이동평균선 배열 추세: ${topAnalytics?.technicalIndicators?.maAlignment || "정보 없음"}
        - 볼린저 밴드 상한선(Upper): ${topAnalytics?.technicalIndicators?.bollinger?.upper || "정보 없음"}원
        - 볼린저 밴드 중심선(SMA20): ${topAnalytics?.technicalIndicators?.bollinger?.middle || "정보 없음"}원
        - 볼린저 밴드 하한선(Lower): ${topAnalytics?.technicalIndicators?.bollinger?.lower || "정보 없음"}원
        - 밴드 내 현재 주가 위치: ${topAnalytics?.technicalIndicators?.bollinger?.positionPercent || "정보 없음"}% (0%는 하한선, 100%는 상한선)
        - 볼린저 밴드 지표 해석: ${topAnalytics?.technicalIndicators?.bollinger?.interpretation || ""}
        `.trim() : "분석 데이터 수집 실패";

        const finalPrompt = `너는 퀀트 트레이더이자 리스크 매니저야. 
        [테마: ${mainTheme}]와 아래 [데이터]를 바탕으로 최종 리포트를 작성해.
        
        **최종 분석 가중치 (TOP PICK에 대해서는 아래 데이터를 100% 활용할 것)**
        - 매크로 지표: 10%
        - 외인/기관 수급 (전체 및 개별 종목): 30%
        - 최신 뉴스 (전체 및 개별 종목): 35%
        - 장기 기억(과거 패턴 및 최근 실적): 25%

        ${analyticsCtx}

        [실시간 가격 (Snapshot)]
        ${priceCtx}

        [뉴스/매크로 재료]
        ${currentNews}
        - 시장 종합 뉴스 감성 지수: 호재(Bullish) ${marketNewsSentiment?.bullishPercent || 0}%, 악재(Bearish) ${marketNewsSentiment?.bearishPercent || 0}%, 중립(Neutral) ${marketNewsSentiment?.neutralPercent || 0}%

        [장기 기억 (과거 패턴 및 교훈)]
        ${longTermMemory}

        [최근 추천 성적 요약]
        ${performanceReport}

        [지시사항 - 리스크 관리 및 최종 추천]
        1. 오늘은 ${krNow.getUTCFullYear()}년 ${krNow.getUTCMonth()+1}월 ${krNow.getUTCDate()}일이므로, 과거 실적 데이터가 아닌 미래 지향적(2026-2027) 시각에서 분석해.
        2. [산업 테마 뉴스]와 [개별 종목 뉴스]가 일치하고, [외인/기관 수급]이 동반되는 '강력한 합치(Concurrence)'가 발견된다면 리스트를 비우지 말고 적극적으로 종목을 추천해.
        3. 'shortTermPicks'는 뉴스 재료가 신선하고 거래량이 폭발한 종목 위주로 선정해.
        4. 'longTermPicks'는 재무 건전성이 확보되고 매크로 상황(환율/금리)이 우호적인 종목 위주로 선정해.
        5. **필터링 대원칙(VETO RULE):** 분석 결과 펀더멘털이 "하락 추세(Structural Decline)"로 판명된 종목은 수급이 아무리 좋아도 절대 TOP PICK(메인 추천)으로 선정하지 마. 억지로 추천할 필요가 없으며, 정합성이 맞지 않으면 모든 추천 종목 필드를 비워둬도 좋아. 
        6. **정직성 원칙 (Sincerity):** 데이터가 불충분하거나 모든 후보가 장기 하락 추세(Structural Decline)라면, TOP PICK(stock 필드)을 null로 설정하고, feedback에 그 이유(추천 보류 근거)를 솔직하고 냉정하게 기술해. "억지 추천"은 금기 사항이야.
        7. 'bearCase'에는 [개별 종목 전용 데이터]에서 발견된 구체적인 아킬레스건을 명시할 것.
        8. 'fundamental' 섹션에서 현재 종목이 "낙폭 과대(Undervalued)"인지 "하락 추세(Structural Decline)"인지를 실적 추이와 가격 추이를 비교하여 명확히 판정해.
        9. 'macro' 필드에는 현재 환율/금리 상황에서 이 테마가 가질 '아킬레스건(치명적 약점)'을 반드시 포함할 것.
        10. **기술적 지표 분석 적용:** 제공된 기술적 분석 지표를 바탕으로 주가 위치를 정밀하게 평가해. 만약 RSI가 70 이상이거나 볼린저 밴드 상한선 부근(positionPercent > 80%)에 도달한 과열 상태라면, 아무리 뉴스가 좋아도 단기 리스크가 큼을 'bearCase' 및 'feedback'에 경고로 지적하고 분할 매수 전략을 추천해. 반대로 RSI가 30 이하이거나 볼린저 밴드 하한선 부근(positionPercent < 20%)에 위치한 과매도 상태라면 낙폭 과대 반등 가치를 분석해 리포트에 반영해.
        11. **이동평균선 배열 가이드:** 이동평균선이 '역배열 (하락 추세 지속)'인 종목은 메인 추천(TOP PICK)에서 가능한 배제하고, '정배열 (강력한 추세 상승)'이거나 막 20일선 골든크로스가 발생한 안정적인 종목 위주로 선정해.
        12. **최근 추천 백테스팅 피드백 학습:** 제공된 [최근 추천 성적 요약] 백테스팅 리포트를 꼼꼼히 확인해. 최근 추천 성공률이 매우 낮거나 마이너스 성적을 낸 특정 테마군(예: 3일/5일 마이너스)이 있다면, 이번 선정 시 유사 테마/유사 지표를 가진 종목에 대한 리스크 판정을 2배 더 응격하게 적용하여 억지 추천을 원천 배제해. 리포트의 feedback이나 reason에서 스스로 과거 성적 피드백 결과(예: '최근 반도체 테마의 성적이 양호하므로 모멘텀 신뢰도가 높음' 또는 '최근 2차전지 테마의 3일 수익률이 마이너스로 부진하므로 이번 2차전지 종목 추천에서는 목표가를 낮춰 보수적으로 접근함')를 인용하며 학습한 흔적을 남겨줘.
        13. **누적 수급 및 연속 순매수 분석 적용:** 제공된 외국인/기관의 5일/20일 누적 순매수 수량 및 연속 순매수 일수를 분석에 반영해. 외인 또는 기관이 3일 이상 연속 순매수 중이거나 5일/20일 누적 순매수 유입이 큰 종목은 상승의 지속성과 세력 수급의 신뢰도가 높은 주도주로 취급하고 매매 전략을 적극적으로 산정해. 반면 5일/20일 누적이 순매도이거나 연속 순매수 일수가 짧다면(0~1일) 일회성 speculative(테마성 일시 반등)일 가능성이 크므로 보수적으로 대응해.
        14. **뉴스 감성 스코어(Sentiment Score) 분석 적용:** 제공된 시장/테마/종목별 '뉴스 감성 지수(호재%, 악재%)'를 리스크 판별 및 목표가 설정에 적극적으로 연계해. 만약 특정 종목이나 테마의 호재성 뉴스 비율이 70% 이상이면 시장 관심도가 매우 뜨거운 상태로 보아 'shortTermPicks' 진입 시 가산점을 부여하되, 악재성 뉴스 비율이 30% 이상이거나 갑작스럽게 악재 뉴스가 증가한 경우에는 단기 리스크가 급증한 것으로 판단해 'VETO RULE(추천 배제)' 또는 손절선(sl)을 타이트하게 조절해. 감정적 편향을 억제하고 이 계량 지표를 우선 신뢰해.
        15. JSON 형식으로만 응답해.

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
            "shortTermPicks": [{"n": "종목명", "c": "코드", "p": "현재가", "tp": "목표가", "sl": "손절가", "t": "수익전략(예: +15% 스윙)"}],
            "longTermPicks": [{"n": "종목명", "c": "코드", "p": "현재가", "tp": "목표가", "sl": "손절가", "r": "투자포인트(한두문장)"}],
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
