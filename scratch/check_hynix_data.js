import supabase from '../lib/supabaseClient.js';

async function checkHynixData() {
  console.log('🔍 [SK Hynix Data Diagnosis] Querying Supabase for 000660...');
  
  if (!supabase) {
    console.error('❌ Supabase client not initialized.');
    return;
  }

  try {
    const { data, error } = await supabase
      .from('stock_detail_cache')
      .select('*')
      .eq('symbol', '000660')
      .single();

    if (error) {
      console.error('❌ Failed to fetch SK Hynix data:', error.message);
      return;
    }

    if (!data) {
      console.log('⚠️ No cache found for 000660 in Supabase.');
      return;
    }

    console.log(`\n========================================`);
    console.log(`📊 [SK하이닉스 상태 분석]`);
    console.log(`- 종목명: SK하이닉스 (000660)`);
    console.log(`- 최종 갱신: ${data.updated_at}`);
    
    const adv = data.advanced || {};
    console.log(`- 현재가: ${adv.price || 'N/A'}원`);
    console.log(`- 전일대비: ${adv.change || 'N/A'}%`);
    console.log(`- 5일 이격도: ${adv.disparity5 || 'N/A'}%`);
    console.log(`- 20일 이격도: ${adv.disparity20 || 'N/A'}%`);
    console.log(`- 체결강도: ${adv.strength || 'N/A'}%`);
    console.log(`- RSI: ${adv.rsi || 'N/A'}`);
    
    const inv1D = adv.investor1D || {};
    console.log(`- 당일 수급 (1D):`);
    console.log(`  * 외국인: ${inv1D.foreign?.toLocaleString() || 0} 주`);
    console.log(`  * 기관: ${inv1D.organ?.toLocaleString() || 0} 주`);
    console.log(`  * 개인: ${inv1D.personal?.toLocaleString() || 0} 주`);

    const changePct = parseFloat(adv.change || '0');
    const isPrevBuying = adv.investor5D ? (adv.investor5D.foreign > 0 || adv.investor5D.organ > 0) : false;
    const isTodaySelling = inv1D.foreign < 0 || inv1D.organ < 0;
    const isPriceDropping = changePct < 0;
    const isSupplyDeathCross = isPrevBuying && isTodaySelling && isPriceDropping;

    console.log(`- 하락 변곡점 여부 (isSupplyDeathCross): ${isSupplyDeathCross}`);
    console.log(`========================================`);

  } catch (err) {
    console.error('❌ Exception during diagnosis:', err.message);
  }
}

checkHynixData();
