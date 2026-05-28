import express from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { aiModel, vertexModel } from '../lib/ai.js';
import { getAccessToken, KIS_BASE_URL, getKisHeaders, fetchStockPrice, fetchStockAnalytics, fetchStockInvestorTrend, fetchMarketRankings, fetchConditionResult, fetchMultipleStockQuantMetrics, fetchStockFinancialsForVeto, fetchIndexDailyHistory } from '../lib/kisCore.js';
import { fetchMacroIndicators } from './macroApi.js';
import { getSupplyCache, saveSupplyCache } from '../lib/supplyCache.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = express.Router();

const ragDiaryPath = path.join(__dirname, '../rag_diary.json');
const aiCachePath = path.join(__dirname, '../ai_cache.json');
const patternInsightsPath = path.join(__dirname, '../pattern_insights.json');



// ==========================================
// 🔧 [상장코드 환각 방지] Supabase 연동 인메모리 캐시 & 교정기
// ==========================================
import supabase from '../lib/supabaseClient.js';

const stockMasterCache = {};

// Supabase로부터 기존에 수집된 상장코드 매핑 캐시 로딩
const initStockMasterCache = async () => {
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
                stockMasterCache[row.name] = row.code;
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
        if (stockMasterCache[cleanedName] === code) return; // 이미 동일한 매핑 정보가 캐시되어 있으면 스킵
        
        stockMasterCache[cleanedName] = code; // 메모리에 즉시 반영
        
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
const refreshRecommendedPrices = async (signal, candidatePriceMap = {}) => {
    if (!signal) return;
    
    // 1. 메인 픽 가격 갱신 (symbol 필드가 있는 경우)
    if (signal.symbol) {
        let realPrice = candidatePriceMap[signal.symbol];
        let matchedName = null;
        if (!realPrice) {
            const fresh = await fetchStockPrice(signal.symbol);
            if (fresh) {
                realPrice = fresh.price;
                matchedName = fresh.name;
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
                        const freshCorrect = await fetchStockPrice(correctCode);
                        if (freshCorrect) {
                            signal.symbol = correctCode;
                            realPrice = freshCorrect.price;
                            matchedName = freshCorrect.name;
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
                const fresh = await fetchStockPrice(item.c);
                if (fresh) {
                    realPrice = fresh.price;
                    matchedName = fresh.name;
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
                            const freshCorrect = await fetchStockPrice(correctCode);
                            if (freshCorrect) {
                                item.c = correctCode;
                                realPrice = freshCorrect.price;
                                matchedName = freshCorrect.name;
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

    // 2. 장외 시간 및 캐시 확인 (장외 시간이고 캐시가 없으면 diary에서 복구하여 즉각 제공)
    if (!force && !marketOpen) {
        let pulseData = null;
        if (cache && cache.pulse) {
            pulseData = cache.pulse.data || cache.pulse;
        } else {
            // 캐시가 날아갔다면 최신 다이어리 기록을 읽어 캐시를 동적 복구합니다.
            const diary = getRagDiary();
            if (diary && diary.length > 0) {
                console.log(`💤 [Pulse] 장 마감 상태 및 캐시 누락: 다이어리 최신 레코드로 복구 시도`);
                pulseData = diary[0].prediction || diary[0];
                saveAiCache({ pulse: { data: pulseData } }, currentHourKey);
            }
        }

        if (pulseData) {
            console.log(`💤 [Pulse] 장 마감 상태 (이전 분석 결과 캐시 고정 제공)`);
            await refreshRecommendedPrices(pulseData);
            cleanSignal(pulseData);
            return { data: pulseData, time: timeStr };
        }
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

const _executeHourlyPulseInternal = async (currentHourKey, timeStr) => {
    const krNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
    try {
        console.log(`🤖 [${timeStr}] 1단계: 시장 분석 및 종목 후보 선별 시작...`);
        const currentNewsData = await fetchNaverNews();
        const currentNews = currentNewsData.text;
        const marketNewsSentiment = currentNewsData.sentiment;
        
        // 지수 및 매크로 정보 병렬 조회 (미국채 10년물 금리 추가)
        const [macro, kospiHistory, kosdaqHistory, us10yData] = await Promise.all([
            fetchMacroIndicators(),
            fetchIndexDailyHistory('0001'),
            fetchIndexDailyHistory('1001'),
            fetchUs10yYield()
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

        console.log(`📡 [Pulse] 시장 매크로 스트레스 지수 계산 완료: ${totalStressScore}점 (Safe Mode: ${marketStress.safeMode})`);

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

        // --- 다각화된 데이터 수집 (Discovery Funnel) ---
        console.log(`📡 [Pulse] 다각화된 시장 데이터 수집 중 (상승률/거래대금/HTS)...`);
        const [gainers, values, supplyList, htsGolden, htsVolume] = await Promise.all([
            fetchMarketRankings('GAIN'),    // 상승률 상위
            fetchMarketRankings('VALUE'),   // 거래대금 상위
            fetchSupplyRank(),              // 외인/기관 순매수 (기존)
            fetchConditionResult('0'),      // HTS: 골든크로스 (임의 seq)
            fetchConditionResult('1')       // HTS: 거래량 급증 (임의 seq)
        ]);

        const isEtfOrIndex = (name) => {
            const keywords = ["KODEX", "TIGER", "SOL", "RISE", "KBSTAR", "ACE", "HANARO", "KOSEF", "ARIRANG", "ETN", "인버스", "레버리지", "선물", "국채", "달러", "고배당", "MSCI", "ESG", "active", "액티브", "로우볼", "밸류", "모멘텀"];
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

        // 5개 수집 리스트 통합하여 고유 종목화 및 중요도 산정
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
        processList(parseSupplyStocks(supplyList), "수급우수");

        // 💾 [Supabase 자가 학습] 실시간 발견된 모든 한글 종목명 - 코드 맵을 백그라운드로 저장
        updateStockMasterFromList(gainers);
        updateStockMasterFromList(values);
        updateStockMasterFromList(htsGolden);
        updateStockMasterFromList(htsVolume);
        updateStockMasterFromList(parseSupplyStocks(supplyList));

        // 상위 30개 종목 압축 선정 (ETF 및 인덱스 펀드류 제거)
        // 정렬 기준: 1. 포착 횟수 내림차순, 2. 거래대금 내림차순, 3. 절대 등락률 내림차순
        const candidatePool = Array.from(candidateOccurrence.values())
            .filter(c => !isEtfOrIndex(c.name))
            .sort((a, b) => {
                if (b.count !== a.count) return b.count - a.count;
                if (b.value !== a.value) return b.value - a.value;
                return Math.abs(b.change) - Math.abs(a.change);
            })
            .slice(0, 30);

        const symbols = candidatePool.map(c => c.code);

        // 상위 30개 종목에 대한 실시간 퀀트 지표 (체결강도, 이격도, 공매도 비중) 수집
        console.log(`📡 [Pulse] 상위 30개 후보 종목의 실시간 퀀트 지표 수집 시작...`);
        const metricsMap = await fetchMultipleStockQuantMetrics(symbols);

        // 각 종목별 100점 만점 퀀트 스코어 계산 및 상세 점수표 구축
        const scoredCandidates = candidatePool.map(c => {
            const m = metricsMap[c.code] || { price: c.price, disparity5: 100, disparity20: 100, strength: 100, shortRatio: 0 };
            
            // 1) 체결강도 점수 (Max 40점)
            let strengthScore = 0;
            const str = m.strength;
            if (str >= 120) strengthScore = 40;
            else if (str >= 105) strengthScore = 30;
            else if (str >= 100) strengthScore = 20;
            else if (str >= 90) strengthScore = 10;
            else strengthScore = 0;

            // 2) 20일 이격도 점수 (Max 35점)
            let disparityScore = 0;
            const disp = m.disparity20;
            if (disp >= 98 && disp <= 103) disparityScore = 35;
            else if (disp > 103 && disp <= 106) disparityScore = 25;
            else if (disp < 98) disparityScore = 15;
            else if (disp > 106 && disp < 107) disparityScore = 5;
            else disparityScore = -10; // 107% 이상 감점

            // 3) 공매도 비중 점수 (Max 25점)
            let shortScore = 0;
            const sr = m.shortRatio;
            if (sr < 5) shortScore = 25;
            else if (sr >= 5 && sr < 10) shortScore = 15;
            else if (sr >= 10 && sr < 15) shortScore = 5;
            else shortScore = -10; // 15% 이상 감점

            const totalScore = strengthScore + disparityScore + shortScore;

            return {
                name: c.name,
                code: c.code,
                price: m.price || c.price,
                change: c.change,
                metrics: {
                    disparity5: m.disparity5,
                    disparity20: m.disparity20,
                    strength: m.strength,
                    shortRatio: m.shortRatio
                },
                scores: {
                    strengthScore,
                    disparityScore,
                    shortScore
                },
                totalScore
            };
        });

        // 퀀트 점수 높은 순 정렬
        const sortedScored = [...scoredCandidates].sort((a, b) => b.totalScore - a.totalScore);

        // 하드 필터링 적용 (안전 모드 여부에 따라 동적 상향 조절)
        const minTotalScore = marketStress.safeMode ? 75 : 60;
        const minStrength = marketStress.safeMode ? 100 : 90;
        const maxDisparity = marketStress.safeMode ? 104 : 107;
        const maxShortRatio = marketStress.safeMode ? 7 : 10;

        console.log(`🛡️ [Filter Config] Safe Mode: ${marketStress.safeMode} ➡️ 최소 점수 ${minTotalScore}점, 최소 체결강도 ${minStrength}%, 최대 이격도 ${maxDisparity}%, 최대 공매도 비중 ${maxShortRatio}% 적용`);

        const technicallyFiltered = sortedScored.filter(c => {
            return c.totalScore >= minTotalScore &&
                   c.metrics.strength >= minStrength &&
                   c.metrics.disparity20 < maxDisparity &&
                   c.metrics.shortRatio < maxShortRatio;
        });


        // 2차 재무 건전성 및 밸류에이션 하드 필터링 적용 (상위 10개 대상)
        const filteredCandidates = [];
        console.log(`📡 [Pulse] 기술적 필터 통과 종목 대상 재무 건전성 및 수급 조회 시작...`);
        for (let i = 0; i < technicallyFiltered.length; i++) {
            const c = technicallyFiltered[i];
            
            // 상위 10개 종목만 재무 조사 진행 (Rate Limit 및 API 부하 절약)
            if (filteredCandidates.length >= 10) {
                break;
            }

            try {
                // 1. 재무 데이터 조회
                const fin = await fetchStockFinancialsForVeto(c.code);
                await sleep(160);

                if (fin) {
                    // (1) ROE 적자 기업 원천 제외 Veto Rule
                    if (fin.roe !== null && fin.roe < 0) {
                        console.log(`❌ [Financial Veto] ${c.name} (${c.code}) - ROE 적자(${fin.roe}%)로 후보군에서 원천 제외`);
                        continue;
                    }

                    // (2) 최근 3분기 연속 영업이익 적자(영업손실) 한계 기업 제외 Veto Rule
                    if (fin.opProfits && fin.opProfits.length >= 3 && fin.opProfits.every(p => p < 0)) {
                        console.log(`❌ [Financial Veto] ${c.name} (${c.code}) - 3분기 연속 영업이익 적자로 후보군에서 원천 제외`);
                        continue;
                    }

                    // (3) 중장기 가치주 배제 태깅 (ROE < 5% 이거나 PER > 100배 혹은 PER < 0배인 극단적 밸류에이션 종목)
                    let isLongTermExcluded = false;
                    const reason = [];
                    if (fin.roe !== null && fin.roe < 5) {
                        isLongTermExcluded = true;
                        reason.push(`ROE 5% 미만 (${fin.roe}%)`);
                    }
                    if (fin.per !== null && (fin.per > 100 || fin.per < 0)) {
                        isLongTermExcluded = true;
                        reason.push(`PER 과열/마이너스 (${fin.per}배)`);
                    }

                    c.financials = fin;
                    c.isLongTermExcluded = isLongTermExcluded;
                    c.longTermExcludeReason = reason.join(', ');
                }

                // 2. 수급 데이터 조회
                const supplyRes = await fetchStockInvestorTrend(c.code);
                if (supplyRes && supplyRes.stats) {
                    c.supplyStats = supplyRes.stats;
                }
                await sleep(160);

                filteredCandidates.push(c);
            } catch (err) {
                console.error(`⚠️ [Pulse] ${c.name} 재무/수급 분석 중 에러:`, err.message);
                // API 에러 발생 시 안전 장치로 포함
                filteredCandidates.push(c);
            }
        }

        // 기준 충족 종목이 없을 경우 즉시 안전 대피(Hold) 시그널 반환 및 캐싱
        if (filteredCandidates.length === 0) {
            console.log(`⚠️ [Pulse] 최소 안전 기준(기술적 필터 및 재무 건전성 Veto)을 충족하는 종목이 없습니다. 추천을 보류합니다.`);
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
            
            fs.writeFileSync(aiCachePath, JSON.stringify({ pulse: holdSignal, hourKey }, null, 2), 'utf8');
            return { data: holdSignal, time: timeStr };
        }


        const scoredCandidatesCtx = filteredCandidates.map((c, idx) => {
            const supplyText = c.supplyStats ? 
                `➡️ 수급: 외인 5일 누적 ${c.supplyStats.foreign5D > 0 ? '+' : ''}${c.supplyStats.foreign5D.toLocaleString()}주 / 기관 5일 누적 ${c.supplyStats.organ5D > 0 ? '+' : ''}${c.supplyStats.organ5D.toLocaleString()}주` : 
                `➡️ 수급: (조회 대기 상태)`;
            
            const fin = c.financials;
            const finText = fin ? 
                `➡️ 재무: ROE: ${fin.roe !== null ? fin.roe + '%' : '정보 없음'} / PER: ${fin.per !== null ? fin.per + '배' : '정보 없음'} / PBR: ${fin.pbr !== null ? fin.pbr + '배' : '정보 없음'}` : 
                `➡️ 재무: (조회 대기 상태)`;

            const excludeBadge = c.isLongTermExcluded ? 
                ` ⚠️ [중장기 가치주 제외 대상 - 사유: ${c.longTermExcludeReason}]` : 
                '';

            return `[${idx + 1}위] ${c.name} (${c.code})${excludeBadge} - 퀀트 종합점수: ${c.totalScore}점 / 100점
    - [20일 이격도] 수치: ${c.metrics.disparity20}% ➡️ 점수: ${c.scores.disparityScore}점 / 35점
    - [체결강도] 수치: ${c.metrics.strength}% ➡️ 점수: ${c.scores.strengthScore}점 / 40점
    - [공매도 비중] 수치: ${c.metrics.shortRatio}% ➡️ 점수: ${c.scores.shortScore}점 / 25점
    - [5일 누적 수급] ${supplyText}
    - [재무 및 밸류에이션] ${finText}
    - 현재가: ${c.price.toLocaleString()}원 (전일대비: ${c.change > 0 ? '+' : ''}${c.change}%)`;
        }).join('\n\n');

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
        오늘은 \${krNow.getUTCFullYear()}년 \${krNow.getUTCMonth()+1}월 \${krNow.getUTCDate()}일 \${timeStr}야. 
        아래 [현재 매크로 상황], [실시간 시장 포착 후보 종목 및 퀀트 점수표], [최신 뉴스], [장기 기억]를 종합하여 
        지금 가장 강력한 '상승 모멘텀'을 가진 주도 테마 1개를 선정하고, 이에 포함되거나 연관된 유망 종목 '총 25개'를 선정해.

        **분석 가이드라인 및 필수 제약사항 (VETO RULES)**
        1. **TOP PICK 선정 규칙**: 최종 추천 종목의 첫 번째 종목(TOP PICK, candidates[0])은 반드시 아래 [실시간 시장 포착 후보 종목 및 퀀트 점수표]에서 **퀀트 스코어가 높은 상위권(1위~5위 이내) 종목** 중에서만 골라야 해.
        2. **절대 진입 금지 필터**: 퀀트 스코어가 **40점 이하**이거나, 20일 이격도 점수에서 **음수 감점(-10점)**을 받아 가격 부담이 극도로 심한 종목(예: 20일 이격도 107% 초과로 과열)은 **절대 TOP PICK으로 선정할 수 없어**. 뉴스 호재가 아무리 강력하고 거래량이 많아도 이 룰은 예외 없이 적용해.
        3. **정렬 순서**: 추천 종목 'candidates' 배열의 정렬 순서는 퀀트 종합 점수(totalScore)가 높은 종목이 맨 앞으로 오도록 내림차순 정렬해야 해.
        4. [최신 뉴스]를 분석할 때, 발행 시각이 분석일(\${krNow.getUTCFullYear()}-\${krNow.getUTCMonth()+1}-\${krNow.getUTCDate()})로부터 '24시간 이내'인 뉴스를 최우선 가중치(35%)로 반영해.
        5. 매크로 지표: 10%, 외인/기관 수급: 30%, 퀀트 점수 및 리스크 필터링: 35%, 장기 기억(과거 패턴 및 최근 실적): 25%

        [현재 매크로 상황]
        \${macroCtx}

        [실시간 시장 포착 후보 종목 및 퀀트 점수표 (총점 순 정렬)]
        아래 후보들은 퀀트 종합점수(체결강도 40점 + 20일 이격도 35점 + 공매도 비중 25점 = 100점 만점) 기준으로 정렬되어 있습니다.
        점수가 높은 종목일수록 매수 유입이 세고, 가격 부담이 적고, 공매도 압박이 없는 안전한 종목입니다.
        \${scoredCandidatesCtx}

        [최신 뉴스 데이터]
        \${currentNews}
        
        [장기 기억 (과거 패턴 및 최근 실적)]
        \${longTermMemory}
        
        [최근 추천 성적 요약]
        \${performanceReport}

        [지시사항]
        1. 위의 가중치와 TOP PICK 선정 제한사항을 엄격히 준수하여 테마 및 종목을 선정해.
        2. 환율(USD/KRW)과 미국채 금리가 현재 섹션(수출주/금융주/성장주 등)에 미치는 영향을 매크로 비중(10%) 내에서 중요하게 고려해.
        3. 외인이나 기관의 수급이 실제로 들어오고 있는 종목을 'candidates'에 우선 포함시켜(30%).
        4. 과거에 반복되었던 패턴이나 최근의 성적(장기 기억)이 현재 상황과 일치하거나 긍정적인 경우 높은 점수(25%)를 부여해.
        5. **필터링 룰 (핵심):** 단순히 오늘 하루 3~5% 올랐다거나 외인 매수가 찍혔다고 해서 무조건 추천하면 안 돼. 네가 알고 있는 해당 종목/섹터의 '장기(구조적) 추세'를 반드시 판단해. 만약 근 1~2년간 전기차 캐즘, 공급 과잉 등으로 장기 우하향 중이던 섹터라면, 오늘의 반등이 '진짜 바닥 탈출(추세 전환)'을 증명할 만한 강력한 뉴스나 매크로 변화가 동반되지 않은 한 데드캣 바운스(Dead Cat Bounce)로 간주하고 강력히 배제해!
        6. **정직한 보류 권한:** 만약 너의 분석 결과, 현재 시장 상황이나 수급, 매크로 지표 상 '진짜 주도주'가 될 만한 종목이 단 하나도 발견되지 않는다면, 억지로 종목을 채우지 말고 candidates 리스트를 **빈 배열([])**로 반환해. 'Structural Decline'인 종목을 추천하는 것은 투자자에게 치명적인 손실을 입히는 행위임을 명심해.
        
        [출력 양식 (JSON)]
        { "theme": "주도 테마명", "candidates": ["종목명1", "종목명2", "종목명3"] }\n`;

        const selectionRaw = await fetchAiContent(selectionPrompt);
        console.log('Selection Raw Output:', JSON.stringify(selectionRaw, null, 2));
        const rawCandidates = selectionRaw?.candidates || [];
        
        // 🔧 [결정론적 1:1 상장코드 주입 레이어]
        const candidates = rawCandidates.map(name => {
            if (!name || typeof name !== 'string') return null;
            const cleanedName = name.replace(/\s+/g, '');
            
            // 1차: 실시간 수집 후보군 풀에서 최우선 매칭
            const poolMatch = candidatePool.find(p => p.name && p.name.replace(/\s+/g, '') === cleanedName);
            if (poolMatch) {
                return { n: poolMatch.name, s: poolMatch.code };
            }
            
            // 2차: Supabase 누적 마스터 캐시에서 대조
            if (stockMasterCache[cleanedName]) {
                return { n: name, s: stockMasterCache[cleanedName] };
            }
            
            // 3차: 매핑 데이터가 전혀 없는 종목은 환각 방지를 위해 제외
            console.warn(`🚨 [원천 차단] 1차 매칭 실패 종목 제외: ${name}`);
            return null;
        }).filter(Boolean);

        const mainTheme = selectionRaw?.theme || '분석중';
        // --- 중간 단계: KIS 실시간 가격 조회 ---
        console.log(`📊 [${timeStr}] 2단계: 후보 종목(${candidates.length}개) 실시간 가격 동기화 중...`);
        const syncedPrices = [];
        const candidatePriceMap = {};
        for (const c of candidates) {
            const fresh = await fetchStockPrice(c.s);
            if (fresh) {
                candidatePriceMap[c.s] = fresh.price;
                syncedPrices.push(`${c.n}(${c.s}): ${fresh.price}원`);
                await sleep(150); // 한투 API 부하 관리
            }
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
                const [newsResult, supplyResult, analyticsResult] = await Promise.all([
                    fetchNaverNews(`${c.n} 주식 전망 공시 뉴스`),
                    fetchStockInvestorTrend(c.s),
                    fetchStockAnalytics(c.s)
                ]);
                
                detailedCandidatesData.push({
                    name: c.n,
                    code: c.s,
                    news: newsResult?.text || "데이터 부족",
                    newsSentiment: newsResult?.sentiment || null,
                    supply: supplyResult?.rawSummary || "정보 없음",
                    supplyStats: supplyResult?.stats || null,
                    finance: analyticsResult?.financeData || null,
                    technical: analyticsResult?.technicalIndicators || null,
                    priceData: analyticsResult?.priceData || null,
                    strength: analyticsResult?.strength || null,
                    shortRatio: analyticsResult?.shortRatio || null
                });
                
                await sleep(150); // API 부하 조절
            } catch (err) {
                console.error(`Error fetching detailed data for candidate ${c.n}:`, err.message);
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
                
            return `[분석 후보 ${idx + 1}위: ${d.name} (${d.code})]
        1. 종목별 최신 뉴스/공시:
        ${d.news}
        - 종목 뉴스 감성 지수: 호재(Bullish) ${d.newsSentiment?.bullishPercent || 0}%, 악재(Bearish) ${d.newsSentiment?.bearishPercent || 0}%, 중립(Neutral) ${d.newsSentiment?.neutralPercent || 0}%
        
        2. 외국인/기관 수급 추이 (3일):
        ${d.supply}
        - 외국인 5일 누적 순매수 수량: ${d.supplyStats?.foreign5D !== undefined ? d.supplyStats.foreign5D.toLocaleString() + '주' : '정보 없음'}
        - 기관 5일 누적 순매수 수량: ${d.supplyStats?.organ5D !== undefined ? d.supplyStats.organ5D.toLocaleString() + '주' : '정보 없음'}
        - 외국인 20일 누적 순매수 수량: ${d.supplyStats?.foreign20D !== undefined ? d.supplyStats.foreign20D.toLocaleString() + '주' : '정보 없음'}
        - 기관 20일 누적 순매수 수량: ${d.supplyStats?.organ20D !== undefined ? d.supplyStats.organ20D.toLocaleString() + '주' : '정보 없음'}
        - 외국인 연속 순매수 일수: ${d.supplyStats?.foreignConsecutiveDays !== undefined ? d.supplyStats.foreignConsecutiveDays + '일 연속' : '정보 없음'}
        - 기관 연속 순매수 일수: ${d.supplyStats?.organConsecutiveDays !== undefined ? d.supplyStats.organConsecutiveDays + '일 연속' : '정보 없음'}
        
        3. 과거 실적 (재무):
        ${financeStr}

        4. 최근 주가/거래량 추이:
        ${priceDataStr}

        5. 기술적 분석 및 거래 지표 (정량 데이터):
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
        - 매크로 지표: 10%
        - 외인/기관 수급 (전체 및 개별 종목): 30%
        - 최신 뉴스 (전체 및 개별 종목): 35%
        - 장기 기억(과거 패턴 및 최근 실적): 25%
 
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
        3. 'shortTermPicks'는 제공된 분석 후보들 중 단기 체결강도가 강하고 뉴스 재료가 신선하며 최근 5일/20일 수급 유입이 긍정적인 종목 위주로 선정해.
        4. 'longTermPicks'는 제공된 분석 후보들 중 재무 건전성이 탄탄하고(매출 및 영업이익 상승세), 기관 또는 외인 수급이 꾸준하게 유입되며 장기 성장성이 기대되는 종목 위주로 선정해.
        5. **필터링 대원칙(VETO RULE):** 분석 결과 펀더멘털이 "하락 추세(Structural Decline)"로 판명된 종목은 수급이 아무리 좋아도 절대 TOP PICK(메인 추천)으로 선정하지 마. 억지로 추천할 필요가 없으며, 정합성이 맞지 않으면 모든 추천 종목 필드를 비워둬도 좋아. 
        6. **정직성 원칙 (Sincerity):** 데이터가 불충분하거나 모든 후보가 장기 하락 추세(Structural Decline)라면, TOP PICK(stock 필드)을 null로 설정하고, feedback에 그 이유(추천 보류 근거)를 솔직하고 냉정하게 기술해. "억지 추천"은 금기 사항이야.
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
        const result = await aiModel.generateContent({
            contents: [{ role: 'user', parts: [{ text: p }] }],
            generationConfig: { responseMimeType: "application/json" }
        });
        const text = result.response.text().trim();
        return JSON.parse(text);
    } catch(e) {
        console.warn('Gemini 실패, Vertex 폴백...', e.message);
        try {
            if (vertexModel) {
                const vResult = await vertexModel.generateContent({
                    contents: [{ role: 'user', parts: [{ text: p }] }],
                    generationConfig: { responseMimeType: "application/json" }
                });
                const vText = vResult.response.candidates[0].content.parts[0].text.trim();
                return JSON.parse(vText);
            }
            return null;
        } catch(vErr) { 
            console.error('Vertex fallback 실패:', vErr.message);
            return null; 
        }
    }
};

import { sendStopLossAlert } from '../lib/notifier.js';

// --- History Endpoint ---
router.get('/history', (req, res) => {
    try { res.json(getRagDiary()); } catch (e) { res.status(500).json({ error: 'Failed' }); }
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
