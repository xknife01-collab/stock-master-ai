import dotenv from 'dotenv';
import path from 'path';
import supabase from '../lib/supabaseClient.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

async function checkKiaVeto() {
  console.log("Checking Kia (000270) VETO criteria in Supabase...");
  
  const { data, error } = await supabase
    .from('stock_detail_cache')
    .select('*')
    .eq('symbol', '000270')
    .maybeSingle();

  if (error || !data) {
    console.error("No cached data found for Kia in Supabase!");
    return;
  }

  const fund = data.fundamental || {};
  const adv = data.advanced || {};
  
  console.log("\n--- BASIC METRICS ---");
  console.log(`Name: ${fund.name}`);
  console.log(`Price: ${fund.price}`);
  console.log(`Sector: ${fund.sector}`);
  console.log(`ROE: ${fund.roe}`);
  console.log(`PBR: ${fund.pbr}`);
  console.log(`Debt Ratio: ${fund.debtRatio}`);
  console.log(`Strength: ${adv.strength}`);
  console.log(`Disparity 5: ${adv.disparity5}`);
  console.log(`Disparity 20: ${adv.disparity20}`);
  console.log(`Short Ratio: ${adv.shortRatio}`);
  console.log(`Credit Balance (신용융자): ${adv.creditBalance}`);
  console.log(`Transaction Value (거래대금): ${adv.transactionValue}`);
  console.log(`Market Cap: ${adv.marketCap} 억원`);
  
  // Simulate Pre-Veto Rules
  console.log("\n--- PRE-VETO CHECK ---");
  const forceRecommend = false;
  const txVal = parseFloat(adv.transactionValue) || 0;
  const strVal = parseFloat(adv.strength) || 0;
  const credBal = parseFloat(adv.creditBalance) || 0;
  const marketCapEok = parseFloat(adv.marketCap) || 0;
  
  if (!forceRecommend && credBal > 6) {
    console.log(`🔴 VETO: 신용잔고율 과다 (${credBal}% > 6%)`);
  } else {
    console.log(`🟢 PASS: 신용잔고율 (${credBal}%)`);
  }
  
  if (!forceRecommend && (txVal === 0 || strVal === 0 || strVal === 100)) {
    console.log(`🔴 VETO: 데이터 불완전 (거래대금: ${txVal}, 체결강도: ${strVal}%)`);
  } else {
    console.log(`🟢 PASS: 데이터 존재 (거래대금: ${txVal}, 체결강도: ${strVal}%)`);
  }
  
  if (!forceRecommend && txVal < 1000000000) {
    console.log(`🔴 VETO: 저유동성 (거래대금: ${txVal} < 10억원)`);
  } else {
    console.log(`🟢 PASS: 유동성 (거래대금: ${txVal})`);
  }
  
  if (!forceRecommend && marketCapEok > 0 && marketCapEok < 700) {
    console.log(`🔴 VETO: 소형주 (시가총액: ${marketCapEok}억 < 700억)`);
  } else {
    console.log(`🟢 PASS: 시가총액 (${marketCapEok}억)`);
  }
  
  // Simulate Hard VETO Rules
  console.log("\n--- HARD VETO CHECK ---");
  const vetoReasons = [];
  
  // 1. Min Strength
  const isCoreSemiconductor = false;
  const isUptrend = true; // Assume true for test
  let minStrengthRequired = 95; // isSafe = false, forceRecommend = false
  if (isCoreSemiconductor || isUptrend) {
    minStrengthRequired = 80;
  }
  if (strVal < minStrengthRequired) {
    vetoReasons.push(`체결강도 약세 감지 (${strVal}% < ${minStrengthRequired}%)`);
  }
  
  // 2. dumping / clean buying
  const inv1D = adv.investor1D || { foreign: 0, organ: 0, personal: 0 };
  const isDumping = inv1D.foreign < 0 && inv1D.organ < 0;
  console.log("Investor 1D:", inv1D);
  
  const disp5 = parseFloat(adv.disparity5) || 100;
  const disp20 = parseFloat(adv.disparity20) || 100;
  
  if (isDumping && disp5 >= 101.5) {
    vetoReasons.push(`고이격 상태에서 외인/기관 순매도(설거지) 감지 (5일 이격도: ${disp5}%, 외인: ${inv1D.foreign}, 기관: ${inv1D.organ})`);
  }
  
  if (inv1D.foreign < 0 && inv1D.organ < 0 && inv1D.personal > 0) {
    vetoReasons.push(`개미지옥 감지 (외인/기관 쌍끌이 순매도 및 개인 순매수 집중: 외인 ${inv1D.foreign}주, 기관 ${inv1D.organ}주, 개인 ${inv1D.personal}주)`);
  }
  
  // 3. 5-day slope down
  if (disp5 < 100) {
    // There is a line: vetoReasons.push(`[기술적 분석] 5일선 아래 흘러내림 종목 제외 (5일 이격도: ${disp5}% < 100%, 반등 요건 미충족)`);
    vetoReasons.push(`[기술적 분석] 5일선 아래 흘러내림 종목 제외 (5일 이격도: ${disp5}% < 100%, 반등 요건 미충족)`);
  }
  
  console.log("VETO Reasons simulated:", vetoReasons);
}

checkKiaVeto();
