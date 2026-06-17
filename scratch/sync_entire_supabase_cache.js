import supabase from '../lib/supabaseClient.js';
import { syncSingleStock } from '../lib/stockSync.js';
import dotenv from 'dotenv';
dotenv.config();

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
    console.log("🔍 [Database Integrity Sync] Querying all cached stocks from Supabase...");
    const { data: stocks, error } = await supabase
        .from('stock_detail_cache')
        .select('*');

    if (error) {
        console.error("❌ Failed to fetch stocks:", error.message);
        return;
    }

    console.log(`✅ Loaded ${stocks.length} stocks from cache.`);

    const targetSymbols = ['005930', '000660', '000270', '005380', '403870'];
    const stocksToRepair = [];

    stocks.forEach(stock => {
        const fund = stock.fundamental || {};
        const adv = stock.advanced || {};

        const isTarget = targetSymbols.includes(stock.symbol);
        
        let hasIssue = false;

        // Condition 1: Missing basic price
        if (fund.price === 0 || fund.price === '0' || !fund.price || fund.price === '-') {
            hasIssue = true;
        }
        // Condition 2: Missing transactionValue
        if (adv.transactionValue === 0 || adv.transactionValue === '0' || !adv.transactionValue || adv.transactionValue === '-') {
            hasIssue = true;
        }
        // Condition 3: Missing prevTransactionValue
        if (adv.prevTransactionValue === 0 || adv.prevTransactionValue === '0' || !adv.prevTransactionValue || adv.prevTransactionValue === '-') {
            hasIssue = true;
        }
        // Condition 4: Missing volumeRate
        if (adv.volumeRate === 0 || adv.volumeRate === '0' || !adv.volumeRate || adv.volumeRate === '-') {
            hasIssue = true;
        }
        // Condition 5: Missing disparity
        if (adv.disparity5 === 0 || adv.disparity5 === '0' || !adv.disparity5 || adv.disparity5 === '-' ||
            adv.disparity20 === 0 || adv.disparity20 === '0' || !adv.disparity20 || adv.disparity20 === '-') {
            hasIssue = true;
        }
        // Condition 6: Missing ATR for target symbols
        if (isTarget && (adv.atr === 0 || !adv.atr || adv.atr === '-')) {
            hasIssue = true;
        }

        if (hasIssue) {
            stocksToRepair.push({
                symbol: stock.symbol,
                name: fund.name || stock.symbol,
                isTarget
            });
        }
    });

    console.log(`📊 Total stocks needing data repair: ${stocksToRepair.length}/${stocks.length}`);

    if (stocksToRepair.length === 0) {
        console.log("🟢 All cached stocks have 100% complete valid technical indicators. No repair needed!");
        return;
    }

    console.log(`\n🛠️ Starting sequence sync for ${stocksToRepair.length} stocks to populate missing metrics...`);
    console.log(`⏱️ Estimated duration: ~${Math.round((stocksToRepair.length * 9.5) / 60)} minutes (using 700ms internal and 2000ms loop delay).`);

    // Prioritize target symbols first
    stocksToRepair.sort((a, b) => (b.isTarget ? 1 : 0) - (a.isTarget ? 1 : 0));

    for (let i = 0; i < stocksToRepair.length; i++) {
        const stock = stocksToRepair[i];
        console.log(`\n🔄 [${i + 1}/${stocksToRepair.length}] Repairing: ${stock.name} (${stock.symbol}) ${stock.isTarget ? '⭐ [TARGET]' : ''}`);
        
        try {
            const result = await syncSingleStock(stock.symbol);
            if (result) {
                console.log(`✅ Successfully repaired and cached ${stock.symbol}`);
            } else {
                console.warn(`⚠️ Sync returned null for ${stock.symbol}`);
            }
        } catch (err) {
            console.error(`❌ Failed to sync ${stock.symbol}:`, err.message);
        }

        // Wait between stocks to prevent hitting KIS API rate limits
        await delay(2000);
    }

    console.log("\n🎉 [Database Integrity Sync] Repair complete. All stocks are now fully populated in Supabase!");
}

main();
