import { syncSingleStock } from '../lib/stockSync.js';
import supabase from '../lib/supabaseClient.js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    const symbol = '005930'; // Samsung Electronics
    
    // First, let's delete the existing 1D cache for today to trigger full paging
    console.log('Clearing cached 1D chart for Samsung...');
    const { data: ext } = await supabase
        .from('stock_detail_cache')
        .select('fundamental, advanced')
        .eq('symbol', symbol)
        .maybeSingle();

    if (ext) {
        const advanced = ext.advanced || {};
        if (advanced.chartHistory) {
            advanced.chartHistory['1D'] = [];
        }
        await supabase
            .from('stock_detail_cache')
            .update({ advanced, updated_at: new Date().toISOString() })
            .eq('symbol', symbol);
    }

    console.log('\n--- Running syncSingleStock in foreground (isBackground = false) ---');
    const result = await syncSingleStock(symbol, false);
    
    if (result && result.advanced && result.advanced.chartHistory) {
        const chart1D = result.advanced.chartHistory['1D'] || [];
        console.log('Sync result 1D chart count:', chart1D.length);
        if (chart1D.length > 0) {
            console.log('Earliest point:', chart1D[0]);
            console.log('Latest point:', chart1D[chart1D.length - 1]);
            // Print a sample of points
            console.log('Sample points (first 5):', chart1D.slice(0, 5));
            console.log('Sample points (last 5):', chart1D.slice(-5));
        }
    } else {
        console.error('Sync failed or no chart data returned');
    }
    
    process.exit(0);
}

run();
