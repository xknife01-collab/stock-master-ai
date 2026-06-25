import supabase from '../lib/supabaseClient.js';

async function checkSamsungData() {
  console.log('🔍 [Samsung Electronics Data Diagnosis] Querying Supabase for 005930...');
  
  if (!supabase) {
    console.error('❌ Supabase client not initialized.');
    return;
  }

  try {
    const { data, error } = await supabase
      .from('stock_detail_cache')
      .select('*')
      .eq('symbol', '005930')
      .single();

    if (error) {
      console.error('❌ Failed to fetch Samsung Electronics data:', error.message);
      return;
    }

    if (!data) {
      console.log('⚠️ No cache found for 005930 in Supabase.');
      return;
    }

    console.log(`\n========================================`);
    console.log(`📊 [기본 정보]`);
    console.log(`- 종목명: 삼성전자 (005930)`);
    console.log(`- 최종 갱신 (KST): ${new Date(data.updated_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
    
    const fund = data.fundamental || {};
    console.log(`- PER: ${fund.per || 'N/A'}`);
    console.log(`- PBR: ${fund.pbr || 'N/A'}`);
    console.log(`- ROE: ${fund.roe || 'N/A'}`);
    console.log(`- 배당수익률: ${fund.yield || 'N/A'}`);

    const adv = data.advanced || {};
    const tech = adv.technical || {};
    console.log(`\n📈 [실시간 가격 및 기술 지표]`);
    console.log(`- 현재가: ${fund.price || 'N/A'}원`);
    console.log(`- 전일대비: ${fund.change || 'N/A'}%`);
    console.log(`- 5일 이격도: ${adv.disparity5 || 'N/A'}%`);
    console.log(`- 20일 이격도: ${adv.disparity20 || 'N/A'}%`);
    console.log(`- 체결강도: ${adv.strength || 'N/A'}%`);
    console.log(`- 체결강도 가속도: ${adv.strengthAcceleration || 0}%p`);
    console.log(`- RSI: ${tech.rsi || 'N/A'}`);
    console.log(`- 이평선 정렬: ${tech.maAlignment || 'N/A'}`);

    console.log(`\n💼 [수급 현황]`);
    const inv = adv.investor || {};
    console.log(`- 당일 수급 (1D):`);
    console.log(`  * 외국인: ${inv.foreign1D?.toLocaleString() || 0} 주`);
    console.log(`  * 기관: ${inv.organ1D?.toLocaleString() || 0} 주`);
    console.log(`  * 개인: ${inv.personal1D?.toLocaleString() || 0} 주`);
    console.log(`- 5일 누적 수급 (5D):`);
    console.log(`  * 외국인: ${inv.foreign5D?.toLocaleString() || 0} 주`);
    console.log(`  * 기관: ${inv.organ5D?.toLocaleString() || 0} 주`);
    console.log(`  * 개인: ${inv.personal5D?.toLocaleString() || 0} 주`);

    // 수급 변곡점 판정 재현
    const changePct = parseFloat(fund.change || '0');
    const isPrevBuying = inv.foreign5D > 0 || inv.organ5D > 0;
    const isTodaySelling = inv.foreign1D < 0 || inv.organ1D < 0;
    const isPriceDropping = changePct < 0;
    const isSupplyDeathCross = isPrevBuying && isTodaySelling && isPriceDropping;

    console.log(`\n🔍 [수급 변곡점 수식 검증]`);
    console.log(`- 5일 누적 외인/기관 매수세 존재 여부 (isPrevBuying): ${isPrevBuying} (외인 5D: ${inv.foreign5D > 0}, 기관 5D: ${inv.organ5D > 0})`);
    console.log(`- 당일 외인/기관 순매도 전환 여부 (isTodaySelling): ${isTodaySelling} (외인 1D: ${inv.foreign1D < 0}, 기관 1D: ${inv.organ1D < 0})`);
    console.log(`- 당일 주가 하락 여부 (isPriceDropping): ${isPriceDropping} (변동률: ${changePct}%)`);
    console.log(`- 👉 하락 변곡점 (isSupplyDeathCross) 판정: ${isSupplyDeathCross ? '⚠️ 참 (Death Cross 감지됨)' : '🟢 거짓'}`);

    console.log(`========================================`);

  } catch (err) {
    console.error('❌ Exception during diagnosis:', err.message);
  }
}

checkSamsungData();
