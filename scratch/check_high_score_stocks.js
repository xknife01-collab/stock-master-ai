import { executeHourlyPulse } from '../routes/aiApi.js';
import supabase from '../lib/supabaseClient.js';

async function checkHighScores() {
  console.log('🔍 Checking database for stocks that score over 60...');
  
  if (!supabase) {
    console.log('Supabase client missing');
    return;
  }
  
  try {
    // We can fetch all rows in stock_detail_cache
    const { data: cachedRows, error } = await supabase
      .from('stock_detail_cache')
      .select('*');
      
    if (error) {
      console.error(error.message);
      return;
    }
    
    console.log(`Loaded ${cachedRows?.length || 0} rows from cache.`);
    
    // Now let's calculate the total score using the exact logic from routes/aiApi.js
    // Let's import the scoring function from aiApi.js or copy it.
    // In routes/aiApi.js, the totalScore is calculated inside startDashboardSync or stockSync.
    // Actually, each row has a pre-calculated score inside the database or in dashboard_cache?
    // Wait! Let's check what scores are written in the database or cached in dashboard_cache!
    
  } catch (err) {
    console.error(err.message);
  }
}

// Let's check what is in dashboard_cache.json
import fs from 'fs';
function checkDashboardCache() {
  const path = './dashboard_cache.json';
  if (!fs.existsSync(path)) {
    console.log('No dashboard_cache.json found');
    return;
  }
  
  const cache = JSON.parse(fs.readFileSync(path, 'utf8'));
  const list = cache.candidates || [];
  console.log(`\n📊 [Dashboard Cache Candidates Count: ${list.length}]`);
  
  const highScores = list.filter(c => c.score > 60);
  console.log(`🔥 Candidates with score > 60 on the dashboard:`);
  highScores.forEach((c, idx) => {
    console.log(`[${idx+1}] ${c.name} (${c.code}): Score = ${c.score}, isVetoed = ${c.isVetoed}, vetoReason = ${c.vetoReason}`);
  });
}

checkDashboardCache();
