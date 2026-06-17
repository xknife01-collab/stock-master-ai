import dotenv from 'dotenv';
dotenv.config();
import supabase from '../lib/supabaseClient.js';

async function clearCache() {
    try {
        console.log('Clearing Supabase cache for symbol: 000270 (Kia)...');
        const { data, error } = await supabase
            .from('stock_detail_cache')
            .delete()
            .eq('symbol', '000270');
            
        if (error) {
            console.error('Failed to clear cache:', error.message);
        } else {
            console.log('Successfully cleared cache for 000270!');
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
    process.exit(0);
}

clearCache();
