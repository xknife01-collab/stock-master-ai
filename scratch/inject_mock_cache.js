import dotenv from 'dotenv';
dotenv.config();
import supabase from '../lib/supabaseClient.js';

async function injectMockCache() {
    console.log("Injecting mock cache for Samsung Electronics (005930)...");
    
    // Fetch current row first
    const { data: row, error } = await supabase
        .from('stock_detail_cache')
        .select('*')
        .eq('symbol', '005930')
        .single();
        
    if (error) {
        console.error("Failed to fetch current row:", error.message);
        return;
    }
    
    const advanced = row.advanced || {};
    
    // Override with beautiful foreign/institution buying pattern
    advanced.investor = {
        foreign: 500000,
        organ: 300000,
        personal: -800000,
        foreign5D: 2000000,
        organ5D: 1500000,
        personal5D: -3500000,
        foreign20D: 5000000,
        organ20D: 3500000,
        personal20D: -8500000,
        foreignConsecutiveDays: 3,
        foreignConsecutiveVolume: 1500000,
        organConsecutiveDays: 2,
        organConsecutiveVolume: 800000,
        personalConsecutiveDays: 0,
        personalConsecutiveVolume: 0
    };
    
    advanced.intraday = {
        foreign: 300000,
        organ: 200000,
        personal: -500000
    };
    
    advanced.strength = 135;
    advanced.shortRatio = 1.5;
    
    // 70 minutes of chart history showing a steady rise
    const chart1D = [];
    for (let i = 0; i < 70; i++) {
        chart1D.push({ price: 340000 + i * 100 });
    }
    advanced.chartHistory = advanced.chartHistory || {};
    advanced.chartHistory['1D'] = chart1D;
    
    const { error: updateError } = await supabase
        .from('stock_detail_cache')
        .update({
            advanced: advanced,
            updated_at: new Date().toISOString()
        })
        .eq('symbol', '005930');
        
    if (updateError) {
        console.error("Failed to update cache row:", updateError.message);
    } else {
        console.log("Successfully injected mock cache for 005930!");
    }
}

injectMockCache();
