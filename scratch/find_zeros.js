import supabase from '../lib/supabaseClient.js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    console.log("Querying stock_detail_cache...");
    const { data: stocks, error } = await supabase
        .from('stock_detail_cache')
        .select('symbol, fundamental, advanced, updated_at');
    
    if (error) {
        console.error("Error querying:", error.message);
        return;
    }
    
    console.log(`Total cached stocks: ${stocks.length}`);
    
    const zeroStrength = [];
    const zeroTxVal = [];
    const lowStrength = [];
    
    stocks.forEach(s => {
        const name = s.fundamental?.name || s.symbol;
        const strength = s.advanced?.strength;
        const txVal = s.advanced?.transactionValue;
        
        const strNum = parseFloat(strength);
        const txValNum = parseFloat(txVal);
        
        if (strength === '0' || strength === 0 || strength === '0.00' || strNum === 0) {
            zeroStrength.push({ symbol: s.symbol, name, strength, updated_at: s.updated_at });
        } else if (strNum < 10) { // strength < 10%
            lowStrength.push({ symbol: s.symbol, name, strength, updated_at: s.updated_at });
        }
        
        if (txVal === 0 || txVal === '0' || txValNum === 0) {
            zeroTxVal.push({ symbol: s.symbol, name, txVal, updated_at: s.updated_at });
        }
    });
    
    console.log("----------------------------------------");
    console.log(`Stocks with Strength = 0 (${zeroStrength.length}):`);
    zeroStrength.slice(0, 10).forEach(x => console.log(`- ${x.name} (${x.symbol}): ${x.strength} (Updated: ${x.updated_at})`));
    if (zeroStrength.length > 10) console.log("...");
    
    console.log("----------------------------------------");
    console.log(`Stocks with Strength < 10% (${lowStrength.length}):`);
    lowStrength.slice(0, 10).forEach(x => console.log(`- ${x.name} (${x.symbol}): ${x.strength} (Updated: ${x.updated_at})`));
    if (lowStrength.length > 10) console.log("...");
    
    console.log("----------------------------------------");
    console.log(`Stocks with Transaction Value = 0 (${zeroTxVal.length}):`);
    zeroTxVal.slice(0, 10).forEach(x => console.log(`- ${x.name} (${x.symbol}): ${x.txVal} (Updated: ${x.updated_at})`));
    if (zeroTxVal.length > 10) console.log("...");
    console.log("----------------------------------------");
}

run();
