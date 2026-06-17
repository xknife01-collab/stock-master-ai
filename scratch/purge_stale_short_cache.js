import dotenv from 'dotenv';
dotenv.config();
import supabase from '../lib/supabaseClient.js';

async function purgeCache() {
    try {
        console.log('Purging stale detail cache records where shortRatio is "0.00"...');
        
        // Fetch all symbols to see what we have
        const { data: records, error: fetchErr } = await supabase
            .from('stock_detail_cache')
            .select('symbol, advanced');
            
        if (fetchErr) {
            throw fetchErr;
        }
        
        const staleSymbols = [];
        for (const row of (records || [])) {
            if (row.advanced && (row.advanced.shortRatio === '0.00' || row.advanced.shortRatio === 0)) {
                staleSymbols.push(row.symbol);
            }
        }
        
        console.log(`Found ${staleSymbols.length} stale cache records with "0.00" shortRatio.`);
        
        if (staleSymbols.length > 0) {
            const { error: deleteErr } = await supabase
                .from('stock_detail_cache')
                .delete()
                .in('symbol', staleSymbols);
                
            if (deleteErr) {
                console.error('Failed to delete stale cache:', deleteErr.message);
            } else {
                console.log(`Successfully purged cache for symbols: ${staleSymbols.join(', ')}`);
            }
        } else {
            console.log('No stale records found.');
        }
    } catch (e) {
        console.error('Error during purge:', e.message);
    }
    process.exit(0);
}

purgeCache();
