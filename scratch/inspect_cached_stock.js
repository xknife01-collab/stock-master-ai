import supabase from '../lib/supabaseClient.js';
import dotenv from 'dotenv';
dotenv.config();

async function inspect(symbol) {
    console.log(`\n🔍 Inspecting Supabase Cache for ${symbol}...`);
    const { data, error } = await supabase
        .from('stock_detail_cache')
        .select('*')
        .eq('symbol', symbol)
        .single();
    
    if (error || !data) {
        console.error(`❌ Cache record not found for ${symbol}:`, error?.message);
        return;
    }
    
    console.log(`\n--- [BASIC INFO] ---`);
    console.log(`Symbol: ${data.symbol}`);
    console.log(`Updated At: ${data.updated_at}`);
    
    const fund = data.fundamental || {};
    const adv = data.advanced || {};
    
    console.log(`\n--- [FUNDAMENTALS] ---`);
    console.log(`Price: ${fund.price} (${typeof fund.price})`);
    console.log(`PER: ${fund.per} (${typeof fund.per})`);
    console.log(`PBR: ${fund.pbr} (${typeof fund.pbr})`);
    console.log(`ROE: ${fund.roe} (${typeof fund.roe})`);
    console.log(`Debt Ratio: ${fund.debtRatio} (${typeof fund.debtRatio})`);
    console.log(`Yield: ${fund.yield} (${typeof fund.yield})`);
    console.log(`Sector: ${fund.sector} (${typeof fund.sector})`);
    console.log(`Finance Count: ${fund.finance ? fund.finance.length : 0}`);
    if (fund.finance) {
        console.log(`Finance Data:`, fund.finance);
    }
    
    console.log(`\n--- [ADVANCED / QUANT METRICS] ---`);
    console.log(`Strength: ${adv.strength} (${typeof adv.strength})`);
    console.log(`Disparity 5: ${adv.disparity5} (${typeof adv.disparity5})`);
    console.log(`Disparity 20: ${adv.disparity20} (${typeof adv.disparity20})`);
    console.log(`Short Ratio: ${adv.shortRatio} (${typeof adv.shortRatio})`);
    console.log(`Credit Balance: ${adv.creditBalance} (${typeof adv.creditBalance})`);
    console.log(`ATR: ${adv.atr} (${typeof adv.atr})`);
    console.log(`ATR %: ${adv.atrPercent} (${typeof adv.atrPercent})`);
    console.log(`Transaction Value: ${adv.transactionValue} (${typeof adv.transactionValue})`);
    console.log(`Prev Transaction Value: ${adv.prevTransactionValue} (${typeof adv.prevTransactionValue})`);
    console.log(`Volume Rate: ${adv.volumeRate} (${typeof adv.volumeRate})`);
    
    console.log(`\n--- [TECHNICAL INDICATORS] ---`);
    if (adv.technical) {
        console.log(`RSI: ${adv.technical.rsi} (${typeof adv.technical.rsi})`);
        console.log(`MA 5: ${adv.technical.ma5} (${typeof adv.technical.ma5})`);
        console.log(`MA 20: ${adv.technical.ma20} (${typeof adv.technical.ma20})`);
        console.log(`MA 60: ${adv.technical.ma60} (${typeof adv.technical.ma60})`);
        console.log(`MA Alignment: ${adv.technical.maAlignment}`);
        console.log(`Bollinger Bands:`, adv.technical.bollinger);
    } else {
        console.log(`❌ Technical indicators object is MISSING!`);
    }
    
    console.log(`\n--- [CHART HISTORY] ---`);
    if (adv.chartHistory) {
        console.log(`Ranges cached: ${Object.keys(adv.chartHistory).join(', ')}`);
    } else {
        console.log(`❌ Chart history object is MISSING!`);
    }
}

async function run() {
    // Let's inspect SK Hynix (000660) which we synchronized using the real KIS API
    await inspect('000660');
    process.exit(0);
}

run();
