import dotenv from 'dotenv';
dotenv.config();

import { fetchStockMemberTrend, fetchLargeTradeInflow, fetchStockFullDetailFromKIS } from '../lib/kisCore.js';

(async () => {
    try {
        const testSymbol = '005930'; // 삼성전자
        console.log(`📡 [Test] Fetching Real-time Member Trend for ${testSymbol}...`);
        const memberTrend = await fetchStockMemberTrend(testSymbol);
        console.log('Result (MemberTrend):', JSON.stringify(memberTrend, null, 2));

        console.log(`📡 [Test] Fetching Large Trade Inflow for ${testSymbol}...`);
        const largeTrade = await fetchLargeTradeInflow(testSymbol);
        console.log('Result (LargeTrade):', JSON.stringify(largeTrade, null, 2));

        console.log(`📡 [Test] Fetching Full Stock Detail for ${testSymbol}...`);
        const fullDetail = await fetchStockFullDetailFromKIS(testSymbol);
        console.log('Result (FullDetail -> advanced.memberTrend):', JSON.stringify(fullDetail.advanced.memberTrend, null, 2));
        console.log('Result (FullDetail -> advanced.largeTrade):', JSON.stringify(fullDetail.advanced.largeTrade, null, 2));
        
        console.log('✅ [Test] All momentum indicator tests completed successfully!');
    } catch (err) {
        console.error('❌ [Test] Failed with error:', err);
    }
})();
