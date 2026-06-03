import axios from 'axios';
import { fetchStockInvestorTrend } from '../lib/kisCore.js';

async function check() {
    try {
        const res = await fetchStockInvestorTrend('000660');
        console.log("RAW SUMMARY KEYS:", Object.keys(res));
        console.log("STATS DATA:", res.stats);
    } catch (e) {
        console.error("Error:", e.message);
    }
}

check();
