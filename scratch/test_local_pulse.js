import axios from 'axios';

async function testLocalAiPulse() {
  const url = 'http://localhost:5000/api/ai/pulse?force=true';
  console.log(`🚀 [Test] Triggering LOCAL AI Pulse with force option: ${url}`);
  console.log(`⌛ AI Analysis takes about 20-40 seconds... Please stand by...`);
  
  try {
    const start = Date.now();
    const res = await axios.get(url, { timeout: 90000 });
    const duration = ((Date.now() - start) / 1000).toFixed(1);
    
    console.log(`\n✅ [Success] AI Pulse completed in ${duration} seconds!`);
    console.log(`📊 Status Code: ${res.status}`);
    
    if (res.data && res.data.data) {
      const p = res.data.data;
      console.log(`\n🤖 --- AI Recommendation Result ---`);
      console.log(`📈 Theme: ${p.theme} (${p.themeProb || '90%'})`);
      console.log(`🏆 TOP PICK Stock: ${p.stock} (${p.symbol})`);
      console.log(`💰 Current Price: ₩${Number(p.price || 0).toLocaleString()} | Target: ₩${Number(p.targetPrice || p.tp || 0).toLocaleString()}`);
      console.log(`🛡️ Stop Loss: ₩${Number(p.stopLoss || p.sl || 0).toLocaleString()}`);
      
      if (Array.isArray(p.shortTermPicks)) {
        console.log(`\n⚡ Short-term Recommendations (Total: ${p.shortTermPicks.length}):`);
        p.shortTermPicks.forEach((pick, i) => {
          console.log(`   ${i+1}. ${pick.n} (${pick.c}) - Price: ₩${Number(pick.p).toLocaleString()} | TP: ₩${Number(pick.tp).toLocaleString()} | SL: ₩${Number(pick.sl).toLocaleString()}`);
        });
      }
      
      if (Array.isArray(p.longTermPicks)) {
        console.log(`\n💎 Long-term Recommendations (Total: ${p.longTermPicks.length}):`);
        p.longTermPicks.forEach((pick, i) => {
          console.log(`   ${i+1}. ${pick.n} (${pick.c}) - Price: ₩${Number(pick.p).toLocaleString()} | TP: ₩${Number(pick.tp).toLocaleString()} | SL: ₩${Number(pick.sl).toLocaleString()}`);
        });
      }
      
      console.log(`\n💬 Fundamental analysis: ${p.fundamental}`);
      console.log(`💬 Macro review: ${p.macro}`);
      console.log(`💬 Risk Case: ${p.bearCase}`);
    } else {
      console.log(`⚠️ Response returned successfully, but has different structure:`, JSON.stringify(res.data, null, 2));
    }
  } catch (err) {
    console.error(`\n❌ [Error] Failed to complete local AI Pulse:`, err.message);
    if (err.response) {
      console.error(`   Server Response Status:`, err.response.status);
      console.error(`   Server Response Data:`, JSON.stringify(err.response.data));
    }
  }
}

testLocalAiPulse();
