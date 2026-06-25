import dotenv from 'dotenv';
dotenv.config();
import supabase from '../lib/supabaseClient.js';

async function check() {
    // 1. Query by symbol 005930 (Samsung Electronics)
    const { data: data1, error: error1 } = await supabase
        .from('stock_detail_cache')
        .select('*')
        .eq('symbol', '005930')
        .maybeSingle();

    console.log("=== Symbol 005930 ===");
    if (error1) console.error(error1);
    else console.log(data1 ? JSON.stringify(data1.fundamental, null, 2) : "Not found");

    // 2. Query where fundamental name contains "삼성"
    const { data: data2, error: error2 } = await supabase
        .from('stock_detail_cache')
        .select('*');

    console.log("\n=== Checking all Cached Stocks with name containing Samsung or price around 362500 ===");
    if (error2) console.error(error2);
    else if (data2) {
        data2.forEach(row => {
            const name = row.fundamental?.name || "";
            const price = row.fundamental?.price || 0;
            if (name.includes("삼성") || Math.abs(price - 362500) < 50000) {
                console.log(`Symbol: ${row.symbol}, Name: ${name}, Price: ${price}`);
            }
        });
    }
}
check();
