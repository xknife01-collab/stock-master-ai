import fs from 'fs';
import path from 'path';

function checkSupplyCache() {
  const cachePath = './supply_cache.json';
  if (!fs.existsSync(cachePath)) {
    console.log('❌ supply_cache.json does not exist.');
    return;
  }
  
  try {
    const data = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    console.log('📊 [Supply Cache Keys]:', Object.keys(data));
    console.log('- dashboard_fluctuation_rank items:', data.dashboard_fluctuation_rank?.length || 0);
    console.log('- dashboard_volume_rank items:', data.dashboard_volume_rank?.length || 0);
    console.log('- ai_supply exists:', !!data.ai_supply);
    if (data.ai_supply) {
      console.log('  * ai_supply length:', data.ai_supply.length);
    }
  } catch (err) {
    console.error('❌ Failed to parse supply_cache.json:', err.message);
  }
}

checkSupplyCache();
