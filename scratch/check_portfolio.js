import supabase from '../lib/supabaseClient.js';

async function run() {
  const { data, error } = await supabase.from('portfolios').select('*');
  if (error) {
    console.error('Error fetching portfolios:', error.message);
  } else {
    console.log('Portfolios entries:', JSON.stringify(data, null, 2));
  }
}
run();
