import axios from 'axios';
import * as cheerio from 'cheerio';
import supabase from '../lib/supabaseClient.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchMarketCapRankings(sosok, maxPages) {
    const stocks = [];
    for (let page = 1; page <= maxPages; page++) {
        try {
            console.log(`📡 Fetching sosok=${sosok} page=${page}...`);
            const url = `https://finance.naver.com/sise/sise_market_sum.naver?sosok=${sosok}&page=${page}`;
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                },
                responseType: 'arraybuffer'
            });

            const decoder = new TextDecoder('euc-kr');
            const html = decoder.decode(response.data);
            const $ = cheerio.load(html);

            $('a.tltle').each((i, el) => {
                const name = $(el).text().trim();
                const href = $(el).attr('href');
                const codeMatch = href.match(/code=(\d{6})/);
                if (codeMatch && name) {
                    stocks.push({ name, code: codeMatch[1] });
                }
            });

            await sleep(500);
        } catch (e) {
            console.error(`❌ Error fetching page ${page}:`, e.message);
        }
    }
    return stocks;
}

async function run() {
    if (!supabase) {
        console.error('❌ Supabase client not initialized. Check your .env file.');
        process.exit(1);
    }

    console.log('🏁 Starting seeder for KOSPI 200 + KOSDAQ 150...');
    
    // KOSPI: sosok=0 (fetch 4 pages = 200 stocks)
    const kospiStocks = await fetchMarketCapRankings(0, 4);
    console.log(`✅ Fetched ${kospiStocks.length} KOSPI stocks.`);

    // KOSDAQ: sosok=1 (fetch 3 pages = 150 stocks)
    const kosdaqStocks = await fetchMarketCapRankings(1, 3);
    console.log(`✅ Fetched ${kosdaqStocks.length} KOSDAQ stocks.`);

    const allStocks = [...kospiStocks, ...kosdaqStocks];
    console.log(`📊 Total unique stocks fetched: ${allStocks.length}`);

    console.log('💾 Seeding to Supabase stock_master_map...');
    
    let successCount = 0;
    for (const stock of allStocks) {
        try {
            const cleanedName = stock.name.replace(/\s+/g, '');
            const { error } = await supabase
                .from('stock_master_map')
                .upsert({ name: cleanedName, code: stock.code }, { onConflict: 'name' });

            if (error) {
                console.error(`❌ Failed to upsert ${stock.name} (${stock.code}):`, error.message);
            } else {
                successCount++;
                if (successCount % 50 === 0) {
                    console.log(`Progress: ${successCount}/${allStocks.length} upserted.`);
                }
            }
        } catch (e) {
            console.error(`Exception upserting ${stock.name}:`, e.message);
        }
    }

    console.log(`🎉 Seeding complete. Successfully upserted ${successCount}/${allStocks.length} stocks.`);
    process.exit(0);
}

run();
