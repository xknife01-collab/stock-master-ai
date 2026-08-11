import supabase from '../lib/supabaseClient.js';
import dotenv from 'dotenv';
dotenv.config();

async function inspectSchema() {
  if (!supabase) {
    console.error('No supabase client');
    return;
  }
  const { data, error } = await supabase
    .from('stock_detail_cache')
    .select('fundamental')
    .eq('symbol', '005930')
    .single();

  if (error) {
    console.error('Error fetching stock_detail_cache:', error.message);
  } else {
    console.log('stock_detail_cache output for 005930:');
    console.log('price:', data?.fundamental?.price);
    console.log('advanced keys:', Object.keys(data?.fundamental?.advanced || {}));
    console.log('advanced.strength:', data?.fundamental?.advanced?.strength);
    console.log('fundamental keys:', Object.keys(data?.fundamental || {}));
  }
}

inspectSchema();
