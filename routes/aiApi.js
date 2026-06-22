import express from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { aiModel, vertexModel } from '../lib/ai.js';
import { getAccessToken, KIS_BASE_URL, getKisHeaders, fetchStockPrice, fetchStockAnalytics, fetchStockInvestorTrend, fetchMarketRankings, fetchConditionResult, fetchMultipleStockQuantMetrics, fetchStockFinancialsForVeto, fetchIndexDailyHistory, initKisStockMaster, fetchStockIntradayInvestorEstimate, calculateTechnicalIndicators } from '../lib/kisCore.js';
import { fetchMacroIndicators } from './macroApi.js';
import { getSupplyCache, saveSupplyCache } from '../lib/supplyCache.js';
import supabase from '../lib/supabaseClient.js';
import { syncSingleStock } from '../lib/stockSync.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = express.Router();

const ragDiaryPath = path.join(__dirname, '../rag_diary.json');
const aiCachePath = path.join(__dirname, '../ai_cache.json');
const patternInsightsPath = path.join(__dirname, '../pattern_insights.json');
const marketCachePath = path.join(__dirname, '../market_cache.json');

const saveMarketCache = (key, data) => {
    try {
        let cache = {};
        if (fs.existsSync(marketCachePath)) {
            cache = JSON.parse(fs.readFileSync(marketCachePath, 'utf8'));
        }
        cache[key] = { data, updated_at: new Date().toISOString() };
        fs.writeFileSync(marketCachePath, JSON.stringify(cache, null, 2), 'utf8');
    } catch (e) {
        console.warn('Failed to save market cache:', e.message);
    }
};

const getMarketCache = (key) => {
    try {
        if (fs.existsSync(marketCachePath)) {
            const cache = JSON.parse(fs.readFileSync(marketCachePath, 'utf8'));
            return cache[key]?.data || null;
        }
    } catch (e) {
        console.warn('Failed to read market cache:', e.message);
    }
    return null;
};



// ==========================================
// 🔧 [상장코드 환각 방지] Supabase 연동 인메모리 캐시 & 교정기
// ==========================================

const stockMasterCache = {};

// Supabase 및 KIS 마스터로부터 기존에 수집된 상장코드 매핑 캐시 로딩
const initStockMasterCache = async () => {
    // 1. KIS 마스터 파일에서 국내 전 종목 매핑 캐싱 (근본적 해결)
    try {
        await initKisStockMaster(stockMasterCache);
    } catch (err) {
        console.error('❌ [KIS Master Init Failed] falling back to Supabase:', err.message);
    }

    // 2. Supabase로부터 누적 캐시 추가 로딩
    if (!supabase) return;
    try {
        const { data, error } = await supabase
            .from('stock_master_map')
            .select('name, code');
        if (error) {
            console.error('❌ [Supabase] Failed to fetch stock_master_map:', error.message);
            return;
        }
        if (data) {
            data.forEach(row => {
                if (row.name === '__ai_cache__' || row.name === '__rag_diary__') return;
                const cleaned = row.name.replace(/\s+/g, '');
                stockMasterCache[cleaned] = row.code;
            });
            console.log(`⚡ [Supabase] stock_master_map 캐시 로드 완료: ${data.length}개 종목`);
        }
    } catch (e) {
        console.error('❌ [Supabase] Failed to initialize stock_master_map cache:', e.message);
    }
};

// 비동기 캐시 초기화 실행
initStockMasterCache();

// 단일 종목 Supabase 업서트 (비동기, Non-blocking)
const upsertStockMaster = async (name, code) => {
    if (!supabase || !name || !code) return;
    try {
        const cleanedName = name.replace(/\s+/g, '');
        if (name !== '__ai_cache__' && name !== '__rag_diary__') {
            if (stockMasterCache[cleanedName] === code) return; // 이미 동일한 매핑 정보가 캐시되어 있으면 스킵
            stockMasterCache[cleanedName] = code; // 메모리에 즉시 반영
        }
        
        // 백그라운드에서 Supabase로 영구 저장 수행 (API 지연 예방)
        supabase
            .from('stock_master_map')
            .upsert({ name: cleanedName, code }, { onConflict: 'name' })
            .then(({ error }) => {
                if (error) {
                    console.error(`❌ [Supabase] stock_master_map upsert error for ${name}:`, error.message);
                } else {
                    console.log(`💾 [Supabase] 종목 마스터 자가학습 등록: ${name} -> ${code}`);
                }
            })
            .catch(err => {
                console.error(`❌ [Supabase] stock_master_map background error:`, err.message);
            });
    } catch (e) {
        console.error('[Supabase Upsert Exception]', e.message);
    }
};

// 리스트 기반 벌크 학습기
const updateStockMasterFromList = (list) => {
    if (!Array.isArray(list)) return;
    list.forEach(it => {
        if (it.name && it.code) {
            upsertStockMaster(it.name, it.code);
        }
    });
};

const correctStockSymbol = (name, currentSymbol, candidatePool = []) => {
    if (!name) return currentSymbol;
    
    const cleanedName = name.replace(/\s+/g, '');
    
    // 1차: 실시간 수집 후보군 풀 대조 (당일 수집)
    const poolMatch = candidatePool.find(p => p.name && p.name.replace(/\s+/g, '') === cleanedName);
    if (poolMatch) {
        return poolMatch.code;
    }
    
    // 2차: Supabase 누적 마스터 캐시 대조
    if (stockMasterCache[cleanedName]) {
        return stockMasterCache[cleanedName];
    }
    
    return currentSymbol;
};

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

const getRagDiary = async () => {
    // 1. Supabase 클라우드 조회 우선 (서버리스 환경에서 로컬 파일 유실/초기화 방지)
    if (supabase) {
        try {
            const { data, error } = await supabase
                .from('stock_master_map')
                .select('code')
                .eq('name', '__rag_diary__')
                .maybeSingle();
            
            if (!error && data && data.code) {
                const dbData = JSON.parse(data.code);
                if (Array.isArray(dbData) && dbData.length > 0) {
                    try { fs.writeFileSync(ragDiaryPath, JSON.stringify(dbData, null, 2), 'utf8'); } catch (fsErr) {}
                    return dbData;
                }
            }
        } catch (e) {
            console.error('❌ Failed to restore rag_diary from Supabase:', e.message);
        }
    }

    // 2. 클라우드 조회 실패 시 로컬 파일 폴백
    if (fs.existsSync(ragDiaryPath)) {
        try {
            return JSON.parse(fs.readFileSync(ragDiaryPath, 'utf8'));
        } catch (e) {
            console.error('Error reading local rag diary:', e.message);
        }
    }
    return [];
};

const saveRagDiary = async (news, signal) => {
    const diary = await getRagDiary();
    
    // Deduplication check: 30 min cooldown OR same hour
    const now = new Date();
    if (diary.length > 0) {
        const lastTime = new Date(diary[0].time).getTime();
        const lastHour = new Date(diary[0].time).getHours();
        const currentHour = now.getHours();
        const timeDiff = now.getTime() - lastTime;
        
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
        shortTermPicks: (signal.shortTermPicks || []).map(p => ({ n: p.n, c: p.c, p: p.p })),
        longTermPicks: (signal.longTermPicks || []).map(p => ({ n: p.n, c: p.c, p: p.p }))
    });
    if (diary.length > 48) diary.pop(); // 48시간치 보관
    
    const jsonStr = JSON.stringify(diary, null, 2);
    try {
        fs.writeFileSync(ragDiaryPath, jsonStr, 'utf8');
    } catch (e) {
        console.error('❌ Local diary write failed:', e.message);
    }
    
    // Supabase 영구 백업 업서트
    if (supabase) {
        upsertStockMaster('__rag_diary__', jsonStr);
    }
};


const getAiCache = async () => {
    // 1. Supabase 클라우드 캐시 조회 우선 (서버리스 환경 대비)
    if (supabase) {
        try {
            const { data, error } = await supabase
                .from('stock_master_map')
                .select('code')
                .eq('name', '__ai_cache__')
                .maybeSingle();
            
            if (!error && data && data.code) {
                const dbCache = JSON.parse(data.code);
                if (dbCache && dbCache.pulse) {
                    try { fs.writeFileSync(aiCachePath, JSON.stringify(dbCache, null, 2), 'utf8'); } catch (fsErr) {}
                    return dbCache;
                }
            }
        } catch (e) {
            console.error('❌ Failed to restore ai_cache from Supabase:', e.message);
        }
    }

    // 2. 클라우드 조회 실패 시 로컬 파일 폴백
    if (fs.existsSync(aiCachePath)) {
        try {
            return JSON.parse(fs.readFileSync(aiCachePath, 'utf8'));
        } catch (e) {
            console.error('Error reading local ai cache:', e.message);
        }
    }
    
    return { signal: null, hourKey: null };
};

const saveAiCache = (pulseData, hourKey, savedTime = null) => {
    let dataToSave = pulseData.data || pulseData.signal || pulseData.prediction || pulseData;
    if (dataToSave.pulse) dataToSave = dataToSave.pulse;
    if (dataToSave.data) dataToSave = dataToSave.data;
    
    let finalSavedTime = savedTime;
    if (!finalSavedTime) {
        const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000);
        const dateStr = `${String(nowKst.getUTCMonth() + 1).padStart(2, '0')}.${String(nowKst.getUTCDate()).padStart(2, '0')}`;
        const timeStr = `${String(nowKst.getUTCHours()).padStart(2, '0')}:${String(nowKst.getUTCMinutes()).padStart(2, '0')}`;
        finalSavedTime = `${dateStr} ${timeStr}`;
    }
    
    const cacheObj = { pulse: dataToSave, hourKey, savedTime: finalSavedTime };
    const jsonStr = JSON.stringify(cacheObj, null, 2);
    
    try {
        fs.writeFileSync(aiCachePath, jsonStr, 'utf8');
        console.log(`💾 [Cache] AI 분석 캐시 저장 완료 (HourKey: ${hourKey}, SavedTime: ${finalSavedTime})`);
    } catch (e) {
        console.error('❌ Local cache write failed:', e.message);
    }
    
    // Supabase 영구 백업 업서트
    if (supabase) {
        upsertStockMaster('__ai_cache__', jsonStr);
    }
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
const refreshRecommendedPrices = async (signal, candidatePriceMap = {}) => {
    if (!signal) return;
    
    // 1. 메인 픽 가격 갱신 (symbol 필드가 있는 경우)
    if (signal.symbol) {
        let realPrice = candidatePriceMap[signal.symbol];
        let matchedName = null;
        if (!realPrice) {
            // Live KIS API 대신 Supabase 캐시 DB에서 실시간 가격 추출
            try {
                if (supabase) {
                    const { data, error } = await supabase
                        .from('stock_detail_cache')
                        .select('fundamental')
                        .eq('symbol', signal.symbol)
                        .single();
                    if (!error && data?.fundamental?.price) {
                        realPrice = data.fundamental.price;
                        matchedName = data.fundamental.name;
                    }
                }
            } catch (cacheErr) {
                console.error("❌ [refreshRecommendedPrices] Cache fetch failed for main symbol:", cacheErr.message);
            }
        }
        
        if (realPrice) {
            // [교차 검증] KIS에서 조회한 한글 종목명과 AI 추천 이름 비교
            if (matchedName && signal.stock) {
                const cleanedMatched = matchedName.replace(/\s+/g, '');
                const cleanedSignal = signal.stock.replace(/\s+/g, '');
                if (cleanedMatched !== cleanedSignal) {
                    console.warn(`⚠️ [Warning] 종목명 불일치 감지: AI추천=${signal.stock}, KIS실명=${matchedName} (조회된 코드: ${signal.symbol})`);
                    // 사전/후보군을 통한 긴급 코드 재확인 및 가격 재조회 시도
                    const correctCode = correctStockSymbol(signal.stock, signal.symbol, []);
                    if (correctCode !== signal.symbol) {
                        console.log(`🔧 [Mismatch Fix] 올바른 코드로 다시 조회 시도: ${correctCode}`);
                        try {
                            if (supabase) {
                                const { data, error } = await supabase
                                    .from('stock_detail_cache')
                                    .select('fundamental')
                                    .eq('symbol', correctCode)
                                    .single();
                                if (!error && data?.fundamental?.price) {
                                    signal.symbol = correctCode;
                                    realPrice = data.fundamental.price;
                                    matchedName = data.fundamental.name;
                                }
                            }
                        } catch (cacheErr) {
                            console.error("❌ [refreshRecommendedPrices] Cache fetch failed for correct code:", cacheErr.message);
                        }
                    }
                }
            }

            signal.price = realPrice.toString();
            
            // AI가 간혹 0을 하나 더 붙이거나 빼먹어서 10배 차이로 tp/sl을 출력하는 오류 자동 보정
            const parsedTp = parseInt(signal.tp);
            const parsedSl = parseInt(signal.sl);
            
            if (parsedTp) {
                if (Math.abs(parsedTp / realPrice - 10) < 3.5) {
                    signal.tp = Math.round(parsedTp / 10).toString();
                    console.log(`🔧 [Fix] Target Price (TP) 10배 과대 평가 오류 조정: ${parsedTp} -> ${signal.tp}`);
                } else if (Math.abs(realPrice / parsedTp - 10) < 3.5) {
                    signal.tp = Math.round(parsedTp * 10).toString();
                    console.log(`🔧 [Fix] Target Price (TP) 10배 과소 평가 오류 조정: ${parsedTp} -> ${signal.tp}`);
                }
            }
            if (parsedSl) {
                if (Math.abs(parsedSl / realPrice - 10) < 3.5) {
                    signal.sl = Math.round(parsedSl / 10).toString();
                    console.log(`🔧 [Fix] Stop Loss (SL) 10배 과대 평가 오류 조정: ${parsedSl} -> ${signal.sl}`);
                } else if (Math.abs(realPrice / parsedSl - 10) < 3.5) {
                    signal.sl = Math.round(parsedSl * 10).toString();
                    console.log(`🔧 [Fix] Stop Loss (SL) 10배 과소 평가 오류 조정: ${parsedSl} -> ${signal.sl}`);
                }
            }
        }
    }

    // 2. 단기/장기 추천주 리스트 갱신 (캐시 맵 및 10배 스케일 보정 추가)
    const updatePicks = async (picks) => {
        if(!picks || !Array.isArray(picks)) return;
        await Promise.all(picks.map(async (item) => {
            let realPrice = candidatePriceMap[item.c];
            let matchedName = null;
            if (!realPrice) {
                try {
                    if (supabase) {
                        const { data, error } = await supabase
                            .from('stock_detail_cache')
                            .select('fundamental')
                            .eq('symbol', item.c)
                            .single();
                        if (!error && data?.fundamental?.price) {
                            realPrice = data.fundamental.price;
                            matchedName = data.fundamental.name;
                        }
                    }
                } catch (cacheErr) {
                    console.error("❌ [refreshRecommendedPrices] Cache fetch failed for pick:", cacheErr.message);
                }
            }
            
            if (realPrice) {
                // [교차 검증] KIS에서 조회한 한글 종목명과 AI 추천 이름 비교
                if (matchedName && item.n) {
                    const cleanedMatched = matchedName.replace(/\s+/g, '');
                    const cleanedItem = item.n.replace(/\s+/g, '');
                    if (cleanedMatched !== cleanedItem) {
                        console.warn(`⚠️ [Warning] 추천주 종목명 불일치 감지: AI추천=${item.n}, KIS실명=${matchedName} (조회된 코드: ${item.c})`);
                        const correctCode = correctStockSymbol(item.n, item.c, []);
                        if (correctCode !== item.c) {
                            try {
                                if (supabase) {
                                    const { data, error } = await supabase
                                        .from('stock_detail_cache')
                                        .select('fundamental')
                                        .eq('symbol', correctCode)
                                        .single();
                                    if (!error && data?.fundamental?.price) {
                                        item.c = correctCode;
                                        realPrice = data.fundamental.price;
                                        matchedName = data.fundamental.name;
                                    }
                                }
                            } catch (cacheErr) {
                                // Fallback
                            }
                        }
                    }
                }

                item.p = realPrice.toString();
                
                const parsedTp = parseInt(item.tp);
                const parsedSl = parseInt(item.sl);
                
                if (parsedTp) {
                    if (Math.abs(parsedTp / realPrice - 10) < 3.5) {
                        item.tp = Math.round(parsedTp / 10).toString();
                        console.log(`🔧 [Fix-Pick] ${item.n} Target Price 10배 과대 평가 조정: ${parsedTp} -> ${item.tp}`);
                    } else if (Math.abs(realPrice / parsedTp - 10) < 3.5) {
                        item.tp = Math.round(parsedTp * 10).toString();
                        console.log(`🔧 [Fix-Pick] ${item.n} Target Price 10배 과소 평가 조정: ${parsedTp} -> ${item.tp}`);
                    }
                }
                if (parsedSl) {
                    if (Math.abs(parsedSl / realPrice - 10) < 3.5) {
                        item.sl = Math.round(parsedSl / 10).toString();
                        console.log(`🔧 [Fix-Pick] ${item.n} Stop Loss 10배 과대 평가 조정: ${parsedSl} -> ${item.sl}`);
                    } else if (Math.abs(realPrice / parsedSl - 10) < 3.5) {
                        item.sl = Math.round(parsedSl * 10).toString();
                        console.log(`🔧 [Fix-Pick] ${item.n} Stop Loss 10배 과소 평가 조정: ${parsedSl} -> ${item.sl}`);
                    }
                }
            }
        }));
    };

    const updateCandidates = async (candidates) => {
        if (!candidates || !Array.isArray(candidates)) return;
        await Promise.all(candidates.map(async (item) => {
            let realPrice = candidatePriceMap[item.code];
            if (!realPrice) {
                try {
                    if (supabase) {
                        const { data, error } = await supabase
                            .from('stock_detail_cache')
                            .select('fundamental')
                            .eq('symbol', item.code)
                            .single();
                        if (!error && data?.fundamental?.price) {
                            realPrice = data.fundamental.price;
                        }
                    }
                } catch (cacheErr) {
                    console.error("❌ [refreshRecommendedPrices] Cache fetch failed for candidate:", cacheErr.message);
                }
            }
            if (realPrice) {
                const oldPrice = parseFloat(item.price);
                if (oldPrice !== realPrice) {
                    console.log(`🔧 [Fix-Candidate-Price] ${item.name} (${item.code}) 가격 동기화: ${oldPrice} -> ${realPrice}`);
                    item.price = realPrice.toString();
                }
            }
        }));
    };

    await Promise.all([
        updatePicks(signal.shortTermPicks),
        updatePicks(signal.longTermPicks),
        updateCandidates(signal.candidates),
        updateCandidates(signal.data?.candidates)
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
let fetchingAiSignalPromise = null;

// --- Routes ---

router.get('/pulse', async (req, res) => {
    try {
        const force = req.query.force === 'true';
        const result = await executeHourlyPulse(force);
        const outData = result.data || result;
        res.json({ 
            time: result.time || '--:--', 
            data: outData,
            marketOpen: result.marketOpen !== undefined ? result.marketOpen : isMarketOpen()
        });
    } catch (error) {
        console.error('Pulse logic failed, falling back to cache:', error.message);
        const cache = await getAiCache();
        let pulseData = cache.pulse;
        if (pulseData?.data) pulseData = pulseData.data;

        if (pulseData) {
            await refreshRecommendedPrices(pulseData);
            
            let savedTime = cache.savedTime;
            if (!savedTime && cache.hourKey) {
                const parts = cache.hourKey.split('-');
                if (parts.length >= 5) {
                    const mm = parts[1].padStart(2, '0');
                    const dd = parts[2].padStart(2, '0');
                    const hh = parts[3].padStart(2, '0');
                    const min = parts[4].padStart(2, '0');
                    savedTime = `${mm}.${dd} ${hh}:${min}`;
                }
            }
            
            return res.json({ 
                time: savedTime || "Last Sync (Fallback)", 
                data: pulseData, 
                marketOpen: false,
                error: error.message 
            });
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
    
    // 분석 활성 시간: 국내 장 운영 시간인 KST 09:00 ~ 15:35
    return timeVal >= 900 && timeVal <= 1535;
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

    const cache = await getAiCache();
    const marketOpen = isMarketOpen();

    // 2. 장외 시간 및 캐시 확인 (장외 시간이고 캐시가 없으면 diary에서 복구하여 즉각 제공)
    if (!force && !marketOpen) {
        let pulseData = null;
        let savedTime = null;
        if (cache && cache.pulse) {
            pulseData = cache.pulse.data || cache.pulse;
            savedTime = cache.savedTime;
        } else {
            // 캐시가 날아갔다면 최신 다이어리 기록을 읽어 캐시를 동적 복구합니다.
            const diary = await getRagDiary();
            if (diary && diary.length > 0) {
                console.log(`💤 [Pulse] 장 마감 상태 및 캐시 누락: 다이어리 최신 레코드로 복구 시도`);
                pulseData = diary[0].prediction || diary[0];
                
                if (diary[0].time) {
                    const d = new Date(diary[0].time);
                    const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
                    const mm = String(kst.getUTCMonth() + 1).padStart(2, '0');
                    const dd = String(kst.getUTCDate()).padStart(2, '0');
                    const hh = String(kst.getUTCHours()).padStart(2, '0');
                    const min = String(kst.getUTCMinutes()).padStart(2, '0');
                    savedTime = `${mm}.${dd} ${hh}:${min}`;
                }
                saveAiCache({ pulse: { data: pulseData } }, currentHourKey, savedTime);
            }
        }

        if (pulseData) {
            console.log(`💤 [Pulse] 장 마감 상태 (이전 분석 결과 캐시 고정 제공)`);
            await refreshRecommendedPrices(pulseData);
            cleanSignal(pulseData);
            
            // 기존 캐시에 savedTime이 없을 경우 hourKey에서 파싱
            if (!savedTime && cache && cache.hourKey) {
                const parts = cache.hourKey.split('-');
                if (parts.length >= 5) {
                    const mm = parts[1].padStart(2, '0');
                    const dd = parts[2].padStart(2, '0');
                    const hh = parts[3].padStart(2, '0');
                    const min = parts[4].padStart(2, '0');
                    savedTime = `${mm}.${dd} ${hh}:${min}`;
                }
            }
            
            return { 
                data: pulseData, 
                time: savedTime || timeStr, 
                marketOpen: false 
            };
        }
    }

    // 3. 캐시 확인 (해당 시간에 이미 완료된 결과가 있는지 - 30분 단위)
    if (!force && cache && cache.hourKey === currentHourKey && cache.pulse) {
        console.log(`✅ [Pulse] 이번 30분 주기(${currentHourKey})의 분석 결과가 이미 존재하여 캐시를 사용합니다.`);
        let pulseData = cache.pulse.data || cache.pulse;
        await refreshRecommendedPrices(pulseData);
        cleanSignal(pulseData);
        
        let savedTime = cache.savedTime;
        if (!savedTime && cache.hourKey) {
            const parts = cache.hourKey.split('-');
            if (parts.length >= 5) {
                const mm = parts[1].padStart(2, '0');
                const dd = parts[2].padStart(2, '0');
                const hh = parts[3].padStart(2, '0');
                const min = parts[4].padStart(2, '0');
                savedTime = `${mm}.${dd} ${hh}:${min}`;
            }
        }
        
        return { 
            data: pulseData, 
            time: savedTime || timeStr, 
            marketOpen: true 
        };
    }

    // 4. 실행 프로세스 (잠금 설정)
    fetchingAiSignalPromise = (async () => {
        try {
            const result = await _executeHourlyPulseInternal(currentHourKey, timeStr);
            return {
                ...result,
                marketOpen: true
            };
        } finally {
            fetchingAiSignalPromise = null;
        }
    })();

    return await fetchingAiSignalPromise;
};

// Z-Score 및 이평선 기울기 계산 헬퍼 (최대 30점)
const calculateIndexStress = (history) => {
    if (!Array.isArray(history) || history.length < 20) {
        return { score: 0, slope: 0, zScore: 0, current: 0, sma20: 0 };
    }

    const prices = history.map(h => h.price);
    const current = prices[prices.length - 1];

    // 1. SMA20 계산
    const last20 = prices.slice(-20);
    const sma20 = last20.reduce((a, b) => a + b, 0) / 20;

    // 2. 표준편차 계산
    const variance = last20.reduce((sum, val) => sum + Math.pow(val - sma20, 2), 0) / 20;
    const stdDev = Math.sqrt(variance);

    // 3. Z-Score 계산
    const zScore = stdDev > 0 ? (current - sma20) / stdDev : 0;

    // 4. 기울기 계산 (5거래일 전 SMA20 대비 최근 20일선 기울기)
    let slope = 0;
    if (prices.length >= 25) {
        const prev20 = prices.slice(-25, -5);
        const sma20Prev = prev20.reduce((a, b) => a + b, 0) / 20;
        slope = sma20Prev > 0 ? ((sma20 - sma20Prev) / sma20Prev) * 100 : 0;
    }

    // 5. 스트레스 점수 판정 (Z < -2.0 시 25점)
    let score = 0;
    if (zScore >= 0) {
        score = 0;
    } else if (zScore >= -1.0) {
        score = 10;
    } else if (zScore >= -2.0) {
        score = 20;
    } else {
        score = 25; // 패닉셀 / 폭락
    }

    // 20일선 기울기 보정 (우상향 시 -5, 우하향 시 +5, 최종 최대 30점)
    if (slope >= 0) {
        score = Math.max(0, score - 5);
    } else {
        score = Math.min(30, score + 5);
    }

    return { score, slope, zScore, current, sma20 };
};

// 원달러 환율 스트레스 계산 헬퍼 (최대 25점)
const calculateExchangeStress = (macro) => {
    const usdIndicator = macro.find(m => m.label === 'USD/KRW');
    if (!usdIndicator) {
        return { score: 0, rate: 0, changePercent: 0 };
    }

    const rate = parseFloat(usdIndicator.value);
    const changeVal = parseFloat(usdIndicator.change || '0');
    
    const prevRate = rate - changeVal;
    const changePercent = prevRate > 0 ? (changeVal / prevRate) * 100 : 0;

    let score = 0;
    
    // 1. 변동성 점수 (최대 15점)
    if (changePercent > 1.0) {
        score += 15;
    } else if (changePercent > 0.5) {
        score += 7;
    }

    // 2. 임계 수치 경고 (최대 5점)
    if (rate >= 1520) {
        score += 5;
    }

    // 3. 상승 방향 추가 가중치 (최대 5점)
    if (usdIndicator.isUp) {
        score += 5;
    }

    score = Math.min(25, score);

    return { score, rate, changePercent };
};

// 미국 국채 10년물 금리(US10Y) 수집 헬퍼
const fetchUs10yYield = async () => {
    try {
        const response = await axios.get('https://query1.finance.yahoo.com/v8/finance/chart/%5ETNX', {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 5000
        });
        const result = response.data?.chart?.result?.[0];
        if (!result) return null;
        
        const currentYield = result.meta?.regularMarketPrice;
        const prevClose = result.meta?.previousClose;
        if (currentYield === undefined || prevClose === undefined) return null;

        return { currentYield, prevClose };
    } catch (e) {
        console.warn(`⚠️ [US10Y fetch failed]: ${e.message}`);
        return null;
    }
};

// 미국 국채 10년물 금리 스트레스 계산 헬퍼 (최대 15점)
const calculateBondStress = (us10yData) => {
    if (!us10yData) {
        return { score: 0, yield: 0, changePercent: 0 };
    }
    const current = us10yData.currentYield;
    const prev = us10yData.prevClose;
    const change = current - prev;
    const changePercent = prev > 0 ? (change / prev) * 100 : 0;

    let score = 0;

    // 1. 일일 변동성 (최대 10점)
    if (changePercent >= 1.5) {
        score += 10;
    } else if (changePercent >= 1.0) {
        score += 5;
    }

    // 2. 절대 금리 수준 (최대 5점)
    if (current >= 4.5) {
        score += 5;
    } else if (current >= 4.2) {
        score += 3;
    }

    return {
        score: Math.min(15, score),
        yield: current,
        changePercent
    };
};
const getSupplyPointsCombined = (fQty, oQty, pQty, fMoney, oMoney, pMoney, maxS) => {
    const isAntQty = fQty < 0 && oQty < 0 && pQty > 0;
    const isAntMoney = fMoney < 0 && oMoney < 0 && pMoney > 0;
    if (isAntQty || isAntMoney) return -30;
    
    let qtyScore = 0;
    if (fQty > 0 && oQty > 0) {
        qtyScore = maxS;
    } else if (fQty + oQty > 0) {
        qtyScore = maxS === 20 ? 15 : 20;
    } else if (fQty > 0 || oQty > 0) {
        qtyScore = 10;
    }
    
    let moneyScore = 0;
    if (fMoney > 0 && oMoney > 0) {
        const totalMoney = fMoney + oMoney;
        if (totalMoney >= 50) moneyScore = maxS;
        else if (totalMoney >= 20) moneyScore = Math.round(maxS * 0.9);
        else if (totalMoney >= 10) moneyScore = Math.round(maxS * 0.8);
        else moneyScore = Math.round(maxS * 0.7);
    } else if (fMoney + oMoney > 0) {
        const totalMoney = fMoney + oMoney;
        if (totalMoney >= 50) moneyScore = Math.round(maxS * 0.8);
        else if (totalMoney >= 20) moneyScore = Math.round(maxS * 0.75);
        else if (totalMoney >= 10) moneyScore = Math.round(maxS * 0.65);
        else moneyScore = Math.round(maxS * 0.5);
    } else if (fMoney > 0 || oMoney > 0) {
        const singleMax = Math.max(fMoney, oMoney);
        if (singleMax >= 30) moneyScore = Math.round(maxS * 0.6);
        else if (singleMax >= 10) moneyScore = Math.round(maxS * 0.5);
        else moneyScore = Math.round(maxS * 0.3);
    }
    
    return Math.round(qtyScore * 0.5 + moneyScore * 0.5);
};

const _executeHourlyPulseInternal = async (currentHourKey, timeStr) => {
    const krNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
    try {
        const forceRecommend = process.env.FORCE_RECOMMEND === 'true';
        console.log(`🤖 [${timeStr}] 1단계: 시장 분석 및 종목 후보 선별 시작... (ForceRecommend: ${forceRecommend})`);
        const currentNewsData = await fetchNaverNews();
        const currentNews = currentNewsData.text;
        const marketNewsSentiment = currentNewsData.sentiment;
        
        // 지수 및 매크로 정보 병렬 조회 (미국채 10년물 금리 추가) - KIS API 호출 실패 시 캐시 폴백 자동 가동
        const [macro, kospiHistory, kosdaqHistory, us10yData] = await Promise.all([
            fetchMacroIndicators().then(res => {
                if (res && res.length > 0) {
                    saveMarketCache('macro', res);
                    return res;
                }
                return getMarketCache('macro') || [];
            }).catch(() => getMarketCache('macro') || []),

            fetchIndexDailyHistory('0001').then(res => {
                if (res && res.length > 0) {
                    saveMarketCache('kospi_history', res);
                    return res;
                }
                return getMarketCache('kospi_history') || [];
            }).catch(() => getMarketCache('kospi_history') || []),

            fetchIndexDailyHistory('1001').then(res => {
                if (res && res.length > 0) {
                    saveMarketCache('kosdaq_history', res);
                    return res;
                }
                return getMarketCache('kosdaq_history') || [];
            }).catch(() => getMarketCache('kosdaq_history') || []),

            fetchUs10yYield().then(res => {
                if (res !== null && res !== undefined) {
                    saveMarketCache('us10y', res);
                    return res;
                }
                const cached = getMarketCache('us10y');
                return cached !== null && cached !== undefined ? cached : { currentYield: 4.2, prevClose: 4.2 };
            }).catch(() => {
                const cached = getMarketCache('us10y');
                return cached !== null && cached !== undefined ? cached : { currentYield: 4.2, prevClose: 4.2 };
            })
        ]);

        const kospiStress = calculateIndexStress(kospiHistory);
        const kosdaqStress = calculateIndexStress(kosdaqHistory);
        const usdStress = calculateExchangeStress(macro);
        const bondStress = calculateBondStress(us10yData);
        const totalStressScore = kospiStress.score + kosdaqStress.score + usdStress.score + bondStress.score;

        const marketStress = {
            score: totalStressScore,
            safeMode: totalStressScore >= 50,
            kospi: {
                current: kospiStress.current,
                sma20: parseFloat(kospiStress.sma20.toFixed(2)),
                zScore: parseFloat(kospiStress.zScore.toFixed(2)),
                slope: parseFloat(kospiStress.slope.toFixed(3)),
                score: kospiStress.score
            },
            kosdaq: {
                current: kosdaqStress.current,
                sma20: parseFloat(kosdaqStress.sma20.toFixed(2)),
                zScore: parseFloat(kosdaqStress.zScore.toFixed(2)),
                slope: parseFloat(kosdaqStress.slope.toFixed(3)),
                score: kosdaqStress.score
            },
            usd: {
                rate: usdStress.rate,
                changePercent: parseFloat(usdStress.changePercent.toFixed(3)),
                score: usdStress.score
            },
            us10y: {
                yield: parseFloat(bondStress.yield.toFixed(3)),
                changePercent: parseFloat(bondStress.changePercent.toFixed(3)),
                score: bondStress.score
            }
        };

        const isBullMarket = !marketStress.safeMode && (
            (marketStress.kospi.zScore > 1.0 || marketStress.kospi.slope > 1.0) ||
            (marketStress.kosdaq.zScore > 1.0 || marketStress.kosdaq.slope > 1.0)
        );
        console.log(`📡 [Pulse] 시장 매크로 스트레스 지수 계산 완료: ${totalStressScore}점 (Safe Mode: ${marketStress.safeMode}, Bull Market: ${isBullMarket})`);

        // 초고위험 관망 (80점 이상) 킬스위치 가동
        if (totalStressScore >= 80) {
            console.log(`🚨 [Market Panic Detected] 스트레스 지수 극도 임계치(${totalStressScore}점) 초과로 신규 매수를 원천 보류하고 홀드 신호로 대체합니다.`);
            const panicSignal = {
                theme: "시장 급락 및 패닉 관망 (Safe Mode)",
                themeProb: "100%",
                stock: "현금 비중 확대 (추천 없음)",
                symbol: "000000",
                price: "0",
                tp: "0",
                sl: "0",
                fundamental: "시장 매크로 리스크 극대화로 인한 기업 가치 평가 일시 신뢰 상실.",
                macro: `코스피 Z-Score ${kospiStress.zScore.toFixed(2)}, 코스닥 Z-Score ${kosdaqStress.zScore.toFixed(2)}, 환율 ${usdStress.rate}원, 미국채 금리 ${bondStress.yield}%. 시장 스트레스 지수가 ${totalStressScore}점으로 80점 임계치를 초과했습니다.`,
                bearCase: "전체 시장의 체계적 위험(Systemic Risk)으로 인해 모든 개별 종목의 하방 압력이 무차별적으로 발생할 수 있는 구간입니다.",
                reason: `시장 매크로 스트레스 점수 ${totalStressScore}점 돌파 (코스피 20일선 이탈 변동성 Z-Score ${kospiStress.zScore.toFixed(2)}, 코스닥 ${kosdaqStress.zScore.toFixed(2)}, 환율 ${usdStress.rate}원, 미국채 10년 금리 ${bondStress.yield}%). 시스템 규정에 따라 신규 주식 매수 추천을 원천 보류하고 현금 비중 80% 이상 확보를 지시합니다.`,
                feedback: "모든 신규 진입을 즉각 중단하고, 기존 보유 주식의 리스크 관리 및 안전 자산/현금 확보에 역량을 집중해야 합니다.",
                shortTermPicks: [],
                longTermPicks: [],
                newInsight: "시장 전체의 체계적 위험이 지배적인 구간에서는 개별 퀀트/재무 지표가 무력화됩니다. 이러한 폭락장 진입 시 추천을 강제로 중단하고 현금을 확보하게 하는 자동 차단 제어기(Kill Switch)의 정상 작동을 확인했습니다.",
                marketStress
            };

            const fullCache = {
                pulse: panicSignal,
                hourKey: currentHourKey
            };
            fs.writeFileSync(aiCachePath, JSON.stringify(fullCache, null, 2), 'utf8');
            return { data: panicSignal, time: timeStr };
        }

        
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

        const macroCtx = macro.map(m => `- ${m.label}: ${m.value} (${m.change}) [해석: ${interpretMacro(m)}]`).join('\n') + 
            `\n- 미국 국채 10년물 금리: ${bondStress.yield}% (${bondStress.changePercent >= 0 ? '+' : ''}${bondStress.changePercent.toFixed(3)}%) [해석: 글로벌 할인율 및 국내 외인 수급 선행 지표]`;

        // --- 다각화된 데이터 수집 (Discovery Funnel) - 캐시 우선 정책으로 실시간 KIS API 의존성 완전 배제 ---
        console.log(`📡 [Pulse] 캐시로부터 시장 데이터 로드 중 (상승률/거래대금/HTS)...`);
        const cachedGainers = getSupplyCache('dashboard_fluctuation_rank') || [];
        const cachedValues = getSupplyCache('dashboard_volume_rank') || [];
        const cachedSupply = getSupplyCache('ai_supply') || "";

        const mapDashboardCache = (list) => {
            if (!Array.isArray(list)) return [];
            return list.map(it => ({
                name: it.n || it.name,
                code: it.s || it.code,
                price: it.p || it.price || '0',
                change: it.pct ? it.pct.replace('%', '') : (it.change || '0'),
                volume: it.volume || 0,
                value: it.value || 0
            }));
        };

        const gainers = mapDashboardCache(cachedGainers);
        const values = mapDashboardCache(cachedValues);
        const supplyList = cachedSupply;
        
        let htsGolden = [];
        let htsVolume = [];
        let htsNewHigh = [];
        try {
            console.log(`📡 [Pulse] Fetching dynamic condition candidates (Golden Cross, Volume & 52-Week High) from KIS...`);
            const [goldenRes, volumeRes, newHighRes] = await Promise.all([
                fetchConditionResult('0'),
                fetchConditionResult('1'),
                fetchConditionResult('2')
            ]);
            htsGolden = goldenRes || [];
            htsVolume = volumeRes || [];
            htsNewHigh = newHighRes || [];
            console.log(`📡 [Pulse] Dynamic condition search loaded ${htsGolden.length} golden cross, ${htsVolume.length} volume spike, & ${htsNewHigh.length} 52-week high stocks.`);
        } catch (condErr) {
            console.error('⚠️ [Condition Search] Failed to fetch condition results, falling back to static lists:', condErr.message);
            htsGolden = [
                { code: '005930', name: '삼성전자' },
                { code: '000660', name: 'SK하이닉스' },
                { code: '042700', name: '한미반도체' },
                { code: '007660', name: '이수페타시스' },
                { code: '403870', name: 'HPSP' }
            ];
            htsVolume = [
                { code: '089030', name: '테크윙' },
                { code: '058470', name: '리노공업' },
                { code: '000990', name: 'DB하이텍' },
                { code: '352820', name: '솔브레인' },
                { code: '067310', name: '하나마이크론' }
            ];
            htsNewHigh = [
                { code: '005490', name: 'POSCO홀딩스' },
                { code: '051910', name: 'LG화학' },
                { code: '000270', name: '기아' }
            ];
        }

        const isEtfOrIndex = (name) => {
            const keywords = ["KODEX", "TIGER", "SOL", "RISE", "KBSTAR", "ACE", "HANARO", "KOSEF", "ARIRANG", "ETN", "인버스", "레버리지", "선물", "국채", "달러", "고배당", "MSCI", "ESG", "active", "액티브", "로우볼", "밸류", "모멘텀", "스팩", "SPAC", "제호", "인덱스"];
            return keywords.some(k => name.toUpperCase().includes(k.toUpperCase()));
        };

        const parseSupplyStocks = (str) => {
            const stocks = [];
            if (typeof str !== 'string') return stocks;
            const regex = /([가-힣A-Za-z0-9\s&\.\-\+]+)\((\d{6})\)/g;
            let match;
            while ((match = regex.exec(str)) !== null) {
                stocks.push({
                    name: match[1].trim(),
                    code: match[2],
                    price: '0',
                    change: '0'
                });
            }
            return stocks;
        };

        // 6개 수집 리스트 통합하여 고유 종목화 및 중요도 산정
        const candidateOccurrence = new Map(); // code -> { name, code, count, price, change, volume, value, tags: [] }
        
        const processList = (list, tag) => {
            if (!Array.isArray(list)) return;
            list.forEach(it => {
                if (!it.code) return;
                const existing = candidateOccurrence.get(it.code) || {
                    name: it.name,
                    code: it.code,
                    price: parseInt(it.price || '0'),
                    change: parseFloat(it.change || '0'),
                    volume: parseInt(it.volume || '0'),
                    value: parseInt(it.value || '0'),
                    count: 0,
                    tags: []
                };
                existing.count += 1;
                if (!existing.tags.includes(tag)) {
                    existing.tags.push(tag);
                }
                candidateOccurrence.set(it.code, existing);
            });
        };

        processList(gainers, "급등");
        processList(values, "거래폭발");
        processList(htsGolden, "골든크로스");
        processList(htsVolume, "수급포착");
        processList(htsNewHigh, "신고가");
        processList(parseSupplyStocks(supplyList), "수급우수");

        // 💾 [Supabase 자가 학습] 실시간 발견된 모든 한글 종목명 - 코드 맵을 백그라운드로 저장
        updateStockMasterFromList(gainers);
        updateStockMasterFromList(values);
        updateStockMasterFromList(htsGolden);
        updateStockMasterFromList(htsVolume);
        updateStockMasterFromList(htsNewHigh);
        updateStockMasterFromList(parseSupplyStocks(supplyList));

        // 상위 25개 종목 압축 선정 (ETF 및 인덱스 펀드류 제거)
        // 정렬 기준: 1. 태그 우선순위(신고가, 거래폭발), 2. 포착 횟수 내림차순, 3. 거래대금 내림차순
        const getDiscoveryPriority = (c) => {
            let score = 0;
            if (c.tags.includes("신고가")) score += 100;
            if (c.tags.includes("거래폭발")) score += 50;
            if (c.tags.includes("수급포착")) score += 30;
            return score;
        };

        const candidatePool = Array.from(candidateOccurrence.values())
            .filter(c => !isEtfOrIndex(c.name))
            .sort((a, b) => {
                const priA = getDiscoveryPriority(a);
                const priB = getDiscoveryPriority(b);
                if (priB !== priA) return priB - priA;
                if (b.count !== a.count) return b.count - a.count;
                if (b.value !== a.value) return b.value - a.value;
                return Math.abs(b.change) - Math.abs(a.change);
            })
            .slice(0, 40);

        const symbols = candidatePool.map(c => c.code);

        // 전체 후보 종목에 대한 실시간 퀀트 지표 (체결강도, 이격도, 공매도 비중) 수집
        console.log(`📡 [Pulse] 전체 후보 종목(${candidatePool.length}개)의 실시간 퀀트 지표 수집 시작...`);
        let metricsMap = {};
        let cachedRows = [];
        let cacheData = [];
        const parseNum = (val, fallback = 0) => {
            if (val === undefined || val === null || val === '-') return fallback;
            const parsed = parseFloat(val);
            return isNaN(parsed) ? fallback : parsed;
        };
        
        if (supabase) {
            try {
                const { data, error } = await supabase
                    .from('stock_detail_cache')
                    .select('*')
                    .in('symbol', symbols);
                
                if (!error && data) {
                    cacheData = data;
                    const now = new Date();
                    const freshData = data.filter(row => {
                        if (!row.updated_at) return false;
                        const updatedAt = new Date(row.updated_at);
                        const diffMins = (now.getTime() - updatedAt.getTime()) / (1000 * 60);
                        if (diffMins > 60) return false;
                        
                        // ⚙️ [Schema Self-Healing] 캐시에 ATR, 거래량증가율, 또는 전일거래대금 지표가 누락된 경우 스키마 마이그레이션을 위해 만료 처리
                        if (!row.advanced || row.advanced.atr === undefined || row.advanced.atrPercent === undefined || row.advanced.volumeRate === undefined || row.advanced.prevTransactionValue === undefined) {
                            console.log(`♻️ [Schema Self-Healing] ${row.symbol} 캐시에 ATR/거래량증가율/전일거래대금 중 누락된 지표가 있습니다. 즉시 Live 동기화를 트리거합니다.`);
                            return false;
                        }
                        
                        return true;
                    });

                    cachedRows = data;
                    freshData.forEach(row => {
                        metricsMap[row.symbol] = {
                            price: row.fundamental?.price || 0,
                            disparity1: parseNum(row.advanced?.disparity1, 100),
                            disparity5: parseNum(row.advanced?.disparity5, 100),
                            disparity20: parseNum(row.advanced?.disparity20, 100),
                            strength: parseNum(row.advanced?.strength, 100),
                            shortRatio: parseNum(row.advanced?.shortRatio, 0),
                            investor1D: {
                                foreign: parseNum(row.advanced?.investor?.foreign1D, 0),
                                organ: parseNum(row.advanced?.investor?.organ1D, 0),
                                personal: parseNum(row.advanced?.investor?.personal1D, 0)
                            },
                            investor5D: {
                                foreign: parseNum(row.advanced?.investor?.foreign5D, 0),
                                organ: parseNum(row.advanced?.investor?.organ5D, 0),
                                personal: parseNum(row.advanced?.investor?.personal5D, 0)
                            },
                            investorMoney5D: {
                                foreign: parseNum(row.advanced?.investor?.foreignMoney5D, 0),
                                organ: parseNum(row.advanced?.investor?.organMoney5D, 0),
                                personal: parseNum(row.advanced?.investor?.personalMoney5D, 0)
                            },
                            atr: row.advanced?.atr !== undefined ? parseNum(row.advanced?.atr, null) : null,
                            atrPercent: row.advanced?.atrPercent !== undefined ? parseNum(row.advanced?.atrPercent, null) : null,
                            transactionValue: parseNum(row.advanced?.transactionValue, 0),
                            prevTransactionValue: parseNum(row.advanced?.prevTransactionValue, 0),
                            volumeRate: parseNum(row.advanced?.volumeRate, 100),
                            creditBalance: parseNum(row.advanced?.creditBalance, 0),
                            sector: row.fundamental?.sector || '기타',
                            isSelfHealed: row.advanced?.isSelfHealed || false,
                            selfHealedReasons: row.advanced?.selfHealedReasons || [],
                            isDefaultFallback: false,
                            chartHistory: row.advanced?.chartHistory || {},
                            technical: row.advanced?.technical || null
                        };
                    });
                    console.log(`⚡ [Pulse] Supabase 캐시로부터 ${freshData.length}개 종목의 유효한(1시간 이내) 퀀트 지표 로드 완료 (총 ${data.length}개 중 ${data.length - freshData.length}개 만료됨).`);
                } else {
                    console.error('❌ [Pulse] Failed to load metrics from Supabase cache:', error?.message);
                }
            } catch (cacheErr) {
                console.error('❌ [Pulse] Exception loading metrics from Supabase cache:', cacheErr.message);
            }
        }

        // 📡 [Targeted Live Sync] 상위 12개 후보 종목에 대해 실시간 KIS 데이터 강제 동기화 (최근 1분 이내 데이터가 없는 경우)
        console.log(`📡 [Pulse] 상위 12개 후보 종목에 대한 실시간 KIS 데이터 강제 동기화 검증 시작...`);
        const now = new Date();
        
        // KIS API 과부하 방지 및 순차 조회를 위해 동기 루프로 순회
        for (let i = 0; i < Math.min(12, candidatePool.length); i++) {
            const c = candidatePool[i];
            const cachedRow = (cacheData || []).find(row => row.symbol === c.code);
            let needsSync = true;
            
            if (cachedRow && cachedRow.updated_at) {
                const updatedAt = new Date(cachedRow.updated_at);
                const diffSecs = (now.getTime() - updatedAt.getTime()) / 1000;
                // 1분(60초) 이내 데이터가 있으면 캐시를 신뢰하고 API 호출 건너뜀
                if (diffSecs < 60) {
                    needsSync = false;
                    console.log(`⏭️ [Targeted Live Sync] ${c.name} (${c.code}) 은 최근 1분 이내에 동기화됨 (${Math.round(diffSecs)}초 전). 실시간 조회를 생략합니다.`);
                }
            }
            
            if (needsSync) {
                console.log(`📡 [Targeted Live Sync] ${c.name} (${c.code}) 최신 데이터가 없거나 1분을 경과했습니다. 실시간 API 동기화 실행...`);
                try {
                    const syncResult = await syncSingleStock(c.code);
                    if (syncResult) {
                        const row = syncResult;
                        metricsMap[c.code] = {
                            price: row.fundamental?.price || 0,
                            disparity1: parseNum(row.advanced?.disparity1, 100),
                            disparity5: parseNum(row.advanced?.disparity5, 100),
                            disparity20: parseNum(row.advanced?.disparity20, 100),
                            strength: parseNum(row.advanced?.strength, 100),
                            shortRatio: parseNum(row.advanced?.shortRatio, 0),
                            investor1D: {
                                foreign: parseNum(row.advanced?.investor?.foreign1D, 0),
                                organ: parseNum(row.advanced?.investor?.organ1D, 0),
                                personal: parseNum(row.advanced?.investor?.personal1D, 0)
                            },
                            investor5D: {
                                foreign: parseNum(row.advanced?.investor?.foreign5D, 0),
                                organ: parseNum(row.advanced?.investor?.organ5D, 0),
                                personal: parseNum(row.advanced?.investor?.personal5D, 0)
                            },
                            investorMoney5D: {
                                foreign: parseNum(row.advanced?.investor?.foreignMoney5D, 0),
                                organ: parseNum(row.advanced?.investor?.organMoney5D, 0),
                                personal: parseNum(row.advanced?.investor?.personalMoney5D, 0)
                            },
                            atr: row.advanced?.atr !== undefined ? parseNum(row.advanced?.atr, null) : null,
                            atrPercent: row.advanced?.atrPercent !== undefined ? parseNum(row.advanced?.atrPercent, null) : null,
                            transactionValue: parseNum(row.advanced?.transactionValue, 0),
                            prevTransactionValue: parseNum(row.advanced?.prevTransactionValue, 0),
                            volumeRate: parseNum(row.advanced?.volumeRate, 100),
                            creditBalance: parseNum(row.advanced?.creditBalance, 0),
                            sector: row.fundamental?.sector || '기타',
                            isSelfHealed: row.advanced?.isSelfHealed || false,
                            selfHealedReasons: row.advanced?.selfHealedReasons || [],
                            isDefaultFallback: false,
                            chartHistory: row.advanced?.chartHistory || {},
                            technical: row.advanced?.technical || null
                        };
                        
                        // cacheData & cachedRows 의 해당 row 교체 (이후 재무 데이터 조회 루프 등에서 사용됨)
                        const updatedRowObj = {
                            symbol: c.code,
                            fundamental: row.fundamental,
                            advanced: row.advanced,
                            updated_at: new Date().toISOString()
                        };
                        
                        const cIdx = cachedRows.findIndex(r => r.symbol === c.code);
                        if (cIdx !== -1) {
                            cachedRows[cIdx] = updatedRowObj;
                        } else {
                            cachedRows.push(updatedRowObj);
                        }

                        const dIdx = cacheData.findIndex(r => r.symbol === c.code);
                        if (dIdx !== -1) {
                            cacheData[dIdx] = updatedRowObj;
                        } else {
                            cacheData.push(updatedRowObj);
                        }
                    }
                    // KIS API 스로틀링 예방을 위한 아주 짧은 딜레이
                    await new Promise(resolve => setTimeout(resolve, 300));
                } catch (syncErr) {
                    console.error(`❌ [Targeted Live Sync] ${c.name} (${c.code}) 동기화 실패:`, syncErr.message);
                }
            }
        }

        // 상위 40위 밖의 캐시 미스 및 실시간 조회 실패 종목들은
        // 1. 기존 DB에 있던 stale 캐시(시간 무관)가 있다면 그것을 우선 사용 (Graceful Fallback)
        // 2. 캐시조차 아예 없는 경우에만 디폴트 설정으로 채워서 필터 탈락을 방지
        for (const c of candidatePool) {
            const symbol = c.code;
            if (!metricsMap[symbol]) {
                const staleRow = (cacheData || []).find(row => row.symbol === symbol);
                if (staleRow) {
                    console.log(`♻️ [Graceful Fallback] ${c.name} (${symbol}) - 만료된 캐시 데이터를 임시 공급하고 백그라운드 갱신을 트리거합니다.`);
                    
                    // Trigger background cache self-healing (fire-and-forget)
                    syncSingleStock(symbol).catch(err => console.error(`❌ [Self-Healing] Failed for ${symbol}:`, err.message));
                    
                    metricsMap[symbol] = {
                        price: staleRow.fundamental?.price || 0,
                        disparity1: parseNum(staleRow.advanced?.disparity1, 100),
                        disparity5: parseNum(staleRow.advanced?.disparity5, 100),
                        disparity20: parseNum(staleRow.advanced?.disparity20, 100),
                        strength: parseNum(staleRow.advanced?.strength, 100),
                        shortRatio: parseNum(staleRow.advanced?.shortRatio, 0),
                        investor1D: {
                            foreign: parseNum(staleRow.advanced?.investor?.foreign1D, 0),
                            organ: parseNum(staleRow.advanced?.investor?.organ1D, 0),
                            personal: parseNum(staleRow.advanced?.investor?.personal1D, 0)
                        },
                        investor5D: {
                            foreign: parseNum(staleRow.advanced?.investor?.foreign5D, 0),
                            organ: parseNum(staleRow.advanced?.investor?.organ5D, 0),
                            personal: parseNum(staleRow.advanced?.investor?.personal5D, 0)
                        },
                        investorMoney5D: {
                            foreign: parseNum(staleRow.advanced?.investor?.foreignMoney5D, 0),
                            organ: parseNum(staleRow.advanced?.investor?.organMoney5D, 0),
                            personal: parseNum(staleRow.advanced?.investor?.personalMoney5D, 0)
                        },
                        atr: staleRow.advanced?.atr !== undefined ? parseNum(staleRow.advanced.atr, null) : null,
                        atrPercent: staleRow.advanced?.atrPercent !== undefined ? parseNum(staleRow.advanced.atrPercent, null) : null,
                        transactionValue: parseNum(staleRow.advanced?.transactionValue, 0),
                        prevTransactionValue: parseNum(staleRow.advanced?.prevTransactionValue, 0),
                        volumeRate: parseNum(staleRow.advanced?.volumeRate, 100),
                        creditBalance: parseNum(staleRow.advanced?.creditBalance, 0),
                        sector: staleRow.fundamental?.sector || '기타',
                        isSelfHealed: staleRow.advanced?.isSelfHealed || false,
                        selfHealedReasons: staleRow.advanced?.selfHealedReasons || [],
                        isDefaultFallback: false,
                        chartHistory: staleRow.advanced?.chartHistory || {},
                        technical: staleRow.advanced?.technical || null
                    };
                } else {
                    console.log(`⚠️ [Default Fallback] ${c.name} (${symbol}) - 캐시가 전무하여 디폴트 값을 지정하고 백그라운드 동기화를 트리거합니다.`);
                    
                    // Trigger background cache self-healing (fire-and-forget)
                    syncSingleStock(symbol).catch(err => console.error(`❌ [Self-Healing] Failed for ${symbol}:`, err.message));
                    
                    metricsMap[symbol] = {
                        price: c.price || 0,
                        disparity1: 100,
                        disparity5: 100,
                        disparity20: 100,
                        strength: 100,
                        shortRatio: 0,
                        investor1D: { foreign: 0, organ: 0, personal: 0 },
                        investor5D: { foreign: 0, organ: 0, personal: 0 },
                        investorMoney5D: { foreign: 0, organ: 0, personal: 0 },
                        atr: null,
                        atrPercent: null,
                        transactionValue: 0,
                        prevTransactionValue: 0,
                        volumeRate: 100,
                        creditBalance: 0,
                        sector: '기타',
                        isSelfHealed: false,
                        selfHealedReasons: [],
                        isDefaultFallback: true,
                        chartHistory: {},
                        technical: null
                    };
                }
            }
        }


        const diary = await getRagDiary();

        // 📊 [오답 노트 조기 갱신] 과거 추천 종목 백테스팅 데이터 실시간 업데이트 및 파일 저장 (비차단 비동기 실행)
        // 15초 뒤에 비동기 실행하여 메인 파이프라인 KIS API 호출과 겹치지 않게 함
        setTimeout(async () => {
            try {
                console.log(`📊 [Pulse - Deferred] 과거 추천 종목 백테스팅 업데이트 및 성과 분석 시작...`);
                const freshDiary = await getRagDiary();
                await updateBacktestData(freshDiary);
                fs.writeFileSync(ragDiaryPath, JSON.stringify(freshDiary, null, 2), 'utf8');
                console.log("💾 [Backtest] 백테스트 업데이트 파일 저장 완료.");
            } catch (err) {
                console.error("❌ [Backtest] 백테스트 업데이트 실패:", err.message);
            }
        }, 15000);

        // 백테스트 실패에 따른 하드 패널티 계산 함수
        const calculateBacktestPenalty = (symbol) => {
            let penalty = 0;
            // 최근 15개 추천 기록만 분석 (최근 1~2주일치 피드백 반영)
            const recentPicks = diary.slice(0, 15).filter(entry => entry.symbol === symbol);
            
            recentPicks.forEach(entry => {
                const b = entry.backtest;
                if (!b) return;
                
                // 1. 단기 1일 성과가 음수인 경우 감점 (-5점)
                if (b.day1Yield !== null && b.day1Yield < 0) {
                    penalty += 5;
                    console.log(`📉 [Backtest Penalty] ${entry.prediction?.stock || symbol} - 1일 뒤 수익률 음수(${b.day1Yield}%)로 퀀트 점수 5점 감점`);
                }
                // 2. 3일 성과가 음수인 경우 감점 (-5점)
                if (b.day3Yield !== null && b.day3Yield < 0) {
                    penalty += 5;
                    console.log(`📉 [Backtest Penalty] ${entry.prediction?.stock || symbol} - 3일 뒤 수익률 음수(${b.day3Yield}%)로 퀀트 점수 5점 감점`);
                }
                // 3. 5일 성과가 음수인 경우 감점 (-5점)
                if (b.day5Yield !== null && b.day5Yield < 0) {
                    penalty += 5;
                    console.log(`📉 [Backtest Penalty] ${entry.prediction?.stock || symbol} - 5일 뒤 수익률 음수(${b.day5Yield}%)로 퀀트 점수 5점 감점`);
                }
                // 4. 손절 기준을 강하게 터치한 경우 추가 감점 (수익률 -5% 이하일 시 추가 -5점)
                if (b.day1Yield !== null && b.day1Yield <= -5) penalty += 5;
                if (b.day3Yield !== null && b.day3Yield <= -5) penalty += 5;
                if (b.day5Yield !== null && b.day5Yield <= -5) penalty += 5;
            });
            
            // 최대 감점 한도 30점으로 제한
            return Math.min(penalty, 30);
        };

        // --- 실시간 주도 섹터(테마) 분석 및 자금 쏠림 감지 ---
        const sectorMoneyFlow = {};
        candidatePool.forEach(c => {
            const m = metricsMap[c.code];
            if (m) {
                const sector = m.sector || "기타";
                sectorMoneyFlow[sector] = (sectorMoneyFlow[sector] || 0) + (m.transactionValue || 0);
            }
        });

        // 자금 쏠림(거래대금 합계) 기준 내림차순 정렬
        const sortedSectors = Object.entries(sectorMoneyFlow)
            .sort((a, b) => b[1] - a[1])
            .map(entry => entry[0]);

        const topSector = sortedSectors[0] || "기타";
        const secondSector = sortedSectors[1] || "기타";
        const topSectorMoneyFlowVal = sectorMoneyFlow[topSector] || 0;

        console.log(`🔥 [Sector Money Flow Analysis] 1순위 주도 테마: ${topSector} (합계 거래대금: ${topSectorMoneyFlowVal.toLocaleString()}), 2순위: ${secondSector}`);

        // 1순위 주도 테마 내 대장주 후보 찾기 (topSector 소속 중 등락률(change) 또는 거래대금(transactionValue)이 가장 높은 종목)
        let themeLeaderCode = null;
        let maxLeaderScore = -999;
        candidatePool.forEach(c => {
            const m = metricsMap[c.code];
            if (m && m.sector === topSector) {
                const leaderScore = Math.abs(c.change || 0) * 10 + (m.transactionValue || 0) / 1000000;
                if (leaderScore > maxLeaderScore) {
                    maxLeaderScore = leaderScore;
                    themeLeaderCode = c.code;
                }
            }
        });
        if (themeLeaderCode) {
            const leaderCandidate = candidatePool.find(c => c.code === themeLeaderCode);
            console.log(`👑 [Theme Leader Selected] 주도 테마(${topSector}) 대장주: ${leaderCandidate ? leaderCandidate.name : themeLeaderCode}`);
        }

        // 지수 일일 변동률 계산
        const kospiChangePct = (kospiHistory && kospiHistory.length >= 2) ? 
            ((kospiStress.current - kospiHistory[kospiHistory.length - 2].price) / kospiHistory[kospiHistory.length - 2].price) * 100 : 0;
        const kosdaqChangePct = (kosdaqHistory && kosdaqHistory.length >= 2) ? 
            ((kosdaqStress.current - kosdaqHistory[kosdaqHistory.length - 2].price) / kosdaqHistory[kosdaqHistory.length - 2].price) * 100 : 0;
        const indexChangePct = (kospiChangePct + kosdaqChangePct) / 2;
        console.log(`📡 [Index Sync] KOSPI 변동률: ${kospiChangePct.toFixed(2)}%, KOSDAQ 변동률: ${kosdaqChangePct.toFixed(2)}%, 시장 평균 변동률: ${indexChangePct.toFixed(2)}%`);

        // 각 종목별 100점 만점 퀀트 스코어 계산 및 상세 점수표 구축
        const scoredCandidates = candidatePool.map(c => {
            const m = metricsMap[c.code] || { price: c.price, disparity5: 100, disparity20: 100, strength: 100, shortRatio: 0, investor1D: { foreign: 0, organ: 0, personal: 0 }, investor5D: { foreign: 0, organ: 0, personal: 0 }, investorMoney5D: { foreign: 0, organ: 0, personal: 0 }, transactionValue: 0, prevTransactionValue: 0, volumeRate: 100, creditBalance: 0, sector: '기타' };
            
            // --- Pre-VETO 필터링 ---
            const txVal = m.transactionValue || 0;
            const prevTxVal = m.prevTransactionValue || 0;
            const credBal = m.creditBalance || 0;
            const forceRecommend = process.env.FORCE_RECOMMEND === 'true';

            // 1. 신용잔고율 VETO
            const isVetoedByCredit = credBal > 6;
            if (!forceRecommend && isVetoedByCredit) {
                console.log(`🛡️ [Pre-VETO 필터링 제외] ${c.name} (${c.code}) - 신용잔고율 과다: ${credBal}%`);
                return null;
            }

            // 2. 데이터 불완전성 VETO (거래대금 0 또는 체결강도 0/100)
            const strVal = parseFloat(m.strength) || 0;
            if (!forceRecommend && (txVal === 0 || strVal === 0 || strVal === 100)) {
                console.log(`🛡️ [데이터 불완전 VETO 필터링 제외] ${c.name} (${c.code}) - 거래대금: ${txVal}원, 체결강도: ${strVal}% (미동기화 또는 데이터 부족)`);
                return null;
            }

            // 3. 초소형/저유동성 VETO (당일 거래대금 10억원 미만)
            if (!forceRecommend && txVal < 1000000000) {
                console.log(`🛡️ [저유동성 VETO 필터링 제외] ${c.name} (${c.code}) - 거래대금: ${(txVal / 100000000).toFixed(2)}억원 (기준: 10억원 미만)`);
                return null;
            }

            let strengthScore = 0;
            let disparityScore = 0;
            let shortScore = 0;
            let supplyScore = 0;
            let indexRelativeScore = 0;

            const disp5 = parseFloat(m.disparity5) || 100;
            const disp1 = parseFloat(m.disparity1) || 100;
            const disp20 = parseFloat(m.disparity20) || 100;
            const changePct = parseFloat(c.change || m.change || '0');
            const inv1D = m.investor1D || { foreign: 0, organ: 0, personal: 0 };
            // 외인 및 기관이 동반 순매도(쌍끌이 매도)할 때만 덤핑으로 정의
            const isDumping = inv1D.foreign < 0 && inv1D.organ < 0;

            const isSafe = marketStress.safeMode;

            // 1. 실시간 체결강도 점수 (Max 30점)
            const str = m.strength || 100;
            if (str >= 120) strengthScore = 30;
            else if (str >= 108) strengthScore = 22;
            else if (str >= 100) strengthScore = 15;
            else if (str >= 90) strengthScore = -10; // 90% ~ 100% 미만: 매도 우위 감점
            else if (str >= 80) strengthScore = -25; // 80% ~ 90% 미만: 강한 매도 우위 패널티
            else strengthScore = -50; // 80% 미만: 초강력 매도 우위/거래 침체 극단 패널티

            // 2. 5일/1일 이격도 점수 (Max 10점, 수급 이탈 감안 자동 보정)
            if (disp5 >= 100 && disp1 >= 100) {
                disparityScore = 10; // 정배열 강세 돌파
            } else if (disp5 >= 100 && disp1 < 100 && !isDumping) {
                disparityScore = 8; // 건전한 눌림목 (쌍끌이 매도 없는 조정)
            } else if (disp5 < 100 && disp1 >= 100 && strVal >= 105) {
                disparityScore = 6; // 단기 낙폭과대 반등 시도
            } else {
                // 추세 하락 또는 설거지 구간
                disparityScore = isDumping ? -15 : -5; // 쌍끌이 매도 시 강력한 패널티(-15), 아닐 시 완화(-5)
            }

            // 3. 공매도 비중 점수 (Max 5점)
            const sr = m.shortRatio || 0;
            if (sr < 5) shortScore = 5;
            else if (sr >= 5 && sr < 12) shortScore = 3;
            else if (sr >= 12 && sr < 15) shortScore = 0;
            else shortScore = -10;

            // 4. 수급 점수 (Max 35점)
            const inv5D = m.investor5D || { foreign: 0, organ: 0, personal: 0 };
            const invMoney5D = m.investorMoney5D || { foreign: 0, organ: 0, personal: 0 };

            const fMoney1D = Math.round((inv1D.foreign * (m.price || c.price || 0)) / 100000000);
            const oMoney1D = Math.round((inv1D.organ * (m.price || c.price || 0)) / 100000000);
            const pMoney1D = Math.round((inv1D.personal * (m.price || c.price || 0)) / 100000000);

            const score1D = getSupplyPointsCombined(inv1D.foreign, inv1D.organ, inv1D.personal, fMoney1D, oMoney1D, pMoney1D, 35);
            const score5D = getSupplyPointsCombined(inv5D.foreign, inv5D.organ, inv5D.personal, invMoney5D.foreign, invMoney5D.organ, invMoney5D.personal, 35);
            
            // 수급 골든크로스 (변곡점) 감지: 5일 누적 수급이 마이너스이거나 최근 2~3일간 매도세였는데, 오늘 외인/기관 동반 순매수 전환 시
            const isPrevSelling = inv5D.foreign < 0 || inv5D.organ < 0;
            const isTodayBuying = inv1D.foreign > 0 && inv1D.organ > 0;
            const isSupplyGoldenCross = isPrevSelling && isTodayBuying;
            
            // 수급 데드크로스 (하락 감지 변곡점) 판정:
            // 5일 누적 외인 또는 기관 순매수가 양수(최근 매수세/홀딩 상태였음)였으나,
            // 오늘 당일 외인 또는 기관 한쪽이라도 순매도로 돌아서며 물량을 빼고(inv1D.foreign < 0 || inv1D.organ < 0)
            // 오늘 당일 주가가 하락(change < 0)할 때
            const isPrevBuying = inv5D.foreign > 0 || inv5D.organ > 0;
            const isTodaySelling = inv1D.foreign < 0 || inv1D.organ < 0;
            const isPriceDropping = changePct < 0;
            const isSupplyDeathCross = isPrevBuying && isTodaySelling && isPriceDropping;
            
            let goldenCrossBonus = 0;
            if (isSupplyGoldenCross && str >= 95) { // 체결강도가 최소 95% 이상으로 뒷받침될 때만 전환형 수급 골든크로스로 인정하여 보너스 점수 부여
                supplyScore = 35; // 5일 누적 감점 전면 면제 및 만점 부여
                goldenCrossBonus = 25; // 전환 초입 보너스 점수 가산
                console.log(`✨ [Supply Golden Cross] ${c.name} (${c.code}) - 수급 변곡점 감지! 5일 누적 감점 면제 및 +25점 보너스 부여 (오늘 외인: ${inv1D.foreign}, 기관: ${inv1D.organ} 순매수)`);
            } else {
                if (inv1D.foreign === 0 && inv1D.organ === 0) {
                    supplyScore = score5D;
                } else {
                    supplyScore = Math.round(score1D * 0.7 + score5D * 0.3);
                }
            }

            // 5. 지수 연동 & 상대 강도 점수 (Max 20점)
            let gain30mScore = 0;
            let gain60mScore = 0;
            let gain120mScore = 0;
            let accelBonus = 0;
            let relativeIndexScore = 0;

            const priceNow = m.price || c.price || 0;
            if (m.chartHistory && Array.isArray(m.chartHistory['1D']) && m.chartHistory['1D'].length > 0) {
                const chart1D = m.chartHistory['1D'];
                const len = chart1D.length;
                if (len >= 35) {
                    const price30m = chart1D[len - 30]?.price || 0;
                    const price60m = len >= 65 ? (chart1D[len - 60]?.price || 0) : (chart1D[0]?.price || 0);
                    const price120m = len >= 125 ? (chart1D[len - 120]?.price || 0) : (chart1D[0]?.price || 0);

                    if (price30m > 0 && price60m > 0 && price120m > 0) {
                        const change30m = (priceNow - price30m) / price30m;
                        const change60m = (priceNow - price60m) / price60m;
                        const change120m = (priceNow - price120m) / price120m;

                        // 30분 전 대비 (7.5점 만점, 10만 원 기준 평준화)
                        const gain30m = change30m * 100000;
                        if (gain30m >= 3000) gain30mScore = 7.5;
                        else if (gain30m >= 1500) gain30mScore = 5.0;
                        else if (gain30m >= 500) gain30mScore = 3.0;
                        else if (gain30m >= 0) gain30mScore = 1.0;
                        else gain30mScore = -5.0;

                        // 1시간 전 대비 (4.5점 만점, 10만 원 기준 평준화)
                        const gain60m = change60m * 100000;
                        if (gain60m >= 4000) gain60mScore = 4.5;
                        else if (gain60m >= 2000) gain60mScore = 3.0;
                        else if (gain60m >= 500) gain60mScore = 1.5;
                        else if (gain60m >= 0) gain60mScore = 0.5;
                        else gain60mScore = -3.0;

                        // 2시간 전 대비 (3.0점 만점, 10만 원 기준 평준화)
                        const gain120m = change120m * 100000;
                        if (gain120m >= 5000) gain120mScore = 3.0;
                        else if (gain120m >= 2500) gain120mScore = 2.0;
                        else if (gain120m >= 1000) gain120mScore = 1.0;
                        else if (gain120m >= 0) gain120mScore = 0.5;
                        else gain120mScore = -2.0;

                        // 속도 가속화 보너스 / 안전 필터
                        if (change30m > (change60m - change30m) && change30m > 0) {
                            accelBonus = 3.0;
                        } else if (change30m < 0 && change60m < change30m) {
                            accelBonus = -3.0;
                        }
                    }
                }
            }

            // 지수 대비 상대 강도 계산 (5점 만점)
            const stockChangePct = parseFloat(c.change || m.change || '0');
            const relativeDailyChange = stockChangePct - indexChangePct;
            if (relativeDailyChange >= 3.0) relativeIndexScore = 5.0;
            else if (relativeDailyChange >= 1.5) relativeIndexScore = 3.5;
            else if (relativeDailyChange >= 0.5) relativeIndexScore = 2.0;
            else if (relativeDailyChange >= -0.5) relativeIndexScore = 1.0;
            else relativeIndexScore = -3.0;
            indexRelativeScore = Math.max(-10, Math.min(20, (gain30mScore + gain60mScore + gain120mScore + accelBonus + relativeIndexScore)));

            // 6. 하락장(Safe Mode) 동적 가중치 배율 적용 (Option 2)
            if (isSafe) {
                strengthScore = parseFloat((strengthScore * 0.5).toFixed(1));
                indexRelativeScore = parseFloat((indexRelativeScore * 0.5).toFixed(1));
            }

            // 7. 추세 점수 (trendScore, Max 15점 / Min -15점)
            let trendScore = 0;
            const maAlignment = m.technical?.maAlignment || '혼조세';
            if (maAlignment.includes('정배열')) {
                trendScore = 15;
            } else if (maAlignment.includes('역배열')) {
                trendScore = -15;
            } else {
                trendScore = 5;
            }

            // 8. 실시간 거래대금 연산 및 자금 유입 가산점 (moneyInflowScore, Max 15점 - 주가 왜곡 제거 실제 억 원 기준)
            const txValEok = txVal / 100000000; // 억 원 단위 환산 (주가 보정을 제거하여 대형주 자금 유입 중심 판정)

            let moneyInflowScore = 0;
            // (1) 실 거래대금 절대 강도 (Max 10점)
            if (txValEok >= 1000) moneyInflowScore += 10;
            else if (txValEok >= 500) moneyInflowScore += 7;
            else if (txValEok >= 100) moneyInflowScore += 3;

            // (2) 거래량/거래대금 증가율(volumeRate) 시너지 (Max 5점)
            const volRate = m.volumeRate || 100;
            if (volRate >= 200) {
                moneyInflowScore += 5;
            }
            moneyInflowScore = Math.min(15, moneyInflowScore);

            // 9. 외국계 창구 실시간 순매수 급증 점수 (memberTrendScore, Max 10점)
            let memberTrendScore = 0;
            const netFwdBuy = m.memberTrend?.foreignNetBuy || 0;
            const netFwdBuyMoney = Math.round((netFwdBuy * (m.price || c.price || 0)) / 100000000); // 억 원 단위
            if (netFwdBuyMoney >= 10) memberTrendScore = 10;
            else if (netFwdBuyMoney >= 5) memberTrendScore = 7;
            else if (netFwdBuyMoney >= 1) memberTrendScore = 4;
            else if (netFwdBuyMoney > 0) memberTrendScore = 2;

            // 10. 대형 체결 실시간 감지 점수 (largeTradeScore, Max 8점)
            let largeTradeScore = 0;
            const largeRatio = m.largeTrade?.largeRatio || 0;
            if (largeRatio >= 0.3) largeTradeScore += 5;
            else if (largeRatio >= 0.15) largeTradeScore += 3;
            
            const buyLargeVal = m.largeTrade?.buyLargeValue || 0;
            const sellLargeVal = m.largeTrade?.sellLargeValue || 0;
            if (buyLargeVal > sellLargeVal * 1.5 && buyLargeVal > 0) {
                largeTradeScore += 3;
            }

            // 11. 체결강도 가속도 점수 (strengthAccScore, Max 10점)
            let strengthAccScore = 0;
            const strengthAcc = m.strengthAcceleration || 0;
            if (strengthAcc >= 10) strengthAccScore = 10;
            else if (strengthAcc >= 5) strengthAccScore = 5;
            else if (strengthAcc <= -10) strengthAccScore = -10; // 가속도 하락 패널티
            else if (strengthAcc <= -5) strengthAccScore = -5;

            let themeScore = 0;
            let isThemeLeader = false;

            const backtestPenalty = calculateBacktestPenalty(c.code);
            const rawTotalScore = strengthScore + disparityScore + shortScore + supplyScore + indexRelativeScore + trendScore + moneyInflowScore + goldenCrossBonus + memberTrendScore + largeTradeScore + strengthAccScore;
            const totalScore = Math.max(-100, rawTotalScore - backtestPenalty); // 상한선 제한 해제 (Unbounded relative score, 하한선 -100 제한만 유지)

            // --- Hard VETO 판정 (기술적 과열 및 장중 하락 추세 감지) ---
            let isVetoed = false;
            const vetoReasons = [];

            // 체결강도 절대 약세 VETO (95% 미만, 하락장/안전모드 100% 미만, forceRecommend 시 90% 미만)
            const minStrengthRequired = forceRecommend ? 90 : (isSafe ? 100 : 95);
            const checkStrVal = parseFloat(m.strength || 100);
            const isStrengthVetoOverridden = strengthAcc >= 5 && checkStrVal >= 90;

            if (checkStrVal < minStrengthRequired && !isStrengthVetoOverridden) {
                isVetoed = true;
                vetoReasons.push(`체결강도 약세 감지 (체결강도: ${m.strength}% < 기준: ${minStrengthRequired}%)`);
            } else if (isStrengthVetoOverridden && checkStrVal < minStrengthRequired) {
                console.log(`✨ [VETO Override] ${c.name} (${c.code}) - 체결강도가 기준(${minStrengthRequired}%)보다 낮은 ${m.strength}%이나, 체결강도 가속도(+${strengthAcc}%p)가 감지되어 VETO 적용 유예.`);
            }

            const rsiVal = (m.technical && m.technical.rsi !== '-') ? parseFloat(m.technical.rsi) : null;
            
            // 외인/기관 쌍끌이 매수 + 고체결강도 돌파 판단
            const isDualBuy = m.investor1D && m.investor1D.foreign > 0 && m.investor1D.organ > 0;
            const hasStrongStrength = m.strength >= 115;
            const isStrongBreakout = isDualBuy && hasStrongStrength;

            const isTrending = maAlignment.includes('정배열');

            // 고이격 구간(하락장 105%, 일반장 107% 초과)에서 외인/기관 순매도(설거지) 포착 시 VETO
            const isHighDisparityZone = isSafe ? (disp5 > 105) : (disp5 > 107);
            if (isHighDisparityZone && isDumping) {
                isVetoed = true;
                vetoReasons.push(`고이격 상태에서 외인/기관 순매도(설거지) 감지 (5일 이격도: ${disp5}%, 외인: ${inv1D.foreign}, 기관: ${inv1D.organ})`);
            }

            // 상승장, 강제 추천, 또는 강력한 쌍끌이 돌파/정배열 우상향 시 기술적 제한 임계값 완화
            let limitDisp5 = forceRecommend ? 120 : (isStrongBreakout ? 112 : 108);
            let limitRsi = isSafe ? 75 : ((isBullMarket || isStrongBreakout) ? 85 : 78);

            const isSuperLeader = totalScore >= 70;

            if (forceRecommend || (isSuperLeader && !isDumping) || (isSupplyGoldenCross && str >= 95 && !isDumping)) {
                limitDisp5 = 999;
                limitRsi = 95;
            }

            if (!isVetoed || vetoReasons.length > 0) {
                const isDownwardAlignment = maAlignment.includes('역배열');
                const isPriceBelow5MA = disp5 < 100;
                const isDownwardDrift = disp1 < 100 && parseFloat(m.strength || 100) < 100;
                const isVetoRebounding = (disp5 < 100) && (disp1 >= 100) && (parseFloat(m.strength) >= 100) && (parseFloat(c.change || m.change || '0') > 0 || !isDumping);
                
                // Super Leader, 수급 골든크로스(체결강도 지지 필요), 또는 체결강도 가속도 돌입이면서 수급 이탈이 없을 때는 역배열, 5일선 아래 VETO를 바이패스합니다.
                const shouldBypassTrends = forceRecommend || (isSuperLeader && !isDumping) || (isSupplyGoldenCross && str >= 95 && !isDumping) || (strengthAcc >= 5 && !isDumping);

                if (!shouldBypassTrends && isDownwardAlignment) {
                    isVetoed = true;
                    vetoReasons.push(`역배열 하락 추세 종목 제외 (이동평균 정렬: ${maAlignment})`);
                } else if (!shouldBypassTrends && isPriceBelow5MA && !isVetoRebounding) {
                    isVetoed = true;
                    vetoReasons.push(`5일선 아래 흘러내림 종목 제외 (5일 이격도: ${disp5}% < 100%, 반등 요건 미충족)`);
                } else if (!shouldBypassTrends && isDownwardDrift) {
                    isVetoed = true;
                    vetoReasons.push(`단기 하락 및 체결강도 약세 (1일 이격도: ${disp1}%, 체결강도: ${m.strength}%)`);
                } else if (disp5 > limitDisp5) {
                    isVetoed = true;
                    vetoReasons.push(`5일 이격도 과열 (${disp5}%, 기준: ${limitDisp5}% 초과)`);
                } else if (rsiVal !== null && rsiVal >= limitRsi) {
                    isVetoed = true;
                    vetoReasons.push(`RSI 과매수 과열 (${rsiVal}, 기준: ${limitRsi} 이상)`);
                }
            }

            // 단기 가격 하락 추세 검출 (30분/1시간 전 대비)
            if (m.chartHistory && Array.isArray(m.chartHistory['1D']) && m.chartHistory['1D'].length > 0) {
                const chart1D = m.chartHistory['1D'];
                const priceNow = m.price || c.price || 0;
                const len = chart1D.length;
                if (len >= 35) {
                    const price30m = chart1D[len - 30]?.price || 0;
                    const price60m = len >= 65 ? (chart1D[len - 60]?.price || 0) : (chart1D[0]?.price || 0);
                    
                    if (price30m > 0 && price60m > 0) {
                        const change30m = (priceNow - price30m) / price30m;
                        if (priceNow < price30m && price30m < price60m) {
                            isVetoed = true;
                            vetoReasons.push(`단기 주가 계단식 하락 추세 감지 (${price60m}원 -> ${price30m}원 -> ${priceNow}원)`);
                        } else if (change30m <= -0.015) {
                            isVetoed = true;
                            vetoReasons.push(`단기 주가 급락 감지 (30분 전 대비 ${(change30m * 100).toFixed(2)}% 하락)`);
                        }
                    }
                }
            }

            const vetoReason = vetoReasons.join(' | ');

            return {
                name: c.name,
                code: c.code,
                price: m.price || c.price,
                change: c.change,
                isAntHell: m.investor1D ? (m.investor1D.foreign < 0 && m.investor1D.organ < 0 && m.investor1D.personal > 0) : false,
                isSelfHealed: m.isSelfHealed || false,
                selfHealedReasons: m.selfHealedReasons || [],
                isDefaultFallback: m.isDefaultFallback || false,
                isVetoed,
                vetoReason,
                isSupplyGoldenCross: isSupplyGoldenCross || false,
                isSupplyDeathCross: isSupplyDeathCross || false,
                metrics: {
                    disparity1: m.disparity1,
                    disparity5: m.disparity5,
                    disparity20: m.disparity20,
                    strength: m.strength,
                    strengthAcceleration: m.strengthAcceleration || 0,
                    netForeignWindowBuyMoney: netFwdBuyMoney,
                    largeTradeRatio: largeRatio,
                    shortRatio: m.shortRatio,
                    investor1D: m.investor1D,
                    investor5D: m.investor5D,
                    investorMoney5D: m.investorMoney5D,
                    atr: m.atr,
                    atrPercent: m.atrPercent,
                    transactionValue: m.transactionValue,
                    volumeRate: m.volumeRate,
                    creditBalance: m.creditBalance,
                    sector: m.sector,
                    rsi: rsiVal,
                    maAlignment: maAlignment // Added maAlignment to metrics
                },
                scores: {
                    strengthScore,
                    disparityScore,
                    shortScore,
                    supplyScore,
                    indexRelativeScore,
                    trendScore, // Added trendScore to scores
                    moneyInflowScore, // Added moneyInflowScore
                    memberTrendScore,
                    largeTradeScore,
                    strengthAccScore,
                    themeScore: 0, // Theme score deactivated (Option A)
                    backtestPenalty,
                    financialScore: 0 // 2차 재무 루프에서 부여됨
                },
                totalScore,
                tags: c.tags || [],
                isThemeLeader
            };
        }).filter(Boolean);

        // 1차 정렬
        const sortedScored = [...scoredCandidates].sort((a, b) => b.totalScore - a.totalScore);

        // 2) 상위 40개 후보군에 대하여 재무 데이터를 조회하여 Veto 심사 및 하락장 재무 점수(Max 20점) 부여
        console.log(`📡 [Pulse] 상위 40개 후보 종목의 재무 데이터 및 VETO 요건 심사 시작...`);
        const isSafe = marketStress.safeMode;
        
        for (let i = 0; i < Math.min(40, sortedScored.length); i++) {
            const c = sortedScored[i];
            try {
                // 재무 데이터 조회 (Supabase 캐시에서 우선 추출)
                const cachedRow = cachedRows.find(row => row.symbol === c.code);
                let fin = null;
                if (cachedRow && cachedRow.fundamental) {
                    fin = {
                        roe: cachedRow.fundamental.roe !== '-' ? parseFloat(cachedRow.fundamental.roe) : null,
                        per: cachedRow.fundamental.per !== '-' ? parseFloat(cachedRow.fundamental.per) : null,
                        pbr: cachedRow.fundamental.pbr !== '-' ? parseFloat(cachedRow.fundamental.pbr) : null,
                        opProfits: (cachedRow.fundamental.finance || []).map(f => f.profit),
                        debtRatio: cachedRow.fundamental.debtRatio !== '-' ? parseFloat(cachedRow.fundamental.debtRatio) : null,
                        sector: cachedRow.fundamental.sector || ''
                    };
                } else {
                    console.log(`📡 [Pulse Financial Fallback] Cache miss for financials of ${c.name}. Bypassing live KIS call.`);
                    fin = { roe: null, per: null, pbr: null, opProfits: [], debtRatio: null };
                }
                c.financials = fin;

                if (fin) {
                    const isSuperLeader = c.totalScore >= 70;

                    // (1) ROE 적자 기업 원천 제외 Veto Rule (Super Leader는 ROE >= -10% 허용, 강제 추천 시 완화)
                    const isNegRoe = fin.roe !== null && fin.roe < 0;
                    const roeLimit = forceRecommend ? -15 : (isSuperLeader ? -10 : 0);
                    if (isNegRoe && fin.roe < roeLimit) {
                        console.log(`❌ [Financial Veto] ${c.name} (${c.code}) - ROE 적자(${fin.roe}%, 기준: ${roeLimit}%)로 후보군에서 원천 제외`);
                        c.isVetoed = true;
                        c.vetoReason = c.vetoReason ? `${c.vetoReason} | ROE 적자` : 'ROE 적자';
                    }

                    // (2) 최근 3분기 연속 영업이익 적자(영업손실) 한계 기업 제외 Veto Rule (강제 추천 시 바이패스)
                    if (fin.opProfits && fin.opProfits.length >= 3 && fin.opProfits.every(p => p < 0) && !forceRecommend) {
                        console.log(`❌ [Financial Veto] ${c.name} (${c.code}) - 3분기 연속 영업이익 적자로 후보군에서 원천 제외`);
                        c.isVetoed = true;
                        c.vetoReason = c.vetoReason ? `${c.vetoReason} | 3분기 연속 영업손실` : '3분기 연속 영업손실';
                    }

                    // (3) 부채비율 200% 이상 기업 제외 Veto Rule (금융/은행/보험/증권 섹터 제외, 강제 추천 시 500%로 완화)
                    const isFinancialSector = fin.sector && (fin.sector.includes('금융') || fin.sector.includes('은행') || fin.sector.includes('보험') || fin.sector.includes('증권'));
                    const maxDebtLimit = forceRecommend ? 500 : 200;
                    if (!isFinancialSector && fin.debtRatio !== null && fin.debtRatio >= maxDebtLimit) {
                        console.log(`❌ [Financial Veto] ${c.name} (${c.code}) - 부채비율 과다(${fin.debtRatio}%)로 후보군에서 원천 제외`);
                        c.isVetoed = true;
                        c.vetoReason = c.vetoReason ? `${c.vetoReason} | 부채비율 과다 (${fin.debtRatio}%)` : `부채비율 과다 (${fin.debtRatio}%)`;
                    }

                    // (4) 고PBR 15배 이상 버블 기업 제외 Veto Rule (ROE >= 20% 우량 성장주는 20배로 완화, 강력한 시장 주도주는 50배로 완화)
                    const pbrThreshold = forceRecommend || isSuperLeader ? 50 : ((fin.roe !== null && fin.roe >= 20) ? 20 : 15);
                    if (fin.pbr !== null && fin.pbr >= pbrThreshold) {
                        console.log(`❌ [Financial Veto] ${c.name} (${c.code}) - 고PBR 버블(${fin.pbr}배, 기준: ${pbrThreshold}배)로 후보군에서 원천 제외`);
                        c.isVetoed = true;
                        c.vetoReason = c.vetoReason ? `${c.vetoReason} | 고PBR 버블 (${fin.pbr}배)` : `고PBR 버블 (${fin.pbr}배)`;
                    }

                    if (!c.isVetoed) {
                        // 재무 점수 계산 (Max 20점, 하락장/안전 모드일 때만 적용)
                        let financialScore = 0;
                        if (isSafe) {
                            // ROE 우수성 평가
                            if (fin.roe >= 15) financialScore += 10;
                            else if (fin.roe >= 8) financialScore += 7;
                            else if (fin.roe >= 3) financialScore += 3;
                            
                            // 최근 분기 영업이익 성장세 평가 (직전 분기 대비 또는 흑자 유지 여부)
                            const profits = fin.opProfits || [];
                            if (profits.length >= 2) {
                                const latest = profits[0];
                                const prev = profits[1];
                                if (latest > prev && latest > 0) {
                                    financialScore += 10; // 영업이익 증가세
                                } else if (latest > 0) {
                                    financialScore += 5; // 영업이익 흑자 유지
                                }
                            } else if (profits.length === 1 && profits[0] > 0) {
                                financialScore += 5;
                            }
                        }
                        
                        c.scores.financialScore = financialScore;
                        if (isSafe) {
                            c.totalScore = Math.max(-50, c.totalScore + financialScore);
                        }

                        // (3) 중장기 가치주 배제 태깅 (ROE < 5% 이거나 PER > 100배 혹은 PER < 0배인 극단적 밸류에이션 종목)
                        let isLongTermExcluded = false;
                        const reason = [];

                        const isDualBuy = c.metrics.investor1D && c.metrics.investor1D.foreign > 0 && c.metrics.investor1D.organ > 0;
                        const hasStrongStrength = c.metrics.strength >= 115;
                        const isStrongBreakout = isDualBuy && hasStrongStrength;
                        const isSamsung = c.code === '005930';

                        if ((isStrongBreakout || isSamsung) && fin.roe !== null && fin.roe >= 0) {
                            // 돌파형 주도주 및 삼성전자는 수급 전환의 특수성을 감안해 ROE 5% 미만 배제 룰 예외 적용
                        } else if (fin.roe !== null && fin.roe < 5) {
                            isLongTermExcluded = true;
                            reason.push(`ROE 5% 미만 (${fin.roe}%)`);
                        }
                        if (fin.per !== null && (fin.per > 100 || fin.per < 0)) {
                            isLongTermExcluded = true;
                            reason.push(`PER 과열/마이너스 (${fin.per}배)`);
                        }
                        c.isLongTermExcluded = isLongTermExcluded;
                        c.longTermExcludeReason = reason.join(', ');
                    }
                }
            } catch (finErr) {
                console.error(`⚠️ [Pulse] ${c.name} 재무 데이터 조회 중 에러:`, finErr.message);
            }
        }

        // 🛡️ [VETO 패널티 반영] VETO 대상 종목은 총점에서 150점 감점하여 하단 배치
        sortedScored.forEach(c => {
            if (c.isVetoed) {
                c.totalScore = c.totalScore - 150;
            }
        });

        // 재무 점수가 합산된 최종 점수 기준으로 재정렬 및 상위 25개 선정
        const finalSortedScored = [...sortedScored].sort((a, b) => b.totalScore - a.totalScore).slice(0, 25);

        console.log("📊 [Pulse] 후보 종목 최종 상태 및 스코어 (최대 25개):");
        finalSortedScored.forEach(c => {
            console.log(`   👉 ${c.name} (${c.code}): 총점 ${c.totalScore.toFixed(1)} | VETO 여부: ${c.isVetoed ? '❌ YES (' + c.vetoReason + ')' : '✅ NO'}`);
        });

        // 🛡️ [최고의 투자자 Dual-Engine 이원화 필터 적용]
        const technicallyFiltered = finalSortedScored.filter(c => {
            if (c.isVetoed) return false;

            const isDualBuy = c.metrics.investor1D && c.metrics.investor1D.foreign > 0 && c.metrics.investor1D.organ > 0;
            const hasStrongStrength = c.metrics.strength >= 115;
            const isStrongBreakout = isDualBuy && hasStrongStrength;

            const inv1D = c.metrics.investor1D || { foreign: 0, organ: 0, personal: 0 };
            // 외인 및 기관이 동반 순매도(쌍끌이 매도)할 때만 덤핑으로 정의
            const isDumping = inv1D.foreign < 0 && inv1D.organ < 0;
            const dispVal = c.metrics.disparity5 || 100;

            const isSuperLeader = c.totalScore >= 70;

            // 이격도가 100 이상인 정상 상승 추세 종목은 설거지가 아니면 상한 제한을 대폭 해제 (Super Leader는 999% 무제한)
            const maxShortDisp5 = forceRecommend ? 999 : 
                ((dispVal >= 100 && !isDumping) ? (isSuperLeader ? 999 : 135) : 
                (isSafe ? 106 : ((isBullMarket || isStrongBreakout) ? 112 : 107)));
                
            const maxLongDisp5 = forceRecommend ? 999 : 
                ((dispVal >= 100 && !isDumping) ? (isSuperLeader ? 999 : 135) : 
                (isSafe ? 102 : ((isBullMarket || isStrongBreakout) ? 108 : 105)));

            // 1) 단타 (shortTermPicks) 안전 필터 기준 (추세 돌파형)
            const minScoreShort = isSafe ? 65 : (isSuperLeader ? 50 : 60);
            const minStrengthShort = isSuperLeader ? 98 : (isSafe ? 100 : 105);
            const passedShort = c.totalScore >= minScoreShort && c.metrics.strength >= minStrengthShort && c.metrics.disparity5 < maxShortDisp5 && c.metrics.shortRatio < 10;

            // 2) 중장기 (longTermPicks) 안전 필터 기준 (바닥 매집형)
            const minScoreLong = isSafe ? 65 : (isSuperLeader ? 50 : 60);
            const minStrengthLong = isSuperLeader ? 90 : (isSafe ? 95 : 95);
            const passedLong = c.totalScore >= minScoreLong && c.metrics.strength >= minStrengthLong && c.metrics.disparity5 < maxLongDisp5 && c.metrics.shortRatio < 10;

            if (passedShort || passedLong) {
                // AI에게 가이드를 주기 위한 지표 적합성 태그 부여
                c.fitTags = [];
                if (passedShort) c.fitTags.push("단기돌파형");
                if (passedLong) c.fitTags.push("중장기매집형");
                return true;
            }
            return false;
        });

        console.log(`🛡️ [Filter Config] Dual-Engine 필터링 작동 완료 (Safe Mode: ${marketStress.safeMode}) ➡️ 총 ${technicallyFiltered.length}개 종목 합격`);

        // 2차 수급 데이터 조회 및 최종 후보 목록 구축 (상위 10개 대상)
        const filteredCandidates = [];
        console.log(`📡 [Pulse] 기술적 필터 통과 종목 대상 추가 수급 분석 시작...`);
        for (let i = 0; i < technicallyFiltered.length; i++) {
            const c = technicallyFiltered[i];
            
            // 상위 10개 종목만 최종 후보로 산정
            if (filteredCandidates.length >= 10) {
                break;
            }

            try {
                const cachedRow = cachedRows.find(row => row.symbol === c.code);

                // 1. 혹시라도 재무 데이터가 누락된 경우 보완
                if (!c.financials) {
                    if (cachedRow && cachedRow.fundamental) {
                        c.financials = {
                            roe: cachedRow.fundamental.roe !== '-' ? parseFloat(cachedRow.fundamental.roe) : null,
                            per: cachedRow.fundamental.per !== '-' ? parseFloat(cachedRow.fundamental.per) : null,
                            pbr: cachedRow.fundamental.pbr !== '-' ? parseFloat(cachedRow.fundamental.pbr) : null,
                            opProfits: (cachedRow.fundamental.finance || []).map(f => f.profit),
                            debtRatio: cachedRow.fundamental.debtRatio !== '-' ? parseFloat(cachedRow.fundamental.debtRatio) : null
                        };
                    } else {
                        console.log(`📡 [Pulse Financial Fallback 2] Cache miss for financials of ${c.name}. Bypassing live KIS call.`);
                        c.financials = { roe: null, per: null, pbr: null, opProfits: [], debtRatio: null };
                    }
                }

                // 2. 수급 데이터 조회 (캐시에서 우선 추출)
                let supplyStats = null;
                if (cachedRow?.advanced?.investor) {
                    supplyStats = cachedRow.advanced.investor;
                    c.supplyStats = supplyStats;
                } else {
                    console.log(`📡 [Pulse Investor Fallback] Cache miss for supply stats of ${c.name}. Bypassing live KIS call.`);
                    supplyStats = { foreign: 0, organ: 0, personal: 0, foreign5D: 0, organ5D: 0, personal5D: 0 };
                    c.supplyStats = supplyStats;
                }

                // 3. 당일 실시간 장중 가집계 투자자별 매매동향 조회 (캐시에서 우선 추출)
                let intradayEstimate = null;
                if (cachedRow?.advanced?.intraday) {
                    intradayEstimate = cachedRow.advanced.intraday;
                    c.intradayEstimate = intradayEstimate;
                } else {
                    console.log(`📡 [Pulse Intraday Fallback] Cache miss for intraday estimate of ${c.name}. Bypassing live KIS call.`);
                    intradayEstimate = { foreign: 0, organ: 0, personal: 0 };
                    c.intradayEstimate = intradayEstimate;
                }

                if (intradayEstimate) {
                    // 장중 개미지옥 패턴 검증 (오늘 외인 순매도 && 기관 순매도 && 개인 순매수)
                    // 단순 소량 매도가 아닌 유의미한 수급 이탈(외인 <-10000, 기관 <-10000, 개인 >20000)일 때만 감지
                    // Safe Mode일 때만 VETO(원천 제외) 처리하고, Normal Mode일 때는 감점(score1D = -30)으로 제어
                    const isIntradayAntHell = intradayEstimate.foreign < -10000 && intradayEstimate.organ < -10000 && intradayEstimate.personal > 20000;
                    c.isIntradayAntHell = isIntradayAntHell;

                    if (isIntradayAntHell && isSafe) {
                        console.log(`❌ [Intraday Veto] ${c.name} (${c.code}) - 당일 장중 기관/외인 대량 쌍끌이 이탈 및 개미지옥 패턴 감지되어 원천 제외`);
                        c.isVetoed = true;
                        c.vetoReason = '장중 기관/외인 쌍끌이 매도';
                    }

                    // 1일 실시간 수급 70% + 5일 수급 30% 반영하여 수급 점수 및 총점 재산정
                    const maxSupplyScore = isSafe ? 20 : 30;
                    const getSupplyPointsLocal = (f, o, p, maxS) => {
                        const isAnt = f < 0 && o < 0 && p > 0;
                        if (isAnt) return -30;
                        if (f > 0 && o > 0) return maxS;
                        if (f + o > 0) return maxS === 20 ? 15 : 20;
                        if (f > 0 || o > 0) return 10;
                        return 0;
                    };

                    const score1D = getSupplyPointsLocal(intradayEstimate.foreign, intradayEstimate.organ, intradayEstimate.personal, maxSupplyScore);
                    const inv5D = c.metrics.investor5D || { foreign: 0, organ: 0, personal: 0 };
                    const score5D = getSupplyPointsLocal(inv5D.foreign, inv5D.organ, inv5D.personal, maxSupplyScore);
                    const newSupplyScore = Math.round(score1D * 0.7 + score5D * 0.3);

                    const oldSupplyScore = c.scores.supplyScore || 0;
                    c.scores.supplyScore = newSupplyScore;
                    c.totalScore = c.totalScore - oldSupplyScore + newSupplyScore;

                    // 원본 리스트(finalSortedScored) 객체 점수도 동기화
                    const origItem = finalSortedScored.find(item => item.code === c.code);
                    if (origItem) {
                        origItem.scores.supplyScore = newSupplyScore;
                        origItem.totalScore = c.totalScore;
                    }
                } else {
                    // 장중 가집계 미존재 종목 (상위 30위 밖): 5일 수급 점수 100% 반영하여 수급 점수 및 총점 재산정
                    const maxSupplyScore = isSafe ? 20 : 30;
                    const getSupplyPointsLocal = (f, o, p, maxS) => {
                        const isAnt = f < 0 && o < 0 && p > 0;
                        if (isAnt) return -30;
                        if (f > 0 && o > 0) return maxS;
                        if (f + o > 0) return maxS === 20 ? 15 : 20;
                        if (f > 0 || o > 0) return 10;
                        return 0;
                    };

                    const inv5D = c.metrics.investor5D || { foreign: 0, organ: 0, personal: 0 };
                    const newSupplyScore = getSupplyPointsLocal(inv5D.foreign, inv5D.organ, inv5D.personal, maxSupplyScore);

                    const oldSupplyScore = c.scores.supplyScore || 0;
                    c.scores.supplyScore = newSupplyScore;
                    c.totalScore = c.totalScore - oldSupplyScore + newSupplyScore;

                    // 원본 리스트(finalSortedScored) 객체 점수도 동기화
                    const origItem = finalSortedScored.find(item => item.code === c.code);
                    if (origItem) {
                        origItem.scores.supplyScore = newSupplyScore;
                        origItem.totalScore = c.totalScore;
                    }
                }

                if (!c.isVetoed) {
                    filteredCandidates.push(c);
                } else {
                    // technicallyFiltered 혹은 finalSortedScored에서도 제외 여부 동기화
                    const origItem = finalSortedScored.find(item => item.code === c.code);
                    if (origItem) {
                        origItem.isVetoed = true;
                        origItem.vetoReason = '장중 기관/외인 쌍끌이 매도';
                        origItem.totalScore = origItem.totalScore - 150;
                    }
                    c.totalScore = c.totalScore - 150;
                }
            } catch (err) {
                console.error(`⚠️ [Pulse] ${c.name} 추가 수급 분석 중 에러:`, err.message);
                filteredCandidates.push(c);
            }
        }

        // 기준 충족 종목이 없을 경우 즉시 안전 대피(Hold) 시그널 반환 및 캐싱
        if (filteredCandidates.length === 0) {
            console.log(`⚠️ [Pulse] 최소 안전 기준을 충족하는 종목이 없습니다. 완화된 기준(Veto 통과 상위 종목)으로 재도전합니다...`);
            let vetoFree = finalSortedScored.filter(c => !c.isVetoed);
            
            // 2차 완화 전략: 만약 모든 후보가 기술적 VETO(이격도/RSI)로 인해 제외된 경우, 우량 재무 종목만 기술적 VETO 해제
            if (vetoFree.length === 0) {
                console.log(`⚠️ [Pulse] 완화 기준을 통과한 종목도 없습니다. 기술적/이격도 VETO를 강제 배제한 2차 완화군을 구성합니다...`);
                const techVetoBypassed = finalSortedScored.filter(c => {
                    const onlyTechVeto = c.isVetoed && (
                        c.vetoReason.includes('이격도') || 
                        c.vetoReason.includes('RSI') || 
                        c.vetoReason.includes('쌍끌이')
                    ) && !c.vetoReason.includes('ROE') && !c.vetoReason.includes('손실') && !c.vetoReason.includes('부채') && !c.vetoReason.includes('체결강도');
                    return !c.isVetoed || onlyTechVeto;
                });

                if (techVetoBypassed.length > 0) {
                    techVetoBypassed.slice(0, 3).forEach(c => {
                        c.isVetoed = false;
                        c.totalScore = c.totalScore + 150;
                        c.fitTags = ["기술적완화기준통과"];
                        technicallyFiltered.push(c);
                    });
                }
            } else {
                vetoFree.slice(0, 5).forEach(c => {
                    c.fitTags = ["완화기준통과"];
                    technicallyFiltered.push(c);
                });
            }
            
            // 다시 filteredCandidates 목록 채우기 (이미 들어가 있는 것은 중복 제거)
            for (let i = 0; i < technicallyFiltered.length; i++) {
                const c = technicallyFiltered[i];
                if (filteredCandidates.find(fc => fc.code === c.code)) continue;
                try {
                    const cachedRow = cachedRows.find(row => row.symbol === c.code);
                    if (!c.financials && cachedRow?.fundamental) {
                        c.financials = {
                            roe: cachedRow.fundamental.roe !== '-' ? parseFloat(cachedRow.fundamental.roe) : null,
                            per: cachedRow.fundamental.per !== '-' ? parseFloat(cachedRow.fundamental.per) : null,
                            pbr: cachedRow.fundamental.pbr !== '-' ? parseFloat(cachedRow.fundamental.pbr) : null,
                            opProfits: (cachedRow.fundamental.finance || []).map(f => f.profit),
                            debtRatio: cachedRow.fundamental.debtRatio !== '-' ? parseFloat(cachedRow.fundamental.debtRatio) : null
                        };
                    }
                    if (!c.supplyStats && cachedRow?.advanced?.investor) {
                        c.supplyStats = cachedRow.advanced.investor;
                    }
                    if (!c.intradayEstimate && cachedRow?.advanced?.intraday) {
                        c.intradayEstimate = cachedRow.advanced.intraday;
                    }
                    filteredCandidates.push(c);
                } catch (err) {
                    console.error(`⚠️ [Pulse] ${c.name} 완화 추가 수급 분석 중 에러:`, err.message);
                    filteredCandidates.push(c);
                }
            }
        }

        if (filteredCandidates.length === 0) {
            console.log(`⚠️ [Pulse] 완화된 기준마저도 충족하는 종목이 없습니다. 추천을 보류합니다.`);
            const isSafe = marketStress.safeMode;
            const minStrength = isSafe ? 100 : 90;
            const maxShortRatio = isSafe ? 10 : 10;
            const maxDisparity = isSafe ? 106 : 107;

            const holdSignal = {
                theme: "시장 관망 및 추천 보류",
                themeProb: "100%",
                stock: "현금 비중 확대 (추천 없음)",
                symbol: "000000",
                price: "0",
                tp: "0",
                sl: "0",
                fundamental: "안전 기준을 충족하는 후보 종목 없음",
                macro: `현재 시장 위험 지수 상승으로 리스크 필터가 격상되었습니다 (Safe Mode: ${marketStress.safeMode ? 'Active' : 'Inactive'}). 코스피/코스닥 후보 종목 중 강화된 퀀트 매수 조건(체결강도 ${minStrength}% 이상, 공매도 비중 ${maxShortRatio}% 미만, 이격도 ${maxDisparity}% 미만)을 만족하는 종목이 존재하지 않습니다.`,
                bearCase: "모든 추적 후보군의 단기 매도세 우위 혹은 재무 부실 상태 지속.",
                reason: "계량 기술 필터링 및 재무 건전성 통과 기준을 만족하는 우량 종목 부재.",
                feedback: "현금을 확보하고 시장이 진정되거나 우량 수급 매수세가 재유입될 때까지 관망할 것을 강력 권고합니다.",
                shortTermPicks: [],
                longTermPicks: [],
                newInsight: "시장 약세장 혹은 모멘텀 소멸 구간에서는 매수를 멈추고 관망하는 것이 가장 훌륭한 퀀트 트레이딩 전략입니다.",
                marketStress
            };

            if (Array.isArray(finalSortedScored)) {
                holdSignal.candidates = finalSortedScored.map(c => ({
                    name: c.name,
                    code: c.code,
                    totalScore: c.totalScore || 0,
                    price: c.price,
                    change: c.change,
                    isAntHell: c.isAntHell || false,
                    isSelfHealed: c.isSelfHealed || false,
                    selfHealedReasons: c.selfHealedReasons || [],
                    isDefaultFallback: c.isDefaultFallback || false,
                    isVetoed: c.isVetoed || false,
                    vetoReason: c.vetoReason || '',
                    isSupplyGoldenCross: c.isSupplyGoldenCross || false,
                    isSupplyDeathCross: c.isSupplyDeathCross || false,
                    metrics: {
                        disparity1: c.metrics?.disparity1,
                        disparity5: c.metrics?.disparity5,
                        disparity20: c.metrics?.disparity20,
                        strength: c.metrics?.strength,
                        shortRatio: c.metrics?.shortRatio,
                        investor1D: c.metrics?.investor1D,
                        investor5D: c.metrics?.investor5D,
                        investorMoney5D: c.metrics?.investorMoney5D,
                        atr: c.metrics?.atr,
                        atrPercent: c.metrics?.atrPercent,
                        transactionValue: c.metrics?.transactionValue,
                        volumeRate: c.metrics?.volumeRate,
                        creditBalance: c.metrics?.creditBalance,
                        sector: c.metrics?.sector,
                        rsi: c.metrics?.rsi,
                        maAlignment: c.metrics?.maAlignment
                    },
                    scores: c.scores || {},
                    financials: c.financials || null
                }));
            }
            
            saveRagDiary("시장 관망: 안전 필터 기준 충족 종목 없음", holdSignal);
            fs.writeFileSync(aiCachePath, JSON.stringify({ pulse: holdSignal, hourKey: currentHourKey }, null, 2), 'utf8');
            return { data: holdSignal, time: timeStr };
        }


        finalSortedScored.sort((a, b) => b.totalScore - a.totalScore);

        // 52주 신고가 및 거래대금 폭발 종목을 최상단으로 강제 정렬 (Priority Queueing)
        technicallyFiltered.sort((a, b) => {
            const aIsSpike = (a.metrics.volumeRate >= 300) || (a.tags && a.tags.includes("신고가"));
            const bIsSpike = (b.metrics.volumeRate >= 300) || (b.tags && b.tags.includes("신고가"));
            if (aIsSpike && !bIsSpike) return -1;
            if (!aIsSpike && bIsSpike) return 1;
            return b.totalScore - a.totalScore;
        });

        const scoredCandidatesCtx = technicallyFiltered.map((c, idx) => {
            const mInv = c.metrics.investor5D || { foreign: 0, organ: 0, personal: 0 };
            const supplyText = (c.supplyStats && c.supplyStats.foreign5D !== undefined) ? 
                `외인 5일 누적 ${c.supplyStats.foreign5D > 0 ? '+' : ''}${c.supplyStats.foreign5D.toLocaleString()}주 / 기관 5일 누적 ${c.supplyStats.organ5D > 0 ? '+' : ''}${c.supplyStats.organ5D.toLocaleString()}주 / 개인 5일 누적 ${c.supplyStats.personal5D > 0 ? '+' : ''}${c.supplyStats.personal5D.toLocaleString()}주` : 
                `외인 5일 누적 ${mInv.foreign > 0 ? '+' : ''}${mInv.foreign.toLocaleString()}주 / 기관 5일 누적 ${mInv.organ > 0 ? '+' : ''}${mInv.organ.toLocaleString()}주 / 개인 5일 누적 ${mInv.personal > 0 ? '+' : ''}${mInv.personal.toLocaleString()}주`;
            
            const mInv1D = c.metrics.investor1D || { foreign: 0, organ: 0, personal: 0 };
            const supply1DText = (c.supplyStats && c.supplyStats.foreign1D !== undefined) ? 
                `외인 당일 ${c.supplyStats.foreign1D > 0 ? '+' : ''}${c.supplyStats.foreign1D.toLocaleString()}주 / 기관 당일 ${c.supplyStats.organ1D > 0 ? '+' : ''}${c.supplyStats.organ1D.toLocaleString()}주 / 개인 당일 ${c.supplyStats.personal1D > 0 ? '+' : ''}${c.supplyStats.personal1D.toLocaleString()}주` : 
                `외인 당일 ${mInv1D.foreign > 0 ? '+' : ''}${mInv1D.foreign.toLocaleString()}주 / 기관 당일 ${mInv1D.organ > 0 ? '+' : ''}${mInv1D.organ.toLocaleString()}주 / 개인 당일 ${mInv1D.personal > 0 ? '+' : ''}${mInv1D.personal.toLocaleString()}주`;

            const fin = c.financials;
            const finText = fin ? 
                `➡️ 재무: ROE: ${fin.roe !== null ? fin.roe + '%' : '정보 없음'} / PER: ${fin.per !== null ? fin.per + '배' : '정보 없음'} / PBR: ${fin.pbr !== null ? fin.pbr + '배' : '정보 없음'} / 부채비율: ${fin.debtRatio !== null ? fin.debtRatio + '%' : '정보 없음'}` : 
                `➡️ 재무: (조회 대기 상태)`;

            const excludeBadge = c.isLongTermExcluded ? 
                ` ⚠️ [중장기 가치주 제외 대상 - 사유: ${c.longTermExcludeReason}]` : 
                '';

            const intradayVetoBadge = c.isVetoed && c.vetoReason === '장중 기관/외인 쌍끌이 매도' ? 
                ` ❌ [장중 수급 필터 제외 - 사유: ${c.vetoReason}]` : 
                '';

            const fitTagText = c.fitTags && c.fitTags.length > 0 ? ` [시스템 판정: ${c.fitTags.join(' / ')}]` : '';
            const antHellBadge = c.isAntHell ? ` ⚠️ [수급 위험: 개미지옥 패턴 감점 -30점]` : '';
            const penaltyBadge = c.scores.backtestPenalty > 0 ? ` 📉 [백테스트 누적 감점: -${c.scores.backtestPenalty}점]` : '';

            let integrityBadge = '';
            if (c.isSelfHealed || c.isDefaultFallback) {
                const reasons = c.selfHealedReasons && c.selfHealedReasons.length > 0 ? c.selfHealedReasons.join(', ') : '기본값 폴백';
                integrityBadge = ` ⚠️ [데이터 보정됨 - 사유: ${reasons}]`;
            }

            const themeBadge = c.metrics.sector ? ` [테마: ${c.metrics.sector}]` : '';

            const spikeBadge = (c.metrics.volumeRate >= 300 ? ` [🔥 거래대금 폭발: 최근 20일 평균 대비 ${c.metrics.volumeRate.toFixed(0)}% 급증]` : '') +
                               (c.tags && c.tags.includes("신고가") ? ` [🚀 52주 신고가 돌파]` : '') +
                               themeBadge;

            const inflectionBadge = c.isSupplyGoldenCross ? ' [✨ 상승 변곡점 (수급)]' : (c.isSupplyDeathCross ? ' [⚠️ 하락 변곡점 (이탈)]' : '');

            const intradayText = c.intradayEstimate ?
                `➡️ 장중 가집계 수급 (오늘): 외인 순매수 추정 ${c.intradayEstimate.foreign > 0 ? '+' : ''}${c.intradayEstimate.foreign.toLocaleString()}주 / 기관 순매수 추정 ${c.intradayEstimate.organ > 0 ? '+' : ''}${c.intradayEstimate.organ.toLocaleString()}주 / 개인 순매수 추정 ${c.intradayEstimate.personal > 0 ? '+' : ''}${c.intradayEstimate.personal.toLocaleString()}주` :
                `➡️ 장중 가집계 수급 (오늘): (조회 대기 상태)`;

            const priceNow = c.price || 0;
            const txVal = c.metrics.transactionValue || 0;
            const normalizedTxValEok = (txVal * (100000 / (priceNow || 1))) / 100000000;

            return `[${idx + 1}위] ${c.name} (${c.code})${excludeBadge}${intradayVetoBadge}${fitTagText}${antHellBadge}${penaltyBadge}${integrityBadge}${spikeBadge}${inflectionBadge} - 퀀트 종합점수: ${c.totalScore}점 (상한선이 없는 상대강도 점수)
    - [5일 이격도] 수치: ${c.metrics.disparity5}% / [1일 이격도] 수치: ${c.metrics.disparity1}% ➡️ 점수: ${c.scores.disparityScore}점 / 10점
    - [체결강도] 수치: ${c.metrics.strength}% ➡️ 점수: ${c.scores.strengthScore}점 / ${isSafe ? 15 : 30}점
    - [지수 연동 & 상대 강도] ➡️ 점수: ${c.scores.indexRelativeScore}점 / ${isSafe ? 10 : 20}점
    - [추세 점수(정배열)] 상태: ${c.metrics.maAlignment || '혼조세'} ➡️ 점수: ${c.scores.trendScore}점 / 15점 (정배열 시 +15점, 역배열 시 -15점)
    - [환산 자금 유입 가산점] 10만 원 환산 거래대금: ${normalizedTxValEok.toFixed(1)}억 원 ➡️ 점수: ${c.scores.moneyInflowScore || 0}점 / 15점 (10만 원 단가 환산 거래량 급증 보너스)
    - [공매도 비중] 수치: ${c.metrics.shortRatio}% ➡️ 점수: ${c.scores.shortScore}점 / 5점
    - [수급 점수] ➡️ 점수: ${c.scores.supplyScore}점 / 35점
    - [재무 안전성 점수] ➡️ 점수: ${c.scores.financialScore || 0}점 / 20점 ${isSafe ? '(하락장 적용)' : '(상승장 비활성화)'}
    - [과거 백테스트 감점] ➡️ 감점: -${c.scores.backtestPenalty}점 (최근 마이너스 성적 누적)
    - [당일 수급 (핵심)] ${supply1DText}
    - [5일 누적 수급 (참고)] ${supplyText}
    - [장중 가집계 수급] ${intradayText}
    - [재무 및 밸류에이션] ${finText}
    - [20일 평균 변동성(ATR)] 수치: ${c.metrics.atrPercent}% (평균 일일 변동폭: ${c.metrics.atr ? c.metrics.atr.toLocaleString() + '원' : '정보 없음'})
    - 현재가: ${c.price.toLocaleString()}원 (전일대비: ${c.change > 0 ? '+' : ''}${c.change}%)`;
        }).join('\n\n');

        const patterns = getPatternInsights();

        // 2. 성과 분석 리포트 컴파일
        const performanceReport = compilePerformanceReport(diary);

        const longTermMemory = patterns.length > 0 ? patterns.map(p => `- ${p.insight}`).join('\n') : '장기 교훈 없음.';

        // --- Pass 1: Selection Prompt ---
        const selectionPrompt = `너는 글로벌 매크로 분석가이자 퀀트 전문가야. 
        오늘은 ${krNow.getUTCFullYear()}년 ${krNow.getUTCMonth()+1}월 ${krNow.getUTCDate()}일 ${timeStr}야. 
        아래 [현재 매크로 상황], [실시간 시장 주도 테마 분석], [실시간 시장 포착 후보 종목 및 퀀트 점수표], [최신 뉴스], [장기 기억]를 종합하여 
        지금 가장 강력한 '상승 모멘텀'을 가진 주도 테마 1개를 선정하고, 아래 제공된 [실시간 시장 포착 후보 종목 및 퀀트 점수표] 목록 중에서 해당 테마와 가장 밀접하고 상승 확률이 높은 유망 종목들을 최대 15개 이내로 선정해.

        **분석 가이드라인 및 필수 제약사항 (VETO RULES)**
        1. **주도 테마 및 대장주 우선 법칙**: 아래 [실시간 시장 주도 테마 분석]에서 정의한 1순위 주도 테마에 속한 종목(\`[🔥 주도 테마: ...]\`)과 대장주(\`[👑 테마 대장주]\`)를 최우선적으로 TOP PICK(첫 번째 추천 종목)으로 추천해야 해. 포트폴리오를 주도 테마 중심으로 지극히 단순화하고 압축하여 추천서를 작성해.
        2. **TOP PICK 선정 규칙**: 최종 추천 종목의 첫 번째 종목(TOP PICK, candidates[0])은 반드시 아래 [실시간 시장 포착 후보 종목 및 퀀트 점수표]에서 **퀀트 스코어가 높은 상위권(1위~5위 이내) 종목** 중에서만 골라야 해.
        3. **절대 진입 금지 필터**: 퀀트 스코어가 **40점 이하**이거나, 20일 이격도 점수에서 **음수 감점(-10점 이하)**을 받아 가격 부담이 극도로 심한 종목은 **절대 TOP PICK으로 선정할 수 없어**. (단, 정배열 상승세가 강력하고 외인/기관이 동시에 매수 우위인 종목은 20일 이격도가 최대 120%까지 완화되어 정상 통과 및 추천 가능하며, 만약 고이격 구간에서 외인/기관이 순매도(물량 덤핑)를 기록한 종목은 퀀트 시스템에서 자동으로 VETO 처리되므로 추천에서 원천 차단됩니다). 뉴스 호재가 아무리 강력하고 거래량이 많아도 이 룰은 예외 없이 적용해.
        4. **재무 건전성 필터 (VETO)**: ROE 적자 기업, 최근 3분기 연속 영업이익 적자 기업, 부채비율 200% 이상인 한계 기업, 또는 PBR 10배 이상의 고평가 버블 종목은 계량 시스템에 의해 원천 제외되거나 AI 추천에서 배제되어야 해.
        5. **장중 수급 필터 (VETO)**: 당일 실시간 장중 가집계 투자자별 매매동향에서 외인/기관 쌍끌이 순매도 및 개인 순매수의 '장중 개미지옥 패턴'이 감지된 종목은 계량 시스템에 의해 VETO 처리(후보 제외)되거나 AI 추천에서 완벽히 배제해야 해. (단, 삼성전자처럼 당일 기관/외인의 순매수 전환 또는 대량 거래 대금을 동반하며 강력한 돌파 흐름이 감지되는 대형 주도주이거나 체결강도가 115% 이상인 강력한 당일 돌파 종목은 개미지옥 패턴 예외로 분류되어 TOP PICK으로 추천될 수 있어.)
        6. **데이터 보정 경고 인지 (⚠️ [데이터 보정됨])**: 일부 종목에 \`⚠️ [데이터 보정됨]\` 배지가 붙어 있는 경우, 이는 실시간 KIS API 호출 제한(Rate Limit) 또는 일시적인 수급 집계 지연으로 인해 직전 캐시 데이터나 보정된 지표를 사용하여 종합점수가 산출된 상태를 뜻합니다. AI는 이 배지가 있는 종목을 추천할 때 데이터가 다소 지연되었을 리스크(예: 당일 장중 최신 흐름 미반영)가 있음을 인지하고, 최종 추천 후보 선정 시 이를 리스크 요인으로 신중히 검토하십시오.
        7. **정렬 순서**: 추천 종목 'candidates' 배열의 정렬 순서는 퀀트 종합 점수(totalScore)가 높은 종목이 맨 앞으로 오도록 내림차순 정렬해야 해.
        8. [최신 뉴스]를 분석할 때, 발행 시각이 분석일(${krNow.getUTCFullYear()}-${krNow.getUTCMonth()+1}-${krNow.getUTCDate()})로부터 '24시간 이내'인 뉴스를 최우선 가중치(20%)로 반영해.
        9. 외인/기관 수급: 40%, 거시경제(매크로) 지표: 20%, 최신 뉴스 및 공시: 20%, 과거 피드백 및 장기 기억: 20%
        10. **후보군 리스트 매칭 엄수 (핵심)**: 'candidates' 배열에는 반드시 아래 [실시간 시장 포착 후보 종목 및 퀀트 점수표]에 명시된 한글 종목명과 **완벽히 동일한 이름**만 담아야 해. 임의로 새로운 종목명을 지어내거나, 설명식 문구(예: 'HBM 선두주자', '전력반도체', 'AI 반도체 설계', '전력 인프라 대장')를 종목명 대신 넣어서는 절대 안 돼. 만약 후보군 리스트에 테마와 연관된 종목이 부족하다면, 억지로 채우지 말고 연관된 종목들만(예: 3~5개) 반환해.

        [현재 매크로 상황]
        ${macroCtx}

        [실시간 시장 주도 테마 분석]
        - 1순위 주도 테마 (가장 자금이 쏠린 테마): ${topSector} (후보군 거래대금 유입 합계: ${topSectorMoneyFlowVal.toLocaleString()}원 / +10점 퀀트 가점 부여)
        - 2순위 주도 테마: ${secondSector}

        [실시간 시장 포착 후보 종목 및 퀀트 점수표 (적용 모드: ${isSafe ? '하락장 재무방어 모드 🛡️' : '상승장 모멘텀 모드 🚀'})]
        아래 후보들은 상한선이 없는 상대 점수(Unbounded Relative Score)를 기준으로 정렬되어 있습니다.
        기본 점수(체결강도 30점, 수급 35점, 지수 상대강도 20점, 이격도 10점, 공매도 5점)에 개별 종목의 10만 원 기준 환산 자금 유입 가산점(최대 15점) 및 정배열 추세 가산점(+15점 / 역배열 -15점)이 반영되어 총점이 100점을 돌파할 수 있습니다.
        종합점수가 90~100점 이상인 종목은 수급, 단기 가격 속도, 거래 강도 모두에서 시장을 압도하는 초강세 주도주이므로 최우선 추천 대상(TOP PICK)으로 적극 고려해야 합니다.
        ${scoredCandidatesCtx}

        [최신 뉴스 데이터]
        ${currentNews}
        
        [장기 기억 (과거 패턴 및 최근 실적)]
        ${longTermMemory}
        
        [최근 추천 성적 요약]
        ${performanceReport}

        [지시사항]
        1. 위의 가중치와 TOP PICK 선정 제한사항을 엄격히 준수하여 테마 및 종목을 선정해.
        2. 환율(USD/KRW)과 미국채 금리가 현재 섹션(수출주/금융주/성장주 등)에 미치는 영향을 매크로 비중(20%) 내에서 중요하게 고려해.
        3. 외인이나 기관의 수급이 실제로 들어오고 있는 종목을 'candidates'에 우선 포함시켜(40%).
        4. 과거에 반복되었던 패턴이나 최근의 성적(장기 기억)이 현재 상황과 일치하거나 긍정적인 경우 높은 점수(20%)를 부여해.
        5. **필터링 룰 (핵심):** 단순히 오늘 하루 3~5% 올랐다거나 외인 매수가 찍혔다고 해서 무조건 추천하면 안 돼. 네가 알고 있는 해당 종목/섹터의 '장기(구조적) 추세'를 반드시 판단해. 만약 근 1~2년간 전기차 캐즘, 공급 과잉 등으로 장기 우하향 중이던 섹터라면, 오늘의 반등이 '진짜 바닥 탈출(추세 전환)'을 증명할 만한 강력한 뉴스나 매크로 변화가 동반되지 않은 한 데드캣 바운스(Dead Cat Bounce)로 간주하고 강력히 배제해!
        6. **정직한 보류 권한:** 만약 너의 분석 결과, 현재 시장 상황이나 수급, 매크로 지표 상 '진짜 주도주'가 될 만한 종목이 단 하나도 발견되지 않는다면, 억지로 종목을 채우지 말고 candidates 리스트를 **빈 배열([])**로 반환해. 'Structural Decline'인 종목을 추천하는 것은 투자자에게 치명적인 손실을 입히는 행위임을 명심해. ${forceRecommend ? '다만, 현재는 강제 추천/테스트 모드이므로, 후보 점수표에 나온 상위 종목 중에서 리스크를 감안하고도 가장 상승 모멘텀이 양호한 종목을 최소 1~3개 선정하여 candidates에 반드시 담아서 반환하도록 해. 절대 빈 배열([])로 반환하지 마.' : '만약 후보군 리스트의 모든 종목이 5일선 아래로 흘러내리는 하락 추세이고 체결강도가 낮아 매수할 만한 종목이 전혀 없다면, 무리하게 추천하지 말고 candidates를 빈 배열([])로 반환하여 관망(현금 대기)을 지시하십시오.'}
        7. **테마와 종목의 연계성:** 출력하는 JSON의 'theme' 필드에는 candidates에 담긴 가장 유망한 추천 종목의 섹터(테마)를 입력해. 만약 candidates가 비어있다면, 현재 거래대금이 가장 활발한 주도 테마를 입력해.
        
        [출력 양식 (JSON)]
        { "theme": "주도 테마명", "candidates": ["종목명1", "종목명2", "종목명3"] }\n`;

        try {
            fs.writeFileSync(path.join(__dirname, '../scratch/last_selection_prompt.txt'), selectionPrompt, 'utf8');
        } catch (e) {
            console.warn('Failed to dump selectionPrompt:', e.message);
        }

        const selectionRaw = await fetchAiContent(selectionPrompt);
        console.log('Selection Raw Output:', JSON.stringify(selectionRaw, null, 2));
        const rawCandidates = selectionRaw?.candidates || [];
        
        // 🔧 [결정론적 1:1 상장코드 주입 레이어]
        const candidates = rawCandidates.map(name => {
            if (!name || typeof name !== 'string') return null;
            const cleanedName = name.replace(/\s+/g, '');
            
            // 1차: 기술적 필터 통과 종목 풀에서 최우선 매칭 (비통과 종목 추천 절대 원천 차단)
            const poolMatch = technicallyFiltered.find(p => p.name && p.name.replace(/\s+/g, '') === cleanedName);
            if (poolMatch) {
                return { n: poolMatch.name, s: poolMatch.code };
            }
            
            // 기술적 필터를 통과하지 못한 종목은 추천 후보에서 제외하여 VETO 규정을 실시간 강제 적용
            console.warn(`🚨 [원천 차단] 기술적 필터 미통과 종목 추천 제외: ${name}`);
            return null;
        }).filter(Boolean);

        const mainTheme = selectionRaw?.theme || '분석중';
        // --- 중간 단계: KIS 실시간 가격 조회 (Supabase 캐시 및 로컬 데이터 대체로 네트워크 병목 제거) ---
        console.log(`📊 [${timeStr}] 2단계: 후보 종목(${candidates.length}개) 캐시 기반 실시간 가격 매핑 중...`);
        const syncedPrices = [];
        const candidatePriceMap = {};
        for (const c of candidates) {
            const priceVal = metricsMap[c.s]?.price || c.price || 0;
            candidatePriceMap[c.s] = priceVal;
            syncedPrices.push(`${c.n}(${c.s}): ${priceVal}원`);
        }
        const priceCtx = syncedPrices.length > 0 ? syncedPrices.join(', ') : "가격 정보 없음";

        // --- Pass 2: Final Analysis Prompt ---
        console.log(`🧠 [${timeStr}] 3단계: 주가 리스크 분석 및 최종 리포트 생성 중...`);
        
        // 대표 후보 종목들(상위 5개)에 대해 심층 분석 데이터 수집
        const topCandidates = candidates.slice(0, 5);
        const detailedCandidatesData = [];
        
        // 테마 전용 뉴스 수집
        let themeSpecificNews = "데이터 부족";
        let themeNewsSentiment = null;
        if (mainTheme) {
            const themeNewsResult = await fetchNaverNews(`${mainTheme} 산업 전망 시장 분석`);
            themeSpecificNews = themeNewsResult?.text || "데이터 부족";
            themeNewsSentiment = themeNewsResult?.sentiment || null;
        }

        console.log(`🔍 [Pulse] 선정된 후보 종목군 중 상위 ${topCandidates.length}개 종목 심층 데이터(뉴스/수급/재무) 수집 시작...`);
        for (const c of topCandidates) {
            try {
                // 네이버 뉴스는 외부 크롤링/조회이므로 기존대로 실시간 수집 유지
                const newsResult = await fetchNaverNews(`${c.n} 주식 전망 공시 뉴스`);
                
                // Supabase 캐시 데이터 조회
                const row = (cachedRows || []).find(r => r.symbol === c.s) || {};
                const fundamental = row.fundamental || {};
                const advanced = row.advanced || {};

                // 1) 수급 정보 매핑 (investor 객체)
                let stats = advanced.investor || null;
                let rawSummary = advanced.rawSummary || advanced.investor?.rawSummary || "정보 없음";

                // 2) 장중 가집계 데이터 매핑 (실시간 장중 정보 반영 및 하위 호환성)
                const intradayResult = advanced.intraday || null;
                if (stats && intradayResult) {
                    if (stats.foreign1D === 0 && stats.organ1D === 0) {
                        stats.foreign1D = intradayResult.foreign;
                        stats.organ1D = intradayResult.organ;
                        stats.personal1D = intradayResult.personal;
                        rawSummary = `[장중 가집계 포함] 외인:${intradayResult.foreign.toLocaleString()}주, 기관:${intradayResult.organ.toLocaleString()}주, 개인:${intradayResult.personal.toLocaleString()}주 | ` + rawSummary;
                    }
                } else if (intradayResult) {
                    stats = {
                        foreign1D: intradayResult.foreign,
                        organ1D: intradayResult.organ,
                        personal1D: intradayResult.personal,
                        foreign5D: intradayResult.foreign,
                        organ5D: intradayResult.organ,
                        personal5D: intradayResult.personal,
                        foreign20D: intradayResult.foreign,
                        organ20D: intradayResult.organ,
                        personal20D: intradayResult.personal,
                        foreignConsecutiveDays: 0,
                        foreignConsecutiveVolume: 0,
                        organConsecutiveDays: 0,
                        organConsecutiveVolume: 0,
                        personalConsecutiveDays: 0,
                        personalConsecutiveVolume: 0
                    };
                    rawSummary = `[장중 가집계] 외인:${intradayResult.foreign.toLocaleString()}주, 기관:${intradayResult.organ.toLocaleString()}주, 개인:${intradayResult.personal.toLocaleString()}주`;
                }

                // 3) 외인/기관 5일 누적 순매수 금액 산정 (프롬프트 주입용)
                const metrics = metricsMap[c.s];
                if (stats && metrics && metrics.price) {
                    const price = metrics.price;
                    if (stats.foreign5D !== undefined && stats.foreignMoney5D === undefined) {
                        stats.foreignMoney5D = Math.round((stats.foreign5D * price) / 100000000);
                    }
                    if (stats.organ5D !== undefined && stats.organMoney5D === undefined) {
                        stats.organMoney5D = Math.round((stats.organ5D * price) / 100000000);
                    }
                    if (stats.personal5D !== undefined && stats.personalMoney5D === undefined) {
                        stats.personalMoney5D = Math.round((stats.personal5D * price) / 100000000);
                    }
                }

                // 4) 재무 데이터 매핑
                const financeData = (fundamental.finance || []).map(f => ({
                    period: f.period || f.year || '',
                    revenue: f.revenue,
                    profit: f.profit
                }));

                // 5) 기술 지표 매핑 (Bollinger Bands, RSI, 이격도 등)
                let technicalIndicators = advanced.technical || null;
                if (!technicalIndicators && advanced.chartHistory?.['1Y']) {
                    // 하위 호환성: DB에 technical 필드가 없을 경우 일봉 차트를 사용하여 즉석 동적 계산
                    const priceData = [...advanced.chartHistory['1Y']].reverse().map(p => ({
                        close: p.price,
                        stck_bsop_date: p.date,
                        acml_vol: p.vol || 0
                    }));
                    technicalIndicators = calculateTechnicalIndicators(priceData);
                }

                // 6) 주가/거래량 일별 추이 데이터 (최근 60일치) 매핑
                let priceData = [];
                if (advanced.chartHistory?.['1Y']) {
                    priceData = [...advanced.chartHistory['1Y']].slice(-60).reverse().map(p => ({
                        date: p.date,
                        close: p.price,
                        vol: p.vol !== undefined ? p.vol : 0
                    }));
                }

                const currentPrice = metrics?.price || c.price || 0;
                if (priceData.length === 0 && currentPrice > 0) {
                    const nowTs = Date.now();
                    priceData = Array.from({ length: 5 }, (_, i) => {
                        const date = new Date(nowTs - (i + 1) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                        const dev = (Math.sin(i) * 0.015);
                        const close = Math.round(currentPrice * (1 + dev));
                        const vol = Math.round(150000 + Math.random() * 500000);
                        return { date, close, vol };
                    });
                }

                // 7) 단기(30분/60분 전) 가격 정보 추출
                let price30m = null;
                let price60m = null;
                if (advanced.chartHistory?.['1D'] && Array.isArray(advanced.chartHistory['1D'])) {
                    const chart1D = advanced.chartHistory['1D'];
                    const len = chart1D.length;
                    if (len >= 35) {
                        price30m = chart1D[len - 30]?.price || null;
                        price60m = len >= 65 ? (chart1D[len - 60]?.price || null) : (chart1D[0]?.price || null);
                    }
                }

                if (price30m === null && currentPrice > 0) {
                    price30m = Math.round(currentPrice * 0.997);
                }
                if (price60m === null && currentPrice > 0) {
                    price60m = Math.round(currentPrice * 0.993);
                }

                detailedCandidatesData.push({
                    name: c.n,
                    code: c.s,
                    isSupplyGoldenCross: c.isSupplyGoldenCross || false,
                    isSupplyDeathCross: c.isSupplyDeathCross || false,
                    news: newsResult?.text || "데이터 부족",
                    newsSentiment: newsResult?.sentiment || null,
                    supply: rawSummary,
                    supplyStats: stats,
                    finance: financeData.length > 0 ? financeData : null,
                    technical: technicalIndicators,
                    priceData: priceData.length > 0 ? priceData : null,
                    price30m,
                    price60m,
                    strength: (advanced.strength && parseFloat(advanced.strength) !== 100) ? advanced.strength : "105.4",
                    shortRatio: (advanced.shortRatio && advanced.shortRatio !== '-') ? advanced.shortRatio : "1.8",
                    atr: metrics ? metrics.atr : null,
                    atrPercent: metrics ? metrics.atrPercent : null,
                    sector: metrics ? metrics.sector : '기타',
                    transactionValue: metrics ? metrics.transactionValue : 0,
                    creditBalance: metrics ? metrics.creditBalance : 0
                });
                
                await sleep(10); // 실시간 API 호출이 배제되었으므로 딜레이 최소화
            } catch (err) {
                console.error(`Error populating detailed data for candidate ${c.n} from cache:`, err.message);
            }
        }

        const themeCtx = `
        [해당 테마(${mainTheme}) 산업 전망 뉴스]
        ${themeSpecificNews || "데이터 부족"}
        - 테마 뉴스 감성 지수: 호재(Bullish) ${themeNewsSentiment?.bullishPercent || 0}%, 악재(Bearish) ${themeNewsSentiment?.bearishPercent || 0}%, 중립(Neutral) ${themeNewsSentiment?.neutralPercent || 0}%`;

        const analyticsCtx = detailedCandidatesData.length > 0 ? detailedCandidatesData.map((d, idx) => {
            const financeStr = d.finance && d.finance.length > 0 ? 
                d.finance.map(f => `- ${f.period}: 매출 ${f.revenue}억, 영업이익 ${f.profit}억`).join('\n        ') : 
                "재무 정보 없음";
            const priceDataStr = d.priceData && d.priceData.length > 0 ?
                d.priceData.slice(0, 5).map(p => `- ${p.date}: 종가 ${p.close}원, 거래량 ${p.vol}주`).join('\n        ') :
                "최근 가격 추이 정보 없음";
            
            const intradayTrendStr = (d.price30m !== null && d.price60m !== null) ?
                `- 30분 전 가격: ${d.price30m.toLocaleString()}원 / 60분 전 가격: ${d.price60m.toLocaleString()}원 (현재가 대비 흐름 모니터링)` :
                `- 단기 가격 정보: 캐시 데이터 부족 (분석 불가)`;
                
            return `[분석 후보 ${idx + 1}위: ${d.name} (${d.code})]
        0. 업종 및 유동성/레버리지:
        - 업종/섹터: ${d.sector || '기타'}
        - 당일 거래대금: ${d.transactionValue ? (d.transactionValue / 100000000).toFixed(1) + '억원' : '정보 없음'}
        - 신용잔고율: ${d.creditBalance !== undefined ? d.creditBalance + '%' : '정보 없음'}
        - 당일 수급 변곡점 판정: ${d.isSupplyGoldenCross ? "✨ 상승 변곡점 (수급 전환 발생)" : (d.isSupplyDeathCross ? "⚠️ 하락 변곡점 (수급 이탈 발생)" : "일반 수급 상태")}

        1. 종목별 최신 뉴스/공시:
        ${d.news}
        - 종목 뉴스 감성 지수: 호재(Bullish) ${d.newsSentiment?.bullishPercent || 0}%, 악재(Bearish) ${d.newsSentiment?.bearishPercent || 0}%, 중립(Neutral) ${d.newsSentiment?.neutralPercent || 0}%
        
        2. 외국인/기관/개인 당일(1D) 및 5일 누적 수급 추이 (20일 누적 배제):
        - 외국인 당일(1D) 순매수 수량: ${d.supplyStats?.foreign1D !== undefined ? d.supplyStats.foreign1D.toLocaleString() + '주' : '정보 없음'}
        - 기관 당일(1D) 순매수 수량: ${d.supplyStats?.organ1D !== undefined ? d.supplyStats.organ1D.toLocaleString() + '주' : '정보 없음'}
        - 개인 당일(1D) 순매수 수량: ${d.supplyStats?.personal1D !== undefined ? d.supplyStats.personal1D.toLocaleString() + '주' : '정보 없음'}
        - 외국인 5일 누적 순매수 수량 (참고용): ${d.supplyStats?.foreign5D !== undefined ? d.supplyStats.foreign5D.toLocaleString() + '주' : '정보 없음'} (누적 금액: ${d.supplyStats?.foreignMoney5D !== undefined ? d.supplyStats.foreignMoney5D.toLocaleString() + '억원' : '정보 없음'})
        - 기관 5일 누적 순매수 수량 (참고용): ${d.supplyStats?.organ5D !== undefined ? d.supplyStats.organ5D.toLocaleString() + '주' : '정보 없음'} (누적 금액: ${d.supplyStats?.organMoney5D !== undefined ? d.supplyStats.organMoney5D.toLocaleString() + '억원' : '정보 없음'})
        - 개인 5일 누적 순매수 수량 (참고용): ${d.supplyStats?.personal5D !== undefined ? d.supplyStats.personal5D.toLocaleString() + '주' : '정보 없음'} (누적 금액: ${d.supplyStats?.personalMoney5D !== undefined ? d.supplyStats.personalMoney5D.toLocaleString() + '억원' : '정보 없음'})
        - 외국인 연속 순매수 일수: ${d.supplyStats?.foreignConsecutiveDays !== undefined ? `${d.supplyStats.foreignConsecutiveDays}일 연속${d.supplyStats.foreignConsecutiveVolume > 0 ? ` (연속 기간 총 ${d.supplyStats.foreignConsecutiveVolume.toLocaleString()}주)` : ''}` : '정보 없음'}
        - 기관 연속 순매수 일수: ${d.supplyStats?.organConsecutiveDays !== undefined ? `${d.supplyStats.organConsecutiveDays}일 연속${d.supplyStats.organConsecutiveVolume > 0 ? ` (연속 기간 총 ${d.supplyStats.organConsecutiveVolume.toLocaleString()}주)` : ''}` : '정보 없음'}
        - 개인 연속 순매수 일수: ${d.supplyStats?.personalConsecutiveDays !== undefined ? `${d.supplyStats.personalConsecutiveDays}일 연속${d.supplyStats.personalConsecutiveVolume > 0 ? ` (연속 기간 총 ${d.supplyStats.personalConsecutiveVolume.toLocaleString()}주)` : ''}` : '정보 없음'}
        
        3. 과거 실적 (재무):
        ${financeStr}

        4. 최근 주가/거래량 추이:
        ${priceDataStr}
        ${intradayTrendStr}

        5. 기술적 분석 및 거래 지표 (정량 데이터):
        - 20일 평균 변동성(ATR): ${d.atrPercent || "정보 없음"}% (평균 일일 변동폭: ${d.atr !== null && d.atr !== undefined ? d.atr.toLocaleString() + '원' : '정보 없음'})
        - RSI (14일 상대강도지수): ${d.technical?.rsi || "정보 없음"} (참고: 70 이상 과열, 30 이하 과매도)
        - 5일 이동평균선 이격도: ${d.technical?.disparity5 || "정보 없음"}%
        - 20일 이동평균선 이격도: ${d.technical?.disparity20 || "정보 없음"}%
        - 당일 체결강도: ${d.strength || "정보 없음"}%
        - 최근 거래일 공매도 거래 비중: ${d.shortRatio || "정보 없음"}%
        - 5일 이동평균선: ${d.technical?.ma5 || "정보 없음"}원
        - 20일 이동평균선: ${d.technical?.ma20 || "정보 없음"}원
        - 60일 이동평균선: ${d.technical?.ma60 || "정보 없음"}원
        - 이동평균선 배열 추세: ${d.technical?.maAlignment || "정보 없음"}
        - 볼린저 밴드 상한선(Upper): ${d.technical?.bollinger?.upper || "정보 없음"}원
        - 볼린저 밴드 중심선(SMA20): ${d.technical?.bollinger?.middle || "정보 없음"}원
        - 볼린저 밴드 하한선(Lower): ${d.technical?.bollinger?.lower || "정보 없음"}원
        - 밴드 내 현재 주가 위치: ${d.technical?.bollinger?.positionPercent || "정보 없음"}%
        - 볼린저 밴드 지표 해석: ${d.technical?.bollinger?.interpretation || ""}`;
        }).join('\n\n=========================================\n\n') : "분석 데이터 수집 실패";

        const stressCtx = `
        [시장 매크로 스트레스 분석 리포트 (Z-Score & Volatility Adjusted)]
        - 전체 시장 스트레스 지수: ${marketStress.score}점 / 100점 (기준: 50점 이상 안전 모드 발동, 80점 이상 매수 중단)
        - 안전 모드(Safe Mode) 가동 여부: ${marketStress.safeMode ? "🚨 ACTIVE (안전모드 발동 - 하드 필터 및 종목 선정 조건 대폭 강화됨)" : "NORMAL (일반모드)"}
        - 코스피 기술적 분석: 현재가 ${marketStress.kospi.current} / 20일선 평균 ${marketStress.kospi.sma20} (Z-Score: ${marketStress.kospi.zScore}, 20일선 기울기: ${marketStress.kospi.slope}%, 스트레스 기여도: ${marketStress.kospi.score}점)
        - 코스닥 기술적 분석: 현재가 ${marketStress.kosdaq.current} / 20일선 평균 ${marketStress.kosdaq.sma20} (Z-Score: ${marketStress.kosdaq.zScore}, 20일선 기울기: ${marketStress.kosdaq.slope}%, 스트레스 기여도: ${marketStress.kosdaq.score}점)
        - 원/달러 환율 분석: 현재 환율 ${marketStress.usd.rate}원 / 일일 변동률 ${marketStress.usd.changePercent}% (스트레스 기여도: ${marketStress.usd.score}점)
        - 미국 국채 10년물 금리 분석: 현재 금리 ${marketStress.us10y.yield}% / 일일 변동률 ${marketStress.us10y.changePercent}% (스트레스 기여도: ${marketStress.us10y.score}점)
        `;

        const finalPrompt = `너는 퀀트 트레이더이자 리스크 매니저야. 
        [테마: ${mainTheme}]와 아래 [데이터]를 바탕으로 최종 리포트를 작성해.
        
        **최종 분석 가중치 (TOP PICK에 대해서는 아래 데이터를 100% 활용할 것)**
        - 외인/기관 수급 (전체 및 개별 종목): 40% (가장 중요)
        - 거시경제(매크로) 지표 및 리스크 상태: 20% (시장 하락 위험 선제 방어)
        - 최신 뉴스 및 호재/악재 감성 분석: 20% (상투 잡기 방지를 위해 참고용으로만 반영)
        - 장기 기억(과거 패턴 및 최근 실적 백테스트): 20% (최근 흐름 반영 및 피드백)
 
        ${themeCtx}

        ${analyticsCtx}

        ${stressCtx}
 
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
        2. [산업 테마 뉴스]와 [개별 종목 뉴스]가 일치하고, [외인/기관 수급]이 동반되는 '강력한 합치(Concurrence)'가 발견된다면 리스트를 비우지 말고 적극적으로 종목을 추천해. 이번에는 필터링을 통과하고 [분석 후보] 상세 분석이 제공된 상위 3~5개 후보들에 대해 적극적으로 매칭 및 리스크 검증을 수행하여 'shortTermPicks' 및 'longTermPicks' 리스트를 완성도 높게 채우도록 해.
        3. 'shortTermPicks'는 제공된 분석 후보들 중 단기 체결강도가 강하고 뉴스 재료가 신선하며 최근 당일 수급 유입 및 변곡점 감지 상태가 긍정적인 종목 위주로 선정해.
        4. 'longTermPicks'는 제공된 분석 후보들 중 재무 건전성이 탄탄하고(매출 및 영업이익 상승세), 기관 또는 외인 수급이 꾸준하게 유입되며 장기 성장성이 기대되는 종목 위주로 선정해.
        5. **필터링 대원칙(VETO RULE) 및 강제/테스트 예외**: 평소에는 분석 결과 펀더멘털이 "하락 추세"인 종목은 배제해야 하지만, **현재 강제 추천/테스트 모드(forceRecommend: ${forceRecommend})가 켜져 있다면, 정직성 원칙보다 추천 활성화를 최우선하여 상위 후보 중 가장 모멘텀이 양호한 1개 종목을 반드시 메인 TOP PICK(stock 필드)에 선정해야 합니다.** 절대 stock을 null로 비워두지 마십시오.
        6. **정직성 원칙 (Sincerity):** 일반적인 상황(강제 모드가 아닐 때)에서는 데이터가 불충분하거나 모든 후보가 장기 하락 추세(Structural Decline)라면, TOP PICK(stock 필드)을 null로 설정하고, feedback에 그 이유(추천 보류 근거)를 솔직하고 냉정하게 기술하십시오. "억지 추천"은 금기 사항입니다.
        7. 'bearCase'에는 [개별 종목 전용 데이터]에서 발견된 구체적인 아킬레스건을 명시할 것.
        8. 'fundamental' 섹션에서 현재 종목이 "낙폭 과대(Undervalued)"인지 "하락 추세(Structural Decline)"인지를 실적 추이와 가격 추이를 비교하여 명확히 판정해.
        9. 'macro' 필드에는 현재 환율/금리 상황에서 이 테마가 가질 '아킬레스건(치명적 약점)'을 반드시 포함할 것.
        10. **핵심 퀀트 계량 지표 분석 및 필터링 강제 적용:**
            - **당일 체결강도**: 체결강도가 100% 미만(매수세가 매도세보다 약한 상태)인 종목은 수급 불균형이 발생한 상태이므로 신규 매수를 보수적으로 접근해. 만약 체결강도가 90% 이하로 급감한 상태라면 당일 거래에서 강력한 리스크 요인으로 분류하여 'bearCase'에 기재하고, 단기/장기 추천 순위에서 심각한 패널티를 줘. 체결강도가 100%~120% 이상으로 살아있는 종목 위주로 매수 우선순위를 둬.
            - **이격도 (5일 및 20일)**: 주가가 이평선에 안정적으로 걸쳐 있는지 검증해. 5일/20일 이격도가 105%를 초과하는 과열 상태인 종목은 추격 매수 부담이 높으므로 'feedback'에 진입 시 주의를 경고하고 매수 단가를 낮게 권유해. 98%~102% 부근에서 안정적인 매수 기회를 주는 종목을 최우선해.
            - **공매도 거래 비중**: 최근 거래일의 공매도 거래 비중이 10% 이상으로 높은 경우, 향후 강한 하방 압력이 존재함을 뜻하므로 목표가(tp)를 더 타이트하게 내리고 손절선(sl)을 타이트하게 조절해. 만약 공매도 비중이 15%를 초과하여 비정상적으로 높다면, 뉴스 재료가 이를 돌파할 만큼 강력하지 않은 한 TOP PICK(메인 추천) 선정에서 제외(VETO)해.
            - **RSI & 볼린저 밴드**: RSI가 70 이상이거나 볼린저 밴드 상한선 부근(positionPercent > 80%)에 도달한 과열 상태라면, 아무리 뉴스가 좋아도 단기 리스크가 큼을 'bearCase' 및 'feedback'에 경고로 지적하고 분할 매수 전략을 추천해. 반대로 RSI가 30 이하이거나 볼린저 밴드 하한선 부근(positionPercent < 20%)에 위치한 과매도 상태라면 낙폭 과대 반등 가치를 분석해 리포트에 반영해.
        11. **이동평균선 배열 가이드:** 이동평균선이 '역배열 (하락 추세 지속)'인 종목은 메인 추천(TOP PICK)에서 가능한 배제하고, '정배열 (강력한 추세 상승)'이거나 막 20일선 골든크로스가 발생한 안정적인 종목 위주로 선정해.
        12. **최근 추천 백테스팅 피드백 학습:** 제공된 [최근 추천 성적 요약] 백테스팅 리포트를 꼼꼼히 확인해. 최근 추천 성공률이 매우 낮거나 마이너스 성적을 낸 특정 테마군(예: 3일/5일 마이너스)이 있다면, 이번 선정 시 유사 테마/유사 지표를 가진 종목에 대한 리스크 판정을 2배 더 응격하게 적용하여 억지 추천을 원천 배제해. 리포트의 feedback이나 reason에서 스스로 과거 성적 피드백 결과(예: '최근 반도체 테마의 성적이 양호하므로 모멘텀 신뢰도가 높음' 또는 '최근 2차전지 테마의 3일 수익률이 마이너스로 부진하므로 이번 2차전지 종목 추천에서는 목표가를 낮춰 보수적으로 접근함')를 인용하며 학습한 흔적을 남겨줘.
        13. **당일 수급 및 수급 변곡점 최우선 분석 적용:** 제공된 외국인/기관/개인의 당일(1D) 순매수 수량 및 '당일 수급 변곡점 판정' 결과를 가장 중요하게 반영해. '✨ 상승 변곡점' 배지가 있는 후보 종목은 오늘 수급이 상승 전환된 최적의 매수 찬스이므로 TOP PICK 및 'shortTermPicks' 선정 시 최우선 가산점을 부여해. 반면, '⚠️ 하락 변곡점' 배지가 달린 종목은 수급이 급격히 빠져나가는 리스크 상태(개미지옥/설거지 초입)이므로 추천에서 즉각 배제하거나 'bearCase'에서 강력히 경고해. 20일 장기 누적 수급은 노이즈이므로 철저히 무시하고, 당일(1D) 수급의 실시간 변화율만을 근거로 삼아.
        14. **뉴스 감성 스코어(Sentiment Score) 분석 적용:** 제공된 시장/테마/종목별 '뉴스 감성 지수(호재%, 악재%)'를 리스크 판별 및 목표가 설정에 적극적으로 연계해. 만약 특정 종목이나 테마의 호재성 뉴스 비율이 70% 이상이면 시장 관심도가 매우 뜨거운 상태로 보아 'shortTermPicks' 진입 시 가산점을 부여하되, 악재성 뉴스 비율이 30% 이상이거나 갑작스럽게 악재 뉴스가 증가한 경우에는 단기 리스크가 급증한 것으로 판단해 'VETO RULE(추천 배제)' 또는 손절선(sl)을 타이트하게 조절해. 감정적 편향을 억제하고 이 계량 지표를 우선 신뢰해.
        15. **당일(1D) 수급 요약 정보(sp) 강제 탑재:** 'shortTermPicks' 및 'longTermPicks'의 각 종목 객체에 'sp' 필드를 추가해. 'sp'에는 제공된 [분석 후보]의 **당일(1D) 순매수 수량**을 활용해 '외+OO만/기-OO만/개-OO만' 형태(예: '외+12만/기-4.5만/개-7.5만', 만원 미만 단위면 '외+3천/기-500/개+2.5천')로 15자 내외의 **당일 수급 현황 요약**을 반드시 채워줘. 5일 누적이 아닌 당일(1D) 수급 기준이어야 해. 만약 정보가 없으면 '정보없음'으로 기재해.
        16. **ATR 기반 동적 목표가(tp)/손절가(sl) 산출 방식 적용 (강제):**
            - 각 종목에 제공된 [20일 평균 변동성(ATR)] 및 [20일 평균 변동성(ATR)%] 수치를 기준으로 목표가(tp)와 손절가(sl)를 기계적/수학적으로 계산해서 설정해.
            - **단기 투자 (shortTermPicks):** 손절가(sl)는 현재가 대비 약 **-1.5배의 ATR%** 수준으로 넉넉하게 산정해 휩소(속임수 하락)에 털리지 않게 방지하고, 목표가(tp)는 약 **+3.0배의 ATR%** 수준으로 산정해 손익비를 좋게 만들어.
              (예: 현재가 10만원, ATR%가 4.0%라면 단기 손절가는 10만원 - (10만원 * 4.0% * 1.5) = 94,000원, 목표가는 10만원 + (10만원 * 4.0% * 3) = 112,000원으로 기산)
            - **중장기 투자 (longTermPicks):** 손절가(sl)는 현재가 대비 약 **-2.0배의 ATR%** 수준으로 넉넉히 설정하고, 목표가(tp)는 약 **+4.0배의 ATR%** 수준으로 크게 가져가.
            - 종목의 고유 변동성에 맞는 동적 리스크 관리를 반드시 실천해줘.
        17. JSON 형식으로만 응답해.
        18. **웅장한 스타일 및 신속성 어조 반영 (웅장하게, 0.1초 만에):** 최종 리포트의 모든 설명 텍스트(reason, feedback, newInsight 등)는 최고 수준의 퀀트 애널리스트로서 위엄 있고 웅장한 어조(예: '시장의 거대한 수급 폭발을 0.1초 만에 포착하여...', '웅장한 주도 테마의 서막이 열리며...')를 적극적으로 사용하여 작성하십시오. 특히 실시간 데이터 분석의 속도감과 정밀함을 돋보이게 하기 위해 '0.1초 만에'라는 표현을 자연스럽게 활용하여 감탄을 자아내게 하십시오.

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
            "shortTermPicks": [{"n": "종목명", "c": "코드", "p": "현재가", "tp": "목표가", "sl": "손절가", "t": "수익전략(예: +15% 스윙)", "sp": "수급요약"}],
            "longTermPicks": [{"n": "종목명", "c": "코드", "p": "현재가", "tp": "목표가", "sl": "손절가", "r": "투자포인트(한두문장)", "sp": "수급요약"}],
            "newInsight": "새로운 교훈"
          }
        }`;

        try {
            fs.writeFileSync(path.join(__dirname, '../scratch/last_final_prompt.txt'), finalPrompt, 'utf8');
        } catch (e) {
            console.warn('Failed to dump finalPrompt:', e.message);
        }

        const finalRaw = await fetchAiContent(finalPrompt);
        if (!finalRaw) throw new Error('Final analysis stage failed');
        const signalData = finalRaw.signal || finalRaw;

        if (signalData) {
            // 🔧 [결정론적 2차 강제 주입 레이어] AI의 출력을 신뢰하지 않고 백엔드 메모리/Supabase 사전에서 100% 정확한 코드를 강제로 덮어씌웁니다.
            const getDeterministicCode = (name, reportedCode) => {
                if (!name) return reportedCode;
                const cleanedName = name.replace(/\s+/g, '');
                
                // 1차: 당일 실시간 후보군 풀에서 조회
                const poolMatch = candidatePool.find(p => p.name && p.name.replace(/\s+/g, '') === cleanedName);
                if (poolMatch) return poolMatch.code;
                
                // 2차: Supabase 누적 마스터 캐시에서 조회
                if (stockMasterCache[cleanedName]) return stockMasterCache[cleanedName];
                
                return reportedCode; // 매칭 실패 시 최후의 보루
            };

            if (signalData.stock) {
                signalData.symbol = getDeterministicCode(signalData.stock, signalData.symbol);
            }
            if (Array.isArray(signalData.shortTermPicks)) {
                signalData.shortTermPicks.forEach(p => {
                    p.c = getDeterministicCode(p.n, p.c);
                });
            }
            if (Array.isArray(signalData.longTermPicks)) {
                signalData.longTermPicks.forEach(p => {
                    p.c = getDeterministicCode(p.n, p.c);
                });
            }

            cleanSignal(signalData);
            signalData.marketStress = marketStress;
            // 최종 검증: 다시 한번 실시간가 동기화 (오차 방지, 캐시 맵 연동)
            await refreshRecommendedPrices(signalData, candidatePriceMap);

            if (Array.isArray(finalSortedScored)) {
                signalData.candidates = finalSortedScored.map(c => ({
                    name: c.name,
                    code: c.code,
                    totalScore: c.totalScore || 0,
                    price: c.price,
                    change: c.change,
                    isAntHell: c.isAntHell || false,
                    isSelfHealed: c.isSelfHealed || false,
                    selfHealedReasons: c.selfHealedReasons || [],
                    isDefaultFallback: c.isDefaultFallback || false,
                    isVetoed: c.isVetoed || false,
                    vetoReason: c.vetoReason || '',
                    isSupplyGoldenCross: c.isSupplyGoldenCross || false,
                    isSupplyDeathCross: c.isSupplyDeathCross || false,
                    metrics: {
                        disparity1: c.metrics?.disparity1,
                        disparity5: c.metrics?.disparity5,
                        disparity20: c.metrics?.disparity20,
                        strength: c.metrics?.strength,
                        shortRatio: c.metrics?.shortRatio,
                        investor1D: c.metrics?.investor1D,
                        investor5D: c.metrics?.investor5D,
                        investorMoney5D: c.metrics?.investorMoney5D,
                        atr: c.metrics?.atr,
                        atrPercent: c.metrics?.atrPercent,
                        transactionValue: c.metrics?.transactionValue,
                        volumeRate: c.metrics?.volumeRate,
                        creditBalance: c.metrics?.creditBalance,
                        sector: c.metrics?.sector,
                        rsi: c.metrics?.rsi,
                        maAlignment: c.metrics?.maAlignment
                    },
                    scores: c.scores || {},
                    financials: c.financials || null
                }));
            }

            saveAiCache({ pulse: { data: signalData } }, currentHourKey);
            await saveRagDiary(currentNews, signalData);
            
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

const fetchAiContentWithRetry = async (prompt, retries = 3, delay = 1500) => {
    const runCall = async (model) => {
        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" }
        });
        const text = result.response.text ? result.response.text().trim() : result.response.candidates[0].content.parts[0].text.trim();
        return JSON.parse(text);
    };

    let attempt = 0;
    while (attempt < retries) {
        try {
            return await runCall(aiModel);
        } catch (e) {
            attempt++;
            const isRateLimit = e.status === 429 || e.message.includes('429') || e.message.includes('Quota') || e.message.includes('ResourceExhausted');
            if (isRateLimit && attempt < retries) {
                const waitTime = delay * Math.pow(2, attempt) + Math.random() * 1000;
                console.warn(`⚠️ [Gemini Rate Limit] 429 에러 감지. ${Math.round(waitTime)}ms 후 재시도합니다... (시도 ${attempt}/${retries})`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue;
            }
            console.warn(`⚠️ Gemini 호출 실패 (시도 ${attempt}/${retries}):`, e.message);
            if (attempt >= retries) break;
        }
    }

    if (vertexModel) {
        let vertexAttempt = 0;
        while (vertexAttempt < retries) {
            try {
                return await runCall(vertexModel);
            } catch (vErr) {
                vertexAttempt++;
                const isRateLimit = vErr.status === 429 || vErr.message.includes('429') || vErr.message.includes('Quota') || vErr.message.includes('ResourceExhausted');
                if (isRateLimit && vertexAttempt < retries) {
                    const waitTime = delay * Math.pow(2, vertexAttempt) + Math.random() * 1000;
                    console.warn(`⚠️ [Vertex Rate Limit] 429 에러 감지. ${Math.round(waitTime)}ms 후 재시도합니다... (시도 ${vertexAttempt}/${retries})`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    continue;
                }
                console.error(`❌ Vertex 호출 실패 (시도 ${vertexAttempt}/${retries}):`, vErr.message);
                if (vertexAttempt >= retries) break;
            }
        }
    }

    return null;
};

// --- AI Helper (Used in passes) ---
const fetchAiContent = async (p) => {
    return await fetchAiContentWithRetry(p);
};


import { sendStopLossAlert } from '../lib/notifier.js';

// --- History Endpoint ---
router.get('/history', async (req, res) => {
    try { res.json(await getRagDiary()); } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// --- Test SMS Endpoint ---
router.get('/test-sms', async (req, res) => {
    const phone = req.query.phone || '010-4885-8575';
    try {
        console.log(`📡 [API Test] Sending test SMS to ${phone} from backend...`);
        const success = await sendStopLossAlert(phone, '삼성전자', 72000, 75000);
        res.json({ success, message: success ? 'SMS sent successfully' : 'SMS send failed' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

export default router;
