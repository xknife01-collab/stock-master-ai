import dotenv from 'dotenv';
dotenv.config();
import supabase from '../lib/supabaseClient.js';
import { getAccessToken, KIS_BASE_URL, getKisHeaders, kisRequest } from '../lib/kisCore.js';

async function main() {
    console.log("🚀 [0.1초 진단] 삼성전자 실시간 분석 및 AI 퀀트 엔진 스캔 기동...");

    try {
        // 1. Supabase 캐시 데이터 조회
        const { data: cacheData, error } = await supabase
            .from('stock_detail_cache')
            .select('*')
            .eq('symbol', '005930')
            .single();

        if (error || !cacheData) {
            console.error("❌ DB 캐시 조회 실패:", error?.message);
            return;
        }

        // 2. 최신 AI 신호 캐시 조회
        const { data: signalCache } = await supabase
            .from('ai_cache')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1);

        const latestSignal = signalCache && signalCache[0] ? signalCache[0].pulse?.data : null;

        const fund = cacheData.fundamental || {};
        const adv = cacheData.advanced || {};
        const tech = adv.technical || {};
        const inv = adv.investor || {};

        console.log("\n======================================================================");
        console.log(`👑 [퀀트 엔진 진단] 삼성전자 (005930) 실시간 데이터 시트`);
        console.log("======================================================================");
        console.log(`- 현재가: ${fund.price?.toLocaleString()} 원 (${fund.change}% 전일대비)`);
        console.log(`- 기본 밸류에이션: PER ${fund.per}배 | PBR ${fund.pbr}배 | ROE ${fund.roe}%`);
        console.log(`- 기술 지표: 5일 이격도 ${adv.disparity5}% | 20일 이격도 ${adv.disparity20}% | RSI ${tech.rsi}`);
        console.log(`- 수급 지표: 체결강도 ${adv.strength}% | 체결강도 가속도 ${adv.strengthAcceleration || 0}%p`);
        console.log(`- 외국인 수급: 당일 ${inv.foreign1D?.toLocaleString()} 주 | 5일 누적 ${inv.foreign5D?.toLocaleString()} 주`);
        console.log(`- 기관 수급: 당일 ${inv.organ1D?.toLocaleString()} 주 | 5일 누적 ${inv.organ5D?.toLocaleString()} 주`);
        console.log(`- 개인 수급: 당일 ${inv.personal1D?.toLocaleString()} 주 | 5일 누적 ${inv.personal5D?.toLocaleString()} 주`);
        console.log("----------------------------------------------------------------------");

        // 3. VETO 여부 분석
        console.log("⚙️ [VETO 필터 진단]");
        const vetoReasons = [];
        
        // 부채비율
        const debt = parseFloat(fund.debtRatio || '0');
        if (debt >= 200) {
            vetoReasons.push(`[재무] 부채비율 과다 (${debt}% >= 200%)`);
        } else {
            console.log(`✅ [재무] 부채비율 안전 (${debt}% < 200%)`);
        }

        // ROE
        const roe = parseFloat(fund.roe || '0');
        if (roe < 0) {
            vetoReasons.push(`[재무] ROE 적자 (${roe}% < 0%)`);
        } else {
            console.log(`✅ [재무] ROE 안정성 확보 (${roe}% >= 0%)`);
        }

        // PBR
        const pbr = parseFloat(fund.pbr || '0');
        if (pbr >= 15) {
            vetoReasons.push(`[재무] 고PBR 버블 (${pbr}배 >= 15배)`);
        } else {
            console.log(`✅ [재무] PBR 안전 마진 수준 (${pbr}배 < 15배)`);
        }

        // 체결강도
        const str = parseFloat(adv.strength || '0');
        const isStrengthVetoOverridden = (adv.strengthAcceleration || 0) >= 5 && str >= 90;
        if (str < 95 && !isStrengthVetoOverridden) {
            vetoReasons.push(`[수급] 체결강도 약세 (${str}% < 95%)`);
        } else {
            console.log(`✅ [수급] 체결강도 적격 수준 (${str}% >= 95%)`);
        }

        // 수급 데드크로스
        const isPrevBuying = inv.foreign5D > 0 || inv.organ5D > 0;
        const isTodaySelling = inv.foreign1D < 0 || inv.organ1D < 0;
        const isPriceDropping = parseFloat(fund.change || '0') < 0;
        const isSupplyDeathCross = isPrevBuying && isTodaySelling && isPriceDropping;
        if (isSupplyDeathCross) {
            vetoReasons.push(`[수급] 수급 하락 변곡점(Death Cross) 감지`);
        } else {
            console.log(`✅ [수급] 하락 변곡점(Death Cross) 없음`);
        }

        // 이격도 및 RSI
        const disp5 = parseFloat(adv.disparity5 || '100');
        const rsiVal = parseFloat(tech.rsi || '0');
        if (disp5 > 108) {
            vetoReasons.push(`[기술] 5일 이격도 과열 (${disp5}% > 108%)`);
        } else {
            console.log(`✅ [기술] 이격도 안정화 구간 (${disp5}% <= 108%)`);
        }

        if (rsiVal >= 78) {
            vetoReasons.push(`[기술] RSI 과매수 과열 (${rsiVal} >= 78)`);
        } else {
            console.log(`✅ [기술] RSI 지표 과열 없음 (${rsiVal} < 78)`);
        }

        const isVetoed = vetoReasons.length > 0;
        console.log(`\n🚨 [최종 VETO 판정] ${isVetoed ? '❌ VETO (매수 보류)' : '🟢 VETO 통과 (진입 적격)'}`);
        if (isVetoed) {
            console.log(`  👉 배제 사유: ${vetoReasons.join(' | ')}`);
        } else {
            console.log(`  👉 삼성전자는 현재 어떠한 재무적/기술적 VETO 룰에도 저촉되지 않습니다.`);
        }

        // 4. 시장 스트레스 현황
        console.log("\n🌐 [시장 스트레스 현황]");
        if (latestSignal && latestSignal.marketStress) {
            const stress = latestSignal.marketStress;
            console.log(`- 시장 스트레스 지수: ${stress.score}점 (Safe Mode: ${stress.safeMode ? 'ON (방어적 대응)' : 'OFF (공격적 대응)'})`);
            console.log(`- 코스피 등락: ${stress.kospi?.changePercent}% (Z-Score: ${stress.kospi?.zScore})`);
            console.log(`- 코스닥 등락: ${stress.kosdaq?.changePercent}% (Z-Score: ${stress.kosdaq?.zScore})`);
            console.log(`- 환율: ${stress.usd?.rate}원`);
        } else {
            console.log("- 시장 스트레스 지수: N/A");
        }

        console.log("======================================================================\n");
    } catch (e) {
        console.error("❌ 분석 오류 발생:", e);
    }
}

main();
