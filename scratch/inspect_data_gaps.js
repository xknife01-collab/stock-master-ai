import dotenv from 'dotenv';
dotenv.config();
import supabase from '../lib/supabaseClient.js';
import { 
    fetchMarketRankings, 
    fetchConditionResult,
    getAccessToken,
    KIS_BASE_URL,
    getKisHeaders,
    kisRequest
} from '../lib/kisCore.js';

// Helper to parse supply stocks format (e.g. "삼성전자(005930)")
const parseSupplyStocks = (text) => {
    if (!text || text === "데이터 부족") return [];
    const stocks = [];
    const regex = /([가-힣A-Za-z0-9&]+)\s*\((\d{6})\)/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
        stocks.push({
            name: match[1].trim(),
            code: match[2]
        });
    }
    return stocks;
};

async function runDataGapInspection() {
    console.log("🔍 1단계: 조건검색 및 랭킹으로부터 실시간 후보 종목 수집 중...");
    
    // 수급 우수 종목 가상 조회용
    let supplyList = "";
    try {
        const token = await getAccessToken();
        const res = await kisRequest({
            method: 'get',
            url: `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-investor-market-trend`,
            params: {
                FID_COND_MRKT_DIV_CODE: 'U',
                FID_COND_SCR_DIV_CODE: '20121',
                FID_INPUT_ISCD: '0001'
            },
            headers: { ...getKisHeaders('FHPST01210000'), 'authorization': `Bearer ${token}` }
        });
        if (res.data?.rt_cd === '0' && res.data?.output) {
            supplyList = res.data.output.slice(0, 10).map(it => `${it.hts_kor_isnm}(${it.mksc_shrn_iscd})`).join(', ');
        }
    } catch (e) {
        console.warn("수급 순위 조회 실패 (Fallback 사용):", e.message);
    }

    const [gainers, values, htsGolden, htsVolume] = await Promise.all([
        fetchMarketRankings('0'), // 거래량
        fetchMarketRankings('2'), // 거래대금
        fetchConditionResult('0'), // 골든크로스
        fetchConditionResult('1')  // 거래량 급증
    ]);

    const candidateOccurrence = new Map();
    const processList = (list, tag) => {
        if (!list) return;
        list.forEach(it => {
            if (!it.code) return;
            const existing = candidateOccurrence.get(it.code) || {
                name: it.name,
                code: it.code,
                tags: []
            };
            if (!existing.tags.includes(tag)) existing.tags.push(tag);
            candidateOccurrence.set(it.code, existing);
        });
    };

    processList(gainers, "급등");
    processList(values, "거래폭발");
    processList(htsGolden, "골든크로스");
    processList(htsVolume, "수급포착");
    processList(parseSupplyStocks(supplyList), "수급우수");

    const candidates = Array.from(candidateOccurrence.values());
    console.log(`📡 총 ${candidates.length}개의 고유 후보 종목이 식별되었습니다.`);

    console.log("\n🔍 2단계: Supabase 캐시 테이블에서 데이터 누락 확인 중...");
    const symbols = candidates.map(c => c.code);

    const { data: cacheData, error } = await supabase
        .from('stock_detail_cache')
        .select('*')
        .in('symbol', symbols);

    if (error) {
        console.error("❌ Supabase 조회 에러:", error.message);
        return;
    }

    console.log(`📊 캐시 테이블에 존재하는 레코드: ${cacheData.length} / ${symbols.length}`);

    const missingRecords = symbols.filter(s => !cacheData.some(row => row.symbol === s));
    if (missingRecords.length > 0) {
        console.log(`❌ [캐시 아예 없음 - KIS 연동 필요] 총 ${missingRecords.length}개 종목:`, 
            missingRecords.map(s => `${candidateOccurrence.get(s)?.name}(${s})`).join(', ')
        );
    }

    console.log("\n📋 각 후보 종목별 세부 데이터 누락 진단 보고서:");
    console.log("=".repeat(100));
    console.log(
        String("종목명(코드)").padEnd(16) + 
        String("캐시상태").padEnd(12) + 
        String("재무 데이터 누락 항목").padEnd(30) + 
        String("기술적 지표 누락 항목")
    );
    console.log("=".repeat(100));

    for (const c of candidates) {
        const row = cacheData.find(r => r.symbol === c.code);
        const nameCodeStr = `${c.name}(${c.code})`;
        
        if (!row) {
            console.log(
                nameCodeStr.padEnd(16) + 
                "❌ 캐시없음".padEnd(12) + 
                "전체 누락".padEnd(30) + 
                "전체 누락"
            );
            continue;
        }

        const now = new Date();
        const updatedAt = new Date(row.updated_at);
        const diffMins = Math.round((now.getTime() - updatedAt.getTime()) / (1000 * 60));
        const cacheStatus = `${diffMins}분 전`;

        // 1. 재무 데이터 진단
        const missingFinance = [];
        const fund = row.fundamental || {};
        if (fund.roe === undefined || fund.roe === null) missingFinance.push("ROE");
        if (fund.debtRatio === undefined || fund.debtRatio === null) missingFinance.push("부채비율");
        if (!fund.finance || fund.finance.length === 0) {
            missingFinance.push("분기재무(전체)");
        } else {
            // 최근 3분기 당기순이익 체크
            const profits = fund.finance.map(f => f.profit);
            if (profits.some(p => p === undefined || p === null)) {
                missingFinance.push("일부분기이익");
            }
        }
        if (fund.price === undefined || fund.price === null || fund.price === 0) missingFinance.push("현재가");
        if (!fund.sector) missingFinance.push("업종");

        // 2. 기술적/퀀트 데이터 진단
        const missingTechnical = [];
        const adv = row.advanced || {};
        if (adv.atr === undefined || adv.atr === null) missingTechnical.push("ATR");
        if (adv.atrPercent === undefined || adv.atrPercent === null) missingTechnical.push("ATR%");
        if (adv.disparity20 === undefined || adv.disparity20 === null) missingTechnical.push("20일이격도");
        if (adv.strength === undefined || adv.strength === null) missingTechnical.push("체결강도");
        if (adv.shortRatio === undefined || adv.shortRatio === null) missingTechnical.push("공매도비중");
        if (adv.transactionValue === undefined || adv.transactionValue === null) missingTechnical.push("거래대금");
        if (adv.prevTransactionValue === undefined || adv.prevTransactionValue === null) missingTechnical.push("전일거래대금");
        if (adv.volumeRate === undefined || adv.volumeRate === null) missingTechnical.push("거래량증가율");
        if (adv.creditBalance === undefined || adv.creditBalance === null) missingTechnical.push("신용잔고율");
        if (!adv.investor) {
            missingTechnical.push("수급데이터");
        }

        // 보조지표 체크 (추가 예정 항목)
        if (!adv.priceData) missingTechnical.push("일봉차트(priceData)");
        if (!adv.technicalIndicators) missingTechnical.push("보조지표(technicalIndicators)");

        const finStr = missingFinance.length > 0 ? missingFinance.join(', ') : "✅ 정상";
        const techStr = missingTechnical.length > 0 ? missingTechnical.join(', ') : "✅ 정상";

        console.log(
            nameCodeStr.padEnd(16) + 
            cacheStatus.padEnd(12) + 
            finStr.padEnd(30) + 
            techStr
        );
    }
    console.log("=".repeat(100));
    
    process.exit(0);
}

runDataGapInspection();
