import { getAllPortfoliosForMonitoring, updateAlertStatus } from './db.js';
import { fetchStockPrice } from './kisCore.js';
import { sendStopLossAlert } from './notifier.js';
import { isMarketOpen } from '../routes/aiApi.js';

// Simple sleep helper to respect KIS API rate limits
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 실시간 손절 감시 작업
 * 모든 가입자의 보유 주식 중 아직 알림이 발생하지 않은 주식을 조회하여
 * 한투 API로 현재가를 확인하고 손절선 터치 시 알림톡/문자를 보냅니다.
 */
export const runStopLossMonitor = async () => {
    // 1. 장 개장 여부 검증 (야간/주말 KIS 호출 낭비 방지)
    if (!isMarketOpen()) {
        console.log('💤 [Monitor] 장 마감 상태입니다. 실시간 손절 감시를 일시 중지합니다.');
        return;
    }

    try {
        console.log('🔍 [Monitor] 실시간 손절선 돌파 여부 분석 시작...');
        const portfolios = await getAllPortfoliosForMonitoring();
        
        // 아직 알림이 안 나갔고 손절가가 설정된 항목들만 필터링
        const activeItems = portfolios.filter(p => !p.isAlerted && p.stopLossPrice > 0);
        
        if (activeItems.length === 0) {
            console.log('✅ [Monitor] 감시 대상 활성 손절 항목이 없습니다.');
            return;
        }

        console.log(`📊 [Monitor] 총 ${activeItems.length}개의 종목 감시 진행 중...`);

        // 중복 시세 조회를 피하기 위해 고유 종목 코드 리스트 추출
        const uniqueSymbols = [...new Set(activeItems.map(item => item.symbol))];

        // 각 종목별 현재가 캐싱 맵
        const priceMap = new Map();

        for (const symbol of uniqueSymbols) {
            try {
                const fresh = await fetchStockPrice(symbol);
                if (fresh && fresh.price) {
                    priceMap.set(symbol, fresh.price);
                    console.log(`📈 [Monitor] ${symbol} 현재 시세 동기화: ₩${fresh.price.toLocaleString()}`);
                }
                await sleep(150); // 한투 API 초당 호출 횟수 제한(TPS) 방지
            } catch (err) {
                console.error(`❌ [Monitor] 종목코드 ${symbol} 시세 조회 실패:`, err.message);
            }
        }

        // 손절선 돌파 여부 확인 및 처리
        for (const item of activeItems) {
            const currentPrice = priceMap.get(item.symbol);
            if (!currentPrice) continue;

            // 현재가가 손절가 이하로 하락했는지 판정
            if (currentPrice <= item.stopLossPrice) {
                console.log(`🚨 [Monitor] 손절 돌파 감지! 종목: ${item.name}(${item.symbol}), 설정가: ₩${item.stopLossPrice.toLocaleString()} >= 현재가: ₩${currentPrice.toLocaleString()}`);
                
                // 알림 발송
                const success = await sendStopLossAlert(item.phone, item.name, currentPrice, item.stopLossPrice);
                
                if (success) {
                    // 알림 발송 처리 플래그 업데이트 (중복 발송 방지)
                    await updateAlertStatus(item.id, true);
                    console.log(`📬 [Monitor] ${item.userId}님께 경보 전송 완료 및 알림 플래그 차단 처리`);
                }
            }
        }
    } catch (e) {
        console.error('❌ [Monitor] 손절 감시 프로세스 실행 중 오류 발생:', e.message);
    }
};
