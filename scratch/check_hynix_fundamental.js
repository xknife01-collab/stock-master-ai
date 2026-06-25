import supabase from '../lib/supabaseClient.js';

async function checkHynixFundamental() {
  console.log('🔍 Querying full database row for SK Hynix...');
  if (!supabase) return;
  try {
    const { data, error } = await supabase
      .from('stock_detail_cache')
      .select('*')
      .eq('symbol', '000660')
      .single();

    if (error) {
      console.error('Error:', error.message);
      return;
    }
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Exception:', err.message);
  }
}

checkHynixFundamental();
