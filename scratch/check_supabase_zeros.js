import supabase from '../lib/supabaseClient.js';
import dotenv from 'dotenv';
dotenv.config();

async function checkZeros() {
    console.log("🔍 Querying stock_detail_cache from Supabase...");
    const { data: stocks, error } = await supabase
        .from('stock_detail_cache')
        .select('*');

    if (error) {
        console.error("❌ Failed to query stock_detail_cache:", error.message);
        return;
    }

    console.log(`✅ Loaded ${stocks.length} cached stocks from Supabase.`);

    let zeroCount = 0;
    const targetSymbols = ['005930', '000660', '000270', '005380', '403870'];

    stocks.forEach(stock => {
        const isTarget = targetSymbols.includes(stock.symbol);
        const nameLabel = isTarget ? `⭐ [TARGET] ${stock.symbol}` : `[OTHER] ${stock.symbol}`;
        
        const fund = stock.fundamental || {};
        const adv = stock.advanced || {};

        const issues = [];

        // Check for 0 or invalid price
        if (fund.price === 0 || fund.price === '0' || !fund.price || fund.price === '-') {
            issues.push(`fundamental.price is ${fund.price}`);
        }

        // Check for 0 or invalid transactionValue
        if (adv.transactionValue === 0 || adv.transactionValue === '0' || !adv.transactionValue || adv.transactionValue === '-') {
            issues.push(`advanced.transactionValue is ${adv.transactionValue}`);
        }

        // Check for 0 or invalid prevTransactionValue
        if (adv.prevTransactionValue === 0 || adv.prevTransactionValue === '0' || !adv.prevTransactionValue || adv.prevTransactionValue === '-') {
            issues.push(`advanced.prevTransactionValue is ${adv.prevTransactionValue}`);
        }

        // Check for 0 volumeRate
        if (adv.volumeRate === 0 || adv.volumeRate === '0' || !adv.volumeRate || adv.volumeRate === '-') {
            issues.push(`advanced.volumeRate is ${adv.volumeRate}`);
        }

        // Check for 0 disparity
        if (adv.disparity5 === 0 || adv.disparity5 === '0' || adv.disparity5 === '-') {
            issues.push(`advanced.disparity5 is ${adv.disparity5}`);
        }
        if (adv.disparity20 === 0 || adv.disparity20 === '0' || adv.disparity20 === '-') {
            issues.push(`advanced.disparity20 is ${adv.disparity20}`);
        }

        // Check for 0 ATR (for targets, ATR must be valid)
        if (isTarget && (adv.atr === 0 || !adv.atr || adv.atr === '-')) {
            issues.push(`advanced.atr is ${adv.atr}`);
        }

        if (issues.length > 0) {
            console.log(`⚠️ ${nameLabel} has potential zero/invalid fields:`);
            issues.forEach(iss => console.log(`   - ${iss}`));
            zeroCount++;
        } else {
            if (isTarget) {
                console.log(`🟢 ${nameLabel} has fully populated valid real data: Price: ${fund.price}, TransactionValue: ${adv.transactionValue}, VolumeRate: ${adv.volumeRate}%, ATR: ${adv.atr}`);
            }
        }
    });

    console.log(`\n📊 Inspection complete. Found potential issues in ${zeroCount}/${stocks.length} cached stocks.`);
}

checkZeros();
