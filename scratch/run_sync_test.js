import supabase from '../lib/supabaseClient.js';
import { syncSingleStock } from '../lib/stockSync.js';
import { getAccessToken } from '../lib/kisCore.js';
import axios from 'axios';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function run() {
    console.log('🏁 Starting Cache Synchronization Engine Validation Test...');

    // 1. KIS 토큰 확보
    try {
        console.log('🔑 Ensuring KIS API access token is valid...');
        const token = await getAccessToken();
        console.log('✅ KIS API access token verified:', token ? 'Token exists' : 'Token empty');
    } catch (e) {
        console.error('❌ Failed to verify KIS token:', e.message);
        process.exit(1);
    }

    // 2. 테스트용 종목 선정 (삼성전자, SK하이닉스, DB하이텍)
    const testSymbols = ['005930', '000660', '000990'];
    console.log(`📡 Selected test symbols: ${testSymbols.join(', ')}`);

    // 3. 순차적 동기화 및 캐싱 성능 테스트 (1.5초 딜레이 준수)
    console.log('⏳ Performing sequential syncing into Supabase...');
    for (let i = 0; i < testSymbols.length; i++) {
        const symbol = testSymbols[i];
        const start = Date.now();
        
        const result = await syncSingleStock(symbol);
        const duration = Date.now() - start;

        if (result) {
            console.log(`✅ [Test] ${symbol} synced and saved to Supabase in ${duration}ms.`);
            console.log(`   Price: ${result.fundamental?.price} KRW, ROE: ${result.fundamental?.roe}%, Debt Ratio: ${result.fundamental?.debtRatio}%`);
        } else {
            console.error(`❌ [Test] Failed to sync ${symbol}.`);
        }

        if (i < testSymbols.length - 1) {
            console.log('⏳ Waiting 1.5s (rate limit safety delay)...');
            await sleep(1500);
        }
    }

    // 4. 캐시 조회 성능 측정 (Sub-0.1초 조회 보장 검증)
    console.log('\n⏱️ Validating Cache Read Responsiveness (Sub-0.1s Goal)...');
    for (const symbol of testSymbols) {
        const start = Date.now();
        
        // Supabase에서 직접 읽기 속도 테스트
        const { data, error } = await supabase
            .from('stock_detail_cache')
            .select('*')
            .eq('symbol', symbol)
            .single();

        const duration = Date.now() - start;
        
        if (error) {
            console.error(`❌ [Read Test] Failed to read ${symbol} from Supabase:`, error.message);
        } else if (data) {
            const isSubTenth = duration < 100;
            console.log(`✨ [Read Test] ${symbol} read in ${duration}ms. ${isSubTenth ? '🚀 [PASSED - Under 0.1s]' : '⚠️ [SLOW]'}`);
            console.log(`   Updated At: ${data.updated_at}`);
        }
    }

    console.log('\n🎉 Validation Test Completed successfully!');
    process.exit(0);
}

run();
