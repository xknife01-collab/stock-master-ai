import supabase from '../lib/supabaseClient.js';

async function checkSupabase() {
  console.log('🔍 [Supabase Diagnosis] Starting connection and data validation...');

  if (!supabase) {
    console.error('❌ Supabase client is not initialized. Please check SUPABASE_URL and SUPABASE_KEY in .env.');
    return;
  }

  try {
    // 1. Check connection & stock_master_map count
    const { count: masterCount, error: masterError } = await supabase
      .from('stock_master_map')
      .select('*', { count: 'exact', head: true });

    if (masterError) {
      console.error('❌ Failed to query stock_master_map:', masterError.message);
    } else {
      console.log(`✅ stock_master_map (종목 마스터 매핑): 총 ${masterCount}개 종목 적재됨.`);
    }

    // 2. Check stock_detail_cache count and latest records
    const { data: detailData, error: detailError, count: detailCount } = await supabase
      .from('stock_detail_cache')
      .select('symbol, updated_at', { count: 'exact' })
      .order('updated_at', { ascending: false })
      .limit(5);

    if (detailError) {
      console.error('❌ Failed to query stock_detail_cache:', detailError.message);
    } else {
      console.log(`✅ stock_detail_cache (종목 상세 분석 캐시): 총 ${detailCount}개 종목 적재됨.`);
      console.log('📌 최근 업데이트된 5개 종목 및 시각:');
      detailData.forEach(item => {
        console.log(`   - 종목코드: ${item.symbol} (업데이트: ${item.updated_at})`);
      });
    }

    // 3. Check portfolios count
    const { count: portfolioCount, error: portfolioError } = await supabase
      .from('portfolios')
      .select('*', { count: 'exact', head: true });

    if (portfolioError) {
      console.error('❌ Failed to query portfolios:', portfolioError.message);
    } else {
      console.log(`✅ portfolios (사용자 포트폴리오): 총 ${portfolioCount}개 레코드 존재.`);
    }

    // 4. Check profiles count
    const { count: profileCount, error: profileError } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    if (profileError) {
      console.error('❌ Failed to query profiles:', profileError.message);
    } else {
      console.log(`✅ profiles (사용자 프로필): 총 ${profileCount}개 계정 존재.`);
    }

  } catch (err) {
    console.error('❌ Error executing diagnosis:', err.message);
  }
}

checkSupabase();
