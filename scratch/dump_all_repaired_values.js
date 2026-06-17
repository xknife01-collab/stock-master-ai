import supabase from '../lib/supabaseClient.js';
import dotenv from 'dotenv';
dotenv.config();

async function dumpRepairedValues() {
    console.log("📡 Supabase stock_detail_cache에서 적재된 실시간 데이터 조회 중...");
    
    const { data: cacheRows, error } = await supabase
        .from('stock_detail_cache')
        .select('*');

    if (error) {
        console.error("❌ Supabase 조회 실패:", error.message);
        return;
    }

    console.log(`📊 현재 Supabase 캐시에 적재된 총 종목 수: ${cacheRows.length}`);

    // Print headers
    console.log("=".repeat(155));
    console.log(
        String("종목코드").padEnd(10) +
        String("현재가").padStart(10) +
        String("체결강도").padStart(10) +
        String("이격도5D").padStart(10) +
        String("이격도20D").padStart(10) +
        String("공매도%").padStart(10) +
        String("신용%").padStart(10) +
        String("ATR").padStart(10) +
        String("거래대금(억)").padStart(12) +
        String("전일거래대금(억)").padStart(15) +
        String("거래량증가%").padStart(12) +
        String("외인5D(억)").padStart(12) +
        String("기관5D(억)").padStart(12) +
        String("개인5D(억)").padStart(12)
    );
    console.log("=".repeat(155));

    // Show target symbols and recently updated ones first
    const targetSymbols = ['005930', '000660', '000270', '005380', '403870'];
    
    // Sort so target symbols come first, then others
    cacheRows.sort((a, b) => {
        const aTarget = targetSymbols.includes(a.symbol);
        const bTarget = targetSymbols.includes(b.symbol);
        if (aTarget && !bTarget) return -1;
        if (!aTarget && bTarget) return 1;
        return 0;
    });

    let printedCount = 0;
    for (const row of cacheRows) {
        const fund = row.fundamental || {};
        const adv = row.advanced || {};
        const investor = adv.investor || {};

        // Skip printing if it's not target and still has unpopulated/missing fields (since repair is in progress)
        const hasAtr = adv.atr !== undefined && adv.atr !== null;
        const hasPrevTr = adv.prevTransactionValue !== undefined && adv.prevTransactionValue !== null;
        if (!targetSymbols.includes(row.symbol) && (!hasAtr || !hasPrevTr || adv.prevTransactionValue === 0)) {
            continue;
        }

        const price = fund.price || 0;
        const strength = adv.strength || '-';
        const disp5 = adv.disparity5 || '-';
        const disp20 = adv.disparity20 || '-';
        const short = adv.shortRatio || '0';
        const credit = adv.creditBalance || '0';
        const atr = adv.atr || 0;
        const trVal = Math.round((adv.transactionValue || 0) / 100000000); // 억 단위
        const prevTrVal = Math.round((adv.prevTransactionValue || 0) / 100000000); // 억 단위
        const volRate = adv.volumeRate || 0;

        const f5 = investor.foreignMoney5D !== undefined ? investor.foreignMoney5D : '-';
        const o5 = investor.organMoney5D !== undefined ? investor.organMoney5D : '-';
        const p5 = investor.personalMoney5D !== undefined ? investor.personalMoney5D : '-';

        console.log(
            String(row.symbol).padEnd(10) +
            String(price.toLocaleString()).padStart(10) +
            String(strength).padStart(10) +
            String(disp5).padStart(10) +
            String(disp20).padStart(10) +
            String(short).padStart(10) +
            String(credit).padStart(10) +
            String(atr.toLocaleString()).padStart(10) +
            String(trVal.toLocaleString()).padStart(12) +
            String(prevTrVal.toLocaleString()).padStart(15) +
            String(volRate.toLocaleString()).padStart(12) +
            String(f5).padStart(12) +
            String(o5).padStart(12) +
            String(p5).padStart(12)
        );

        printedCount++;
        if (printedCount >= 30) {
            break;
        }
    }
    console.log("=".repeat(155));
    console.log(`💡 위 리스트는 Supabase에 적재된 실시간 데이터 값들의 스냅샷입니다. (복구 완료된 대표 종목들 위주 출력)`);
    process.exit(0);
}

dumpRepairedValues();
