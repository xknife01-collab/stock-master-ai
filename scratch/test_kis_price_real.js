import dotenv from 'dotenv';
dotenv.config();
import { fetchStockPrice } from '../lib/kisCore.js';

async function run() {
    const samsung = await fetchStockPrice('005930');
    const hynix = await fetchStockPrice('000660');
    console.log('Samsung Electronics (005930) fresh quote:', samsung);
    console.log('SK Hynix (000660) fresh quote:', hynix);
}

run().catch(console.error);
