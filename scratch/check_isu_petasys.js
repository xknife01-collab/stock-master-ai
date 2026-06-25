import supabase from '../lib/supabaseClient.js';
import fs from 'fs';

async function checkIsuPetasys() {
  console.log('🔍 Checking status of 이수페타시스 (007660)...');
  
  // 1. Check supply_cache.json
  if (fs.existsSync('./supply_cache.json')) {
    const supply = JSON.parse(fs.readFileSync('./supply_cache.json', 'utf8'));
    const isinGainer = (supply.dashboard_fluctuation_rank || []).some(s => s.s === '007660');
    const isinVolume = (supply.dashboard_volume_rank || []).some(s => s.s === '007660');
    console.log(`- In supply_cache (Fluctuation Rank): ${isinGainer}`);
    console.log(`- In supply_cache (Volume Rank): ${isinVolume}`);
  }
  
  // 2. Check Supabase stock_detail_cache
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('stock_detail_cache')
        .select('*')
        .eq('symbol', '007660')
        .maybeSingle();
        
      if (error) {
        console.error('Supabase query error:', error.message);
        return;
      }
      
      if (!data) {
        console.log('❌ 이수페타시스 (007660) has NO record in Supabase stock_detail_cache!');
        return;
      }
      
      console.log('\n📊 Supabase Cache Details:');
      console.log(`- Name: ${data.fundamental?.name}`);
      console.log(`- Price: ${data.fundamental?.price}`);
      console.log(`- Sector: ${data.fundamental?.sector}`);
      console.log(`- Updated At: ${data.updated_at}`);
      
      if (data.advanced) {
        console.log(`- Strength (체결강도): ${data.advanced.strength}`);
        console.log(`- Disparity20 (20일 이격도): ${data.advanced.disparity20}`);
        console.log(`- ShortRatio (공매도비중): ${data.advanced.shortRatio}`);
        console.log(`- ROE: ${data.fundamental?.roe}, PBR: ${data.fundamental?.pbr}`);
        console.log(`- isSupplyDeathCross: ${data.advanced.isSupplyDeathCross}`);
        console.log(`- isSupplyGoldenCross: ${data.advanced.isSupplyGoldenCross}`);
      }
      
      // Let's run a quick diagnostic simulation of the scoring and VETO filters for Isu Petasys
      // using the logic in routes/aiApi.js
      // We can inspect the scores and veto reasons
      console.log('\n🔧 Running filter diagnostics...');
      
      const parseNum = (val, fallback = 0) => {
        if (val === undefined || val === null || val === '-') return fallback;
        const parsed = parseFloat(val);
        return isNaN(parsed) ? fallback : parsed;
      };
      
      const strength = parseNum(data.advanced?.strength, 100);
      const disparity20 = parseNum(data.advanced?.disparity20, 100);
      const roe = parseNum(data.fundamental?.roe, 0);
      const pbr = parseNum(data.fundamental?.pbr, 0);
      const debtRatio = parseNum(data.fundamental?.debtRatio, 0);
      const isSupplyDeathCross = data.advanced?.isSupplyDeathCross || false;
      const isAntHell = false; // We can check if isAntHell is computed
      
      // Calculate scores
      let strengthScore = 0;
      if (strength >= 120) strengthScore = 30;
      else if (strength >= 105) strengthScore = 20;
      else if (strength >= 95) strengthScore = 10;
      else if (strength < 80) strengthScore = -15;
      
      let disparityScore = 0;
      if (disparity20 >= 108) disparityScore = -15; // Overheated
      else if (disparity20 >= 103) disparityScore = 0;
      else if (disparity20 >= 95) disparityScore = 15; // Golden zone
      else if (disparity20 >= 90) disparityScore = 8;
      else disparityScore = -10; // Downward trend
      
      // Check VETOes
      const vetoReasons = [];
      if (pbr > 15) vetoReasons.push(`고PBR 버블 (${pbr}배)`);
      if (roe < 0) vetoReasons.push(`ROE 적자 (${roe}%)`);
      if (debtRatio > 350) vetoReasons.push(`고부채 위험 (${debtRatio}%)`);
      if (disparity20 > 108) vetoReasons.push(`이격과열 경고 (20일 이격도: ${disparity20}%)`);
      
      console.log(`- Calculated Strength Score: ${strengthScore}`);
      console.log(`- Calculated Disparity Score: ${disparityScore}`);
      console.log(`- Veto reasons triggered:`, vetoReasons.length > 0 ? vetoReasons : 'None');
      
    } catch (err) {
      console.error(err.message);
    }
  }
}

checkIsuPetasys();
