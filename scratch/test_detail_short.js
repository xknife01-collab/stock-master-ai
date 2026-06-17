import dotenv from 'dotenv';
dotenv.config();
import { fetchStockFullDetailFromKIS } from '../lib/kisCore.js';

async function run() {
    try {
        console.log('Running fetchStockFullDetailFromKIS for 000270...');
        const res = await fetchStockFullDetailFromKIS('000270');
        console.log('Parsed advanced metrics:', res.advanced);
    } catch (e) {
        console.error('Error during test:', e);
    }
}

run();
