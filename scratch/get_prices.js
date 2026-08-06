import dotenv from 'dotenv';
import path from 'path';
import supabase from '../lib/supabaseClient.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

async function getDetails(symbol) {
  const { data } = await supabase
    .from('stock_detail_cache')
    .select('*')
    .eq('symbol', symbol)
    .single();
  if (data) {
    console.log(`\n=== SYMBOL: ${symbol} ===`);
    console.log(`Name: ${data.fundamental?.name}`);
    console.log(`Price: ${data.fundamental?.price}`);
    console.log(`Change: ${data.fundamental?.change}`);
    console.log(`Sector: ${data.fundamental?.sector}`);
    console.log(`PER: ${data.fundamental?.per}`);
    console.log(`PBR: ${data.fundamental?.pbr}`);
    console.log(`ROE: ${data.fundamental?.roe}`);
    console.log(`DebtRatio: ${data.fundamental?.debtRatio}`);
  } else {
    console.log(`No data found for ${symbol}`);
  }
}

async function run() {
  await getDetails('071050');
  await getDetails('055550');
}
run();
