import supabase from '../lib/supabaseClient.js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const symbols = [
    '196170', // 알테오젠
    '000660', // SK하이닉스
    '105560', // KB금융
    '000990', // DB하이텍
    '055550', // 신한지주
    '058470', // 리노공업
    '042700', // 한미반도체
    '068270', // 셀트리온
    '000270'  // 기아
];

async function run() {
    const { data: rows, error } = await supabase
        .from('stock_detail_cache')
        .select('*')
        .in('symbol', symbols);

    if (error) {
        console.error("Error fetching data:", error.message);
        return;
    }

    fs.writeFileSync('veto_metrics.json', JSON.stringify(rows, null, 2), 'utf8');
    console.log("Successfully wrote veto_metrics.json directly.");
    process.exit(0);
}

run();
