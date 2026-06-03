import axios from 'axios';

async function performLiveProductionTest() {
  const normalUrl = 'https://stock-master-ai.onrender.com/api/ai/pulse';
  const forceUrl = 'https://stock-master-ai.onrender.com/api/ai/pulse?force=true';
  
  console.log(`📡 [Test 1] Testing Normal Pulse (Market Closed)...`);
  console.log(`➡️ URL: ${normalUrl}`);
  try {
    const start = Date.now();
    const res = await axios.get(normalUrl, { timeout: 15000 });
    const duration = Date.now() - start;
    console.log(`✅ [Test 1 Success] Responded in ${duration}ms!`);
    
    if (res.data && res.data.data) {
      const p = res.data.data;
      console.log(`   - Theme returned: ${p.theme}`);
      console.log(`   - TOP PICK: ${p.stock} (${p.symbol}) - Price: ₩${Number(p.price).toLocaleString()}`);
      if (Array.isArray(p.shortTermPicks) && p.shortTermPicks.length > 0) {
        console.log(`   - First Short Term Pick: ${p.shortTermPicks[0].n} (${p.shortTermPicks[0].c})`);
      }
    } else {
      console.log(`   ⚠️ Strange response structure:`, JSON.stringify(res.data));
    }
  } catch (err) {
    console.error(`   ❌ [Test 1 Failed]:`, err.message);
  }

  console.log(`\n📡 [Test 2] Testing Forced Pulse (Simulating full AI run)...`);
  console.log(`➡️ URL: ${forceUrl}`);
  console.log(`⌛ Full AI run takes around 20-30 seconds. Starting...`);
  try {
    const start = Date.now();
    const res = await axios.get(forceUrl, { timeout: 90000 });
    const duration = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`✅ [Test 2 Success] Responded in ${duration} seconds!`);
    
    if (res.data && res.data.data) {
      const p = res.data.data;
      console.log(`   🤖 --- AI Recommendation ---`);
      console.log(`   - Theme: ${p.theme}`);
      console.log(`   - TOP PICK: ${p.stock} (${p.symbol}) - Price: ₩${Number(p.price || 0).toLocaleString()}`);
      console.log(`   - Target Price: ₩${Number(p.targetPrice || p.tp || 0).toLocaleString()}`);
      console.log(`   - Stop Loss: ₩${Number(p.stopLoss || p.sl || 0).toLocaleString()}`);
      
      if (Array.isArray(p.shortTermPicks)) {
        console.log(`   - Short term picks:`);
        p.shortTermPicks.forEach((pick, i) => {
          console.log(`     ${i+1}. ${pick.n} (${pick.c}) - Price: ₩${Number(pick.p).toLocaleString()}`);
        });
      }
    } else {
      console.log(`   ⚠️ Strange response structure:`, JSON.stringify(res.data));
    }
  } catch (err) {
    console.error(`   ❌ [Test 2 Failed]:`, err.message);
  }
}

performLiveProductionTest();
