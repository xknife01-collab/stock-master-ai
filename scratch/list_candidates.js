import supabase from '../lib/supabaseClient.js';
import dotenv from 'dotenv';
dotenv.config();

const candidateSymbols = [
    '047040', '049120', '014910', '005930', '000660', '042700', '007660', '403870',
    '089030', '058470', '000990', '352820', '067310', '005380', '000270', '207940',
    '068270', '105560', '055550', '196170'
];

async function run() {
    console.log("🔍 Inspecting candidate pool stocks from Supabase...");
    const { data: rows, error } = await supabase
        .from('stock_detail_cache')
        .select('*')
        .in('symbol', candidateSymbols);
        
    if (error) {
        console.error("❌ Failed to fetch:", error.message);
        return;
    }
    
    console.log(`Loaded ${rows.length} rows from candidate pool.`);
    
    for (const row of rows) {
        const symbol = row.symbol;
        const name = row.fundamental?.name || symbol;
        const fund = row.fundamental || {};
        const adv = row.advanced || {};
        
        const price = parseFloat(fund.price || 0);
        const roe = parseFloat(fund.roe || 0);
        const debtRatio = parseFloat(fund.debtRatio || 0);
        const pbr = parseFloat(fund.pbr || 0);
        
        const strength = parseFloat(adv.strength || 0);
        const disparity20 = parseFloat(adv.disparity20 || 0);
        const shortRatio = parseFloat(adv.shortRatio || 0);
        const creditBalance = parseFloat(adv.creditBalance || 0);
        
        console.log(`\n📌 [${name} (${symbol})]`);
        console.log(`  Price: ${price}, ROE: ${roe}%, DebtRatio: ${debtRatio}%, PBR: ${pbr}`);
        console.log(`  Strength: ${strength}%, Disparity20: ${disparity20}%, ShortRatio: ${shortRatio}%, Credit: ${creditBalance}%`);
        
        // VETO Checks
        const isVetoedByCredit = creditBalance > 6;
        const isVetoedByRoe = roe < 0;
        const isVetoedByDebt = debtRatio >= 200;
        const pbrThreshold = roe >= 20 ? 20 : 15;
        const isVetoedByPbr = pbr >= pbrThreshold;
        
        const vetoes = [];
        if (isVetoedByCredit) vetoes.push('Credit > 6%');
        if (isVetoedByRoe) vetoes.push('ROE < 0');
        if (isVetoedByDebt) vetoes.push('Debt >= 200%');
        if (isVetoedByPbr) vetoes.push(`PBR >= ${pbrThreshold}`);
        
        if (vetoes.length > 0) {
            console.log(`  ❌ VETOED: ${vetoes.join(', ')}`);
        } else {
            // Check filters
            const passedShort = strength >= 90 && disparity20 < 107 && shortRatio < 10;
            const passedLong = strength >= 85 && disparity20 < 105 && shortRatio < 10;
            
            console.log(`  Short Term Filter: ${passedShort ? '✅ PASS' : '❌ FAIL'} (Strength: ${strength} >= 90, Disp20: ${disparity20} < 107, Short: ${shortRatio} < 10)`);
            console.log(`  Long Term Filter: ${passedLong ? '✅ PASS' : '❌ FAIL'} (Strength: ${strength} >= 85, Disp20: ${disparity20} < 105, Short: ${shortRatio} < 10)`);
        }
    }
    process.exit(0);
}

run();
