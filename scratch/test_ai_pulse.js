import axios from 'axios';

async function testLiveAiPulse() {
  const url = 'https://stock-master-ai.onrender.com/api/ai/pulse?force=true';
  console.log(`🚀 [Test] Triggering live AI Pulse with force option: ${url}`);
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
      console.log(`💰 Current Price: ₩${Number(p.price).toLocaleString()} | Target: ₩${Number(p.targetPrice).toLocaleString()}`);
      console.log(`🛡️ Stop Loss: ₩${Number(p.stopLoss).toLocaleString()}`);
      
      if (Array.isArray(p.shortTermPicks)) {
        console.log(`\n⚡ Short-term Recommendations:`);
        p.shortTermPicks.forEach((pick, i) => {
          console.log(`   ${i+1}. ${pick.n} (${pick.c}) - Price: ₩${Number(pick.p).toLocaleString()}`);
        });
      }
      
      if (Array.isArray(p.longTermPicks)) {
        console.log(`\n💎 Long-term Recommendations:`);
        p.longTermPicks.forEach((pick, i) => {
          console.log(`   ${i+1}. ${pick.n} (${pick.c}) - Price: ₩${Number(pick.p).toLocaleString()}`);
        });
      }
      
      console.log(`\n💬 Fundamental analysis: ${p.fundamental}`);
    } else {
      console.log(`⚠️ Response returned successfully, but has different structure:`, JSON.stringify(res.data, null, 2));
    }
  } catch (err) {
    console.error(`\n❌ [Error] Failed to complete live AI Pulse:`, err.message);
    if (err.response) {
      console.error(`   Server Response Status:`, err.response.status);
      console.error(`   Server Response Data:`, JSON.stringify(err.response.data));
    }
  }
}

testLiveAiPulse();
