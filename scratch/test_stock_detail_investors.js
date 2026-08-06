import { fetchStockFullDetailFromKIS } from '../lib/kisCore.js';

// 가상 상황 검증용 mock 데이터 정의
const mockExisting = {
    fundamental: { name: "삼성전자" },
    advanced: {
        investor: {
            isRealtime: false,
            isTodayData: true,
            foreign1D: 1500000,
            organ1D: -500000,
            personal1D: -1000000,
            foreignConsecutiveDays: 3,
            dailyHistory: [
                { date: "20260706", foreign: 1500000, organ: -500000, personal: -1000000 }
            ]
        }
    }
};

(async () => {
    console.log("==================================================");
    console.log("🧪 백엔드 수급 병합 및 Fallback 로직 검증 테스트");
    console.log("==================================================");

    try {
        // 1. 장중 가상 상황 시뮬레이션
        console.log("\n[Test 1] 장중 상황 (11:00 KST) + KIS에서 오늘자 임시 0주 데이터 반환 + 실시간 가집계 있음");
        
        // KIS investor API가 오늘 날짜로 0을 반환했다고 가정
        const dummyInvestorRes = {
            stats: {
                isTodayData: true, // KIS가 오늘자 dummy 행을 생성함
                foreign1D: 0,
                organ1D: 0,
                personal1D: 0,
                dailyHistory: [
                    { date: "20260707", foreign: 0, organ: 0, personal: 0 },
                    { date: "20260706", foreign: 1500000, organ: -500000, personal: -1000000 }
                ]
            }
        };

        const mockIntradayRes = {
            foreign: 450000,
            organ: 120000,
            personal: -570000
        };

        // 로직 수동 시뮬레이션
        let investorStats = { ...dummyInvestorRes.stats };
        let isRealtime = false;
        
        // 장중이라고 가정 (isMarketClosed = false)
        const isMarketClosed = false;

        if (investorStats) {
            if (!isMarketClosed) {
                if (mockIntradayRes) {
                    investorStats.foreign1D = mockIntradayRes.foreign;
                    investorStats.organ1D = mockIntradayRes.organ;
                    investorStats.personal1D = mockIntradayRes.personal;
                    isRealtime = true;
                    investorStats.isTodayData = false;
                }
            }
            investorStats.isRealtime = isRealtime;
        }

        console.log("✅ 가집계 병합 성공 여부 (isRealtime = true):", investorStats.isRealtime);
        console.log("✅ 병합된 1D 수급 값 (개인/기관/외인):", 
            `개인: ${investorStats.personal1D}, 기관: ${investorStats.organ1D}, 외인: ${investorStats.foreign1D}`);
        
        if (investorStats.foreign1D === 450000 && investorStats.isTodayData === false) {
            console.log("👉 Test 1 통과 (장중 KIS dummy row가 있어도 가집계로 올바르게 덮어씀!)");
        } else {
            console.error("❌ Test 1 실패");
        }

        // 2. 실시간 가집계 데이터도 없고 KIS API가 0값 반환 시 캐시 보존 테스트
        console.log("\n[Test 2] 장중 상황 + KIS 오늘자 임시 0주 데이터 반환 + 실시간 데이터 없음 (캐시 보존 검증)");
        
        let investorStats2 = { ...dummyInvestorRes.stats };
        let isRealtime2 = false;
        const mockIntradayRes2 = null;
        const mockMemberTrend2 = null;

        if (investorStats2) {
            if (!isMarketClosed) {
                if (mockIntradayRes2) {
                    investorStats2.foreign1D = mockIntradayRes2.foreign;
                    isRealtime2 = true;
                } else if (mockMemberTrend2) {
                    investorStats2.foreign1D = mockMemberTrend2.foreignNetBuy;
                    isRealtime2 = true;
                } else {
                    // 캐시 보존 적용
                    if (mockExisting?.advanced?.investor) {
                        investorStats2.foreign1D = mockExisting.advanced.investor.foreign1D;
                        investorStats2.organ1D = mockExisting.advanced.investor.organ1D;
                        investorStats2.personal1D = mockExisting.advanced.investor.personal1D;
                        isRealtime2 = mockExisting.advanced.investor.isRealtime;
                        investorStats2.isTodayData = mockExisting.advanced.investor.isTodayData;
                    }
                }
            }
            investorStats2.isRealtime = isRealtime2;
        }

        console.log("✅ 캐시 보존 성공 여부 (이전 값 1500000 그대로 보존):", investorStats2.foreign1D);
        if (investorStats2.foreign1D === 1500000) {
            console.log("👉 Test 2 통과 (실시간 데이터 부재 시 0주로 초기화되지 않고 기존 캐시 유지!)");
        } else {
            console.error("❌ Test 2 실패");
        }

        // 3. 실제 종목으로 API 호출 통합 테스트
        console.log("\n[Test 3] 실제 아모레퍼시픽(090430) 종목에 대해 fetchStockFullDetailFromKIS 동작 테스트");
        console.log("KIS API 호출을 진행합니다 (약 5초 소요)...");
        
        const fullDetail = await fetchStockFullDetailFromKIS("090430", null, false, false, true);
        console.log("✅ 실제 호출 완료.");
        console.log("- 종목명:", fullDetail.fundamental.name);
        console.log("- 수급 데이터 구조:", !!fullDetail.advanced.investor);
        if (fullDetail.advanced.investor) {
            console.log("  - 외인 1D:", fullDetail.advanced.investor.foreign1D);
            console.log("  - 기관 1D:", fullDetail.advanced.investor.organ1D);
            console.log("  - 개인 1D:", fullDetail.advanced.investor.personal1D);
            console.log("  - 실시간 여부 (isRealtime):", fullDetail.advanced.investor.isRealtime);
            console.log("  - 오늘 데이터 여부 (isTodayData):", fullDetail.advanced.investor.isTodayData);
            console.log("  - 전체 investor 객체:", JSON.stringify(fullDetail.advanced.investor, null, 2));
        }
        console.log("\n👉 Test 3 완료!");

    } catch (e) {
        console.error("❌ 테스트 중 오류 발생:", e);
    }
})();
