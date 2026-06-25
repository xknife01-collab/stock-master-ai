import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config();

import supabase from '../lib/supabaseClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const aiCachePath = path.join(__dirname, '../ai_cache.json');

const stockNames = [
    { name: "삼성전자", code: "005930", sector: "반도체", price: 74200, isVetoed: true, vetoReason: "외인/기관 동반 순매도 지속 및 개미지옥(개인 독식) 감지", isSupplyGoldenCross: false, isSupplyDeathCross: true },
    { name: "SK하이닉스", code: "000660", sector: "반도체", price: 2764000, isVetoed: false, isSupplyGoldenCross: false, isSupplyDeathCross: false },
    { name: "현대차", code: "005380", sector: "자동차", price: 256000, isVetoed: false, isSupplyGoldenCross: true, isSupplyDeathCross: false },
    { name: "기아", code: "000270", sector: "자동차", price: 118500, isVetoed: false, isSupplyGoldenCross: false, isSupplyDeathCross: false },
    { name: "셀트리온", code: "068270", sector: "바이오", price: 192000, isVetoed: false, isSupplyGoldenCross: false, isSupplyDeathCross: false },
    { name: "한미반도체", code: "042700", sector: "반도체", price: 142000, isVetoed: true, vetoReason: "고이격 상태에서 외인/기관 순매도(설거지) 감지 (이격도: 114%, 외인: -12만주)", isSupplyGoldenCross: false, isSupplyDeathCross: true },
    { name: "알테오젠", code: "196170", sector: "바이오", price: 265000, isVetoed: false, isSupplyGoldenCross: true, isSupplyDeathCross: false },
    { name: "HLB", code: "028300", sector: "바이오", price: 68000, isVetoed: true, vetoReason: "역배열 하락 추세 종목 제외 (이동평균 정렬: 역배열)", isSupplyGoldenCross: false, isSupplyDeathCross: false },
    { name: "HD현대일렉트릭", code: "267260", sector: "전력장비", price: 320000, isVetoed: false, isSupplyGoldenCross: false, isSupplyDeathCross: false },
    { name: "삼양식품", code: "003230", sector: "식품", price: 540000, isVetoed: false, isSupplyGoldenCross: false, isSupplyDeathCross: false },
    { name: "카카오", code: "035720", sector: "IT서비스", price: 42000, isVetoed: true, vetoReason: "20일선 아래 흘러내림 종목 제외 (20일 이격도: 94% < 100%)", isSupplyGoldenCross: false, isSupplyDeathCross: true },
    { name: "NAVER", code: "035420", sector: "IT서비스", price: 168000, isVetoed: true, vetoReason: "적자 및 재무안전성 배제 (ROE: -2.3%, 최근 3분기 연속 손실)", isSupplyGoldenCross: false, isSupplyDeathCross: false },
    { name: "LG에너지솔루션", code: "373220", sector: "2차전지", price: 345000, isVetoed: true, vetoReason: "5일선 아래 흘러내림 및 체결강도 약세 (5일 이격도: 97%, 체결강도: 78%)", isSupplyGoldenCross: false, isSupplyDeathCross: true },
    { name: "POSCO홀딩스", code: "005490", sector: "철강/2차전지", price: 362000, isVetoed: true, vetoReason: "단기 주가 계단식 하락 추세 감지 (385000원 -> 372000원 -> 362000원)", isSupplyGoldenCross: false, isSupplyDeathCross: true },
    { name: "에코프로비엠", code: "247540", sector: "2차전지", price: 182000, isVetoed: true, vetoReason: "부실 및 고부채 기업 배제 (부채비율: 245% >= 200%)", isSupplyGoldenCross: false, isSupplyDeathCross: false },
    { name: "삼성바이오로직스", code: "207940", sector: "바이오", price: 812000, isVetoed: false, isSupplyGoldenCross: false, isSupplyDeathCross: false },
    { name: "KB금융", code: "105560", sector: "은행", price: 78500, isVetoed: false, isSupplyGoldenCross: true, isSupplyDeathCross: false },
    { name: "신한지주", code: "055550", sector: "은행", price: 48900, isVetoed: false, isSupplyGoldenCross: false, isSupplyDeathCross: false },
    { name: "두산에너빌리티", code: "034020", sector: "원자력", price: 21500, isVetoed: false, isSupplyGoldenCross: false, isSupplyDeathCross: false },
    { name: "LS", code: "006260", sector: "전력/지주", price: 135000, isVetoed: false, isSupplyGoldenCross: true, isSupplyDeathCross: false },
    { name: "대한항공", code: "003490", sector: "항공", price: 22400, isVetoed: false, isSupplyGoldenCross: false, isSupplyDeathCross: false },
    { name: "아모레퍼시픽", code: "090430", sector: "화장품", price: 165000, isVetoed: true, vetoReason: "RSI 과매수 과열 (82.4, 기준: 78 이상)", isSupplyGoldenCross: false, isSupplyDeathCross: false },
    { name: "한화오션", code: "042660", sector: "조선", price: 31200, isVetoed: false, isSupplyGoldenCross: false, isSupplyDeathCross: false },
    { name: "삼성중공업", code: "010140", sector: "조선", price: 9200, isVetoed: false, isSupplyGoldenCross: true, isSupplyDeathCross: false },
    { name: "LS에코에너지", code: "229640", sector: "전선", price: 28500, isVetoed: false, isSupplyGoldenCross: false, isSupplyDeathCross: false }
];

const mockCandidates = stockNames.map((s, idx) => {
    const totalScore = s.isVetoed ? (70 - idx * 2.2) : (98 - idx * 1.8);
    const strength = s.isVetoed ? (70 + Math.random() * 25) : (105 + Math.random() * 30);
    const shortRatio = s.isVetoed ? (2.5 + Math.random() * 8) : (0.2 + Math.random() * 1.8);
    const disparity5 = s.isVetoed ? (95 + Math.random() * 15) : (99 + Math.random() * 6);
    const disparity20 = s.isVetoed ? (94 + Math.random() * 16) : (100 + Math.random() * 5);
    const atrPercent = 2.0 + Math.random() * 6.0;

    return {
        name: s.name,
        code: s.code,
        price: String(s.price),
        change: `${(Math.random() * 6).toFixed(1)}%`,
        isAntHell: s.isVetoed && Math.random() > 0.5,
        isSelfHealed: false,
        selfHealedReasons: [],
        isDefaultFallback: false,
        isVetoed: s.isVetoed,
        vetoReason: s.vetoReason || '',
        isSupplyGoldenCross: s.isSupplyGoldenCross || false,
        isSupplyDeathCross: s.isSupplyDeathCross || false,
        metrics: {
            disparity5: parseFloat(disparity5.toFixed(1)),
            disparity20: parseFloat(disparity20.toFixed(1)),
            strength: parseFloat(strength.toFixed(1)),
            shortRatio: parseFloat(shortRatio.toFixed(1)),
            investor1D: { foreign: 50000, organ: 20000, personal: -70000 },
            investor5D: { foreign: 250000, organ: 120000, personal: -370000 },
            investorMoney5D: { foreign: 25, organ: 12, personal: -37 },
            atr: Math.round(s.price * (atrPercent / 100)),
            atrPercent: parseFloat(atrPercent.toFixed(2)),
            transactionValue: Math.round(50000000000 + Math.random() * 150000000000),
            volumeRate: Math.round(100 + Math.random() * 300),
            creditBalance: parseFloat((0.2 + Math.random() * 2.5).toFixed(2)),
            sector: s.sector,
            rsi: Math.round(45 + Math.random() * 35),
            maAlignment: s.isVetoed && s.vetoReason.includes("역배열") ? "역배열 (하락세 지속)" : "정배열 (강력한 추세 상승)"
        },
        scores: {
            strengthScore: Math.round(15 + Math.random() * 15),
            supplyScore: Math.round(20 + Math.random() * 15),
            indexRelativeScore: Math.round(10 + Math.random() * 10),
            trendScore: s.isVetoed ? -15 : 15,
            moneyInflowScore: Math.round(5 + Math.random() * 10),
            financialScore: s.isVetoed ? 0 : Math.round(10 + Math.random() * 10),
            backtestPenalty: s.isVetoed ? 0 : Math.round(-5 * Math.random())
        },
        totalScore,
        financials: {
            roe: s.isVetoed && s.vetoReason.includes("적자") ? -2.3 : parseFloat((8 + Math.random() * 20).toFixed(1)),
            debtRatio: s.isVetoed && s.vetoReason.includes("부채") ? 245 : parseFloat((25 + Math.random() * 80).toFixed(1)),
            pbr: parseFloat((0.8 + Math.random() * 3.5).toFixed(2))
        }
    };
});

async function run() {
    console.log("⚡ Starting cache injection...");
    if (!fs.existsSync(aiCachePath)) {
        console.error("❌ Cache file does not exist at:", aiCachePath);
        return;
    }

    const cacheData = JSON.parse(fs.readFileSync(aiCachePath, 'utf8'));
    if (!cacheData.pulse) {
        console.error("❌ 'pulse' root object missing in cache file.");
        return;
    }

    // Embed in both root level (if returned directly) and .data (if nested)
    cacheData.pulse.candidates = mockCandidates;
    if (cacheData.pulse.data) {
        cacheData.pulse.data.candidates = mockCandidates;
    }

    fs.writeFileSync(aiCachePath, JSON.stringify(cacheData, null, 2), 'utf8');
    console.log("✅ Successfully wrote 25 mock candidates to local ai_cache.json.");

    // Upload to Supabase to update the cloud cache for local sync integrity
    if (supabase) {
        try {
            const jsonStr = JSON.stringify(cacheData, null, 2);
            const { error } = await supabase
                .from('stock_master_map')
                .upsert({ name: '__ai_cache__', code: jsonStr }, { onConflict: 'name' });
            if (error) {
                console.error("❌ Supabase upload failed:", error.message);
            } else {
                console.log("💾 Supabase __ai_cache__ successfully updated.");
            }
        } catch (e) {
            console.error("❌ Supabase upload error:", e.message);
        }
    }
}

run();
