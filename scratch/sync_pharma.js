import dotenv from 'dotenv';
dotenv.config();
import supabase from '../lib/supabaseClient.js';
import { syncSingleStock } from '../lib/stockSync.js';

(async () => {
    const symbol = '090430'; // Amorepacific
    try {
        console.log("1. Simulating contaminated cache in Supabase for symbol:", symbol);
        
        // 기존 캐시 로드
        const { data: cached } = await supabase
            .from('stock_detail_cache')
            .select('*')
            .eq('symbol', symbol)
            .single();

        if (!cached) {
            console.error("❌ No cached data found to simulate contamination.");
            process.exit(1);
        }

        // 수급 데이터를 0 0 0 및 오늘자 기준(정산 전)으로 조작
        const contaminatedInvestor = {
            ...cached.advanced.investor,
            foreign1D: 0,
            organ1D: 0,
            personal1D: 0,
            isTodayData: true,
            isRealtime: false,
            dailyHistory: [
                { date: "20260707", foreign: 0, organ: 0, personal: 0 },
                ...(cached.advanced.investor.dailyHistory || []).filter(h => h.date !== "20260707")
            ]
        };

        const updatedAdvanced = {
            ...cached.advanced,
            investor: contaminatedInvestor
        };

        // DB에 조작된 오염 캐시 적재
        await supabase
            .from('stock_detail_cache')
            .update({
                advanced: updatedAdvanced,
                updated_at: new Date().toISOString() // 오늘 날짜로 업데이트
            })
            .eq('symbol', symbol);

        console.log("ℹ️ Contamination simulation complete! Cached is now (0,0,0) and isTodayData = true.");

        console.log("\n2. Triggering normal sync (force=false)...");
        const result = await syncSingleStock(symbol, false, false);
        console.log("ℹ️ Normal sync execution finished.");

        console.log("\n3. Verification: Reading healed cache from Supabase...");
        const { data: healed } = await supabase
            .from('stock_detail_cache')
            .select('*')
            .eq('symbol', symbol)
            .single();

        console.log("=== Healed Cache State ===");
        console.log("Updated At:", healed.updated_at);
        console.log("isRealtime:", healed.advanced?.investor?.isRealtime);
        console.log("isTodayData:", healed.advanced?.investor?.isTodayData);
        console.log("1D net trades (F/O/P):", 
            healed.advanced?.investor?.foreign1D,
            healed.advanced?.investor?.organ1D,
            healed.advanced?.investor?.personal1D
        );
        console.log("First history row:", healed.advanced?.investor?.dailyHistory?.[0]);

        if (healed.advanced?.investor?.foreign1D !== 0 || healed.advanced?.investor?.isRealtime === true) {
            console.log("\n🎉 SUCCESS! Self-healing successfully restored data!");
        } else {
            console.error("\n❌ FAILURE! Cache remains contaminated.");
        }

    } catch (err) {
        console.error("Test error:", err.message);
    }
    process.exit(0);
})();
