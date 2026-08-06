import dotenv from 'dotenv';
import supabase from '../lib/supabaseClient.js';

dotenv.config();

async function checkDatabaseIntegrity() {
    console.log('⚡ [DB Integrity Check] Fetching all cached stock details from Supabase...');
    const { data: stocks, error } = await supabase
        .from('stock_detail_cache')
        .select('symbol, name:fundamental->name, updated_at, advanced');

    if (error) {
        console.error('❌ Failed to fetch stock details:', error.message);
        return;
    }

    console.log(`📊 Total stocks found in DB: ${stocks.length}`);

    const missingInvestor = [];
    const missingTechnical = [];
    const missingDailyHistory = [];
    const contaminatedInvestor = [];
    const fullyHealthy = [];

    for (const stock of stocks) {
        const adv = stock.advanced || {};
        const investor = adv.investor;
        const technical = adv.technical;
        const dailyHistory = investor?.dailyHistory;

        let hasIssue = false;

        if (!investor) {
            missingInvestor.push(stock);
            hasIssue = true;
        } else if (investor.foreign1D === 0 && investor.organ1D === 0 && investor.personal1D === 0) {
            contaminatedInvestor.push(stock);
            hasIssue = true;
        }

        if (!technical) {
            missingTechnical.push(stock);
            hasIssue = true;
        }

        if (!dailyHistory || dailyHistory.length === 0) {
            missingDailyHistory.push(stock);
            hasIssue = true;
        }

        if (!hasIssue) {
            fullyHealthy.push(stock);
        }
    }

    console.log('\n=== INTEGRITY REPORT ===');
    console.log(`✅ Fully Healthy Stocks: ${fullyHealthy.length}`);
    console.log(`❌ Missing Investor Data: ${missingInvestor.length}`);
    console.log(`❌ Contaminated/Dummy Investor Data (0,0,0): ${contaminatedInvestor.length}`);
    console.log(`❌ Missing Technical Indicators: ${missingTechnical.length}`);
    console.log(`❌ Missing Daily History: ${missingDailyHistory.length}`);

    if (missingInvestor.length > 0) {
        console.log('\n--- Sample of Missing Investor Data ---');
        missingInvestor.slice(0, 10).forEach(s => console.log(`- ${s.name} (${s.symbol}) - Updated: ${s.updated_at}`));
    }

    if (contaminatedInvestor.length > 0) {
        console.log('\n--- Sample of Contaminated/Dummy Investor Data ---');
        contaminatedInvestor.slice(0, 10).forEach(s => console.log(`- ${s.name} (${s.symbol}) - Updated: ${s.updated_at}`));
    }

    if (missingTechnical.length > 0) {
        console.log('\n--- Sample of Missing Technical Indicators ---');
        missingTechnical.slice(0, 10).forEach(s => console.log(`- ${s.name} (${s.symbol}) - Updated: ${s.updated_at}`));
    }

    if (missingDailyHistory.length > 0) {
        console.log('\n--- Sample of Missing Daily History ---');
        missingDailyHistory.slice(0, 10).forEach(s => console.log(`- ${s.name} (${s.symbol}) - Updated: ${s.updated_at}`));
    }
}

checkDatabaseIntegrity();
