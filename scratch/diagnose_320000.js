import supabase from '../lib/supabaseClient.js';
import dotenv from 'dotenv';
dotenv.config();

const parseNum = (val, fallback = 0) => {
    if (val === undefined || val === null || val === '-') return fallback;
    const parsed = parseFloat(val);
    return isNaN(parsed) ? fallback : parsed;
};

async function run() {
    const { data: row, error } = await supabase
        .from('stock_detail_cache')
        .select('*')
        .eq('symbol', '320000')
        .single();
        
    if (error) {
        console.error("Failed to fetch:", error.message);
        return;
    }

    const c = { name: row.fundamental?.name || '한울반도체', code: row.symbol, change: row.fundamental?.change || '0' };
    const m = {
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

    console.log("Mocked candidate metrics:", m);

    // Let's run the exact VETO logic
    const forceRecommend = false; // matching what's in local scope
    const isSafe = false;
    
    let isVetoed = false;
    let vetoReason = '';

    const minStrengthRequired = forceRecommend ? 90 : (isSafe ? 100 : 95);
    console.log("parseFloat(m.strength):", parseFloat(m.strength || 100));
    console.log("minStrengthRequired:", minStrengthRequired);
    if (parseFloat(m.strength || 100) < minStrengthRequired) {
        isVetoed = true;
        vetoReason = `체결강도 약세 감지 (체결강도: ${m.strength}% < 기준: ${minStrengthRequired}%)`;
    }

    console.log("VETO result:", { isVetoed, vetoReason });
    process.exit(0);
}

run();
