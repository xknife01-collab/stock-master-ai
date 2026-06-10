import React, { useState } from 'react';
import { Activity, ChartLine } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const AISignalSection = ({ aiSignal, aiHistory, onOpenPopup }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const sig = aiSignal?.data?.pulse?.data || aiSignal?.pulse?.data || aiSignal?.data || aiSignal?.prediction || aiSignal;

  const formatDateTime = (timeStr) => {
    try {
      const d = new Date(timeStr);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
      return `${mm}.${dd} ${time}`;
    } catch (e) {
      return timeStr;
    }
  };

  const formatPrice = (val) => {
    if (!val) return '';
    const clean = String(val).replace(/[^0-9]/g, '');
    return clean ? Number(clean).toLocaleString() + '원' : val;
  };

  return (
    <section className="mb-12 glass-card border-white/5 bg-gradient-to-b from-[#1a1f2b] to-[#141822] overflow-hidden">
      <div className="p-8 border-b border-white/5 bg-white/[0.01]">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center border border-blue-500/20">
              <Activity className="text-blue-400" size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-tighter italic">Multi-Agent AI Portfolio Signal</h2>
              <div className="text-[10px] text-white/30 font-black uppercase tracking-widest">Real-time Quant Analysis Engine</div>
            </div>
          </div>
          <div className="flex gap-4 items-center">
            {sig?.marketStress && (
              <div className={`px-3 py-1 bg-white/[0.02] rounded-xl border flex flex-col items-end ${sig.marketStress.safeMode ? 'border-red-500/30 bg-red-500/5' : 'border-green-500/20 bg-green-500/5'}`}>
                <div className="text-[9px] font-black uppercase tracking-wider opacity-60 flex items-center gap-1.5 text-white/70">
                  <span className={`w-1.5 h-1.5 rounded-full ${sig.marketStress.safeMode ? 'bg-red-500 animate-ping' : 'bg-green-400'}`}></span>
                  시장 매크로 스트레스
                </div>
                <div className={`text-xs font-black ${sig.marketStress.safeMode ? 'text-red-400' : 'text-green-400'}`}>
                  {sig.marketStress.score}점 ({sig.marketStress.safeMode ? '🚨 SAFE MODE' : '안정'})
                </div>
              </div>
            )}
            <div className="text-right">
              <div className="text-[10px] font-black text-white/30 uppercase mb-1">Last Update</div>
              <div className="text-xs font-mono font-black text-blue-400">{aiSignal?.time || '--:--'}</div>
            </div>
          </div>
        </div>
        
        {/* AI Reasoning Pipeline Description */}
        <div className="mb-10 p-5 bg-white/[0.02] border border-white/5 rounded-2xl">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1.5 h-4 bg-blue-500 rounded-full"></div>
            <h3 className="text-sm font-black text-white/70 uppercase tracking-widest">AI Reasoning Pipeline</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
            <div className="flex flex-col gap-2 p-3 bg-white/5 rounded-xl border border-white/5 relative z-10">
              <div className="text-[10px] font-black text-blue-400 uppercase tracking-tighter">01. Market Screening & Quant Engine</div>
              <p className="text-[11px] text-white/50 leading-tight">급등/거래/수급 종목 발굴 및 3대 핵심 퀀트 지표 계량 점수화 (상위 30개)</p>
            </div>
            <div className="flex flex-col gap-2 p-3 bg-white/5 rounded-xl border border-white/5 relative z-10">
              <div className="text-[10px] font-black text-purple-400 uppercase tracking-tighter">02. RAG Backtest Feedback</div>
              <p className="text-[11px] text-white/50 leading-tight">과거 추천 성적 백테스팅 리포트(오답노트) 동기화를 통한 AI 자가 보정</p>
            </div>
            <div className="flex flex-col gap-2 p-3 bg-white/5 rounded-xl border border-white/5 relative z-10">
              <div className="text-[10px] font-black text-green-400 uppercase tracking-tighter">03. Dual-Stage AI Veto Filter</div>
              <p className="text-[11px] text-white/50 leading-tight">1차 30개 후보 분석 및 VETO 룰 적용 후 2차 TOP PICK 심층 리스크 검증</p>
            </div>
            <div className="flex flex-col gap-2 p-3 bg-blue-500/10 rounded-xl border border-blue-500/20 relative z-10 shadow-[0_0_20px_rgba(59,130,246,0.1)]">
              <div className="text-[10px] font-black text-blue-300 uppercase tracking-tighter">04. Risk-Adjusted Execution</div>
              <p className="text-[11px] text-white/80 leading-tight font-medium">기술적 과열도와 숏 압박을 반영한 최적 목표가/손절가 및 투자 전략 제시</p>
            </div>
            
            {/* Connection Lines (Desktop Only) */}
            <div className="hidden md:block absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-y-1/2 z-0"></div>
          </div>
          <div className="mt-4 flex items-center justify-center gap-2">
            <span className="text-[9px] text-white/20 italic font-medium uppercase tracking-widest">Multi-Agent Reasoning Agent with Gemini Flash 1.5 & Vertex AI Fallback</span>
          </div>
        </div>

        {aiSignal && (aiSignal.data || aiSignal.pulse || aiSignal.prediction) ? (
          (() => {
            // Flexible data mapping to handle different backend nestings
            const sig = aiSignal.data?.pulse?.data || aiSignal.pulse?.data || aiSignal.data || aiSignal.prediction || aiSignal;
            if (!sig || typeof sig !== 'object') {
               return <div className="py-12 text-center text-white/40 text-sm font-bold animate-pulse">데이터를 유효한 형식으로 조립 중입니다...</div>;
            }
            
            const hasNoRecommendation = !sig.stock || sig.stock === 'null' || sig.stock === 'None';

            return (
              <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white/5 rounded-xl border border-white/10 p-4">
                <div className="text-[#a4b1cd] text-[9px] font-black mb-2 uppercase tracking-widest opacity-50">📊 테마 예측</div>
                <div className="text-white font-black text-base flex justify-between items-end">
                  <span>{sig.theme || '분석 중...'}</span>
                  <span className="text-[#00ffab] text-sm font-black">{sig.themeProb || '??%'}</span>
                </div>
              </div>
              <div className={`rounded-xl p-4 col-span-2 border ${
                hasNoRecommendation 
                  ? 'bg-amber-500/5 border-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.05)]' 
                  : 'bg-white/5 border-white/10'
              }`}>
                <div className="text-[#a4b1cd] text-[9px] font-black mb-2 uppercase tracking-widest opacity-50 flex items-center gap-1.5">
                  {hasNoRecommendation ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                      ⚠️ AI Recommendation Hold (추천 보류 사유)
                    </>
                  ) : (
                    '✨ Top Pick & Targets'
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span 
                      onClick={() => !hasNoRecommendation && onOpenPopup(sig.stock, sig.price, sig.themeProb, sig.symbol)} 
                      className={`font-black text-lg ${hasNoRecommendation ? 'text-amber-400' : 'text-blue-300 underline underline-offset-4 decoration-blue-500/50 cursor-pointer'}`}
                    >
                      {hasNoRecommendation ? '시장 리스크 관리로 인한 추천 보류' : sig.stock}
                    </span>
                    {!hasNoRecommendation && (
                      <div className="flex gap-2">
                        <div className="px-2 py-1 bg-green-500/10 border border-green-500/20 rounded text-[10px] font-black text-green-400">
                          TARGET {sig.tp && !isNaN(parseInt(sig.tp)) ? '₩' + parseInt(sig.tp).toLocaleString() : '---'}
                        </div>
                        <div className="px-2 py-1 bg-red-500/10 border border-red-500/20 rounded text-[10px] font-black text-red-400">
                          STOP {sig.sl && !isNaN(parseInt(sig.sl)) ? '₩' + parseInt(sig.sl).toLocaleString() : '---'}
                        </div>
                      </div>
                    )}
                  </div>
                  {hasNoRecommendation && (
                    <p className="text-white/80 text-xs leading-relaxed mt-1 border-t border-amber-500/10 pt-2 italic font-medium">
                      {sig.reason || '현재 시장 변동성 지표(Z-Score) 경계 수준 돌파 및 종목별 리스크 VETO 필터 통과 종목 부재로 신규 포트폴리오 편입을 보류합니다.'}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
               <div className="bg-white/[0.02] rounded-xl border border-white/5 p-4">
                  <div className="text-blue-400 text-[9px] font-black mb-2 uppercase tracking-widest">🔍 Fundamental & Macro</div>
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded font-bold">기능</span>
                      <p className="text-white/70 text-xs leading-tight">{sig.fundamental || '데이터 수집 중...'}</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded font-bold">시황</span>
                      <p className="text-white/70 text-xs leading-tight">
                        {sig.macro && typeof sig.macro === 'object' 
                          ? (sig.macro.achillesHeel?.join(' ') || sig.macro.sentiment)
                          : (sig.macro || '매크로 분석 중...')}
                      </p>
                    </div>
                  </div>
               </div>
               <div className="bg-white/[0.02] rounded-xl border border-white/5 p-4">
                  <div className="text-red-400 text-[9px] font-black mb-2 uppercase tracking-widest">⚠️ Risk Management (Bear Case)</div>
                  <div className="text-white/70 text-xs leading-relaxed italic">
                    {sig.bearCase && typeof sig.bearCase === 'object'
                      ? (sig.bearCase.exitSignal?.map((s, i) => <div key={i} className="mb-1">• {s}</div>) || sig.bearCase.scenario)
                      : (sig.bearCase || '하락 시나리오를 계산 중입니다...')}
                  </div>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <div className="bg-[#151c2c] rounded-xl border border-gray-700/50 p-4 relative overflow-hidden group h-full">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#ff3d68]"></div>
                <div className="text-gray-400 text-[10px] font-black mb-2 uppercase italic">■ 실시간 AI 분석 근거</div>
                <p className="text-gray-200 text-sm leading-relaxed">{sig.reason || '시장 데이터를 분석 중입니다...'}</p>
              </div>
              <div className="bg-[#151c2c]/80 rounded-xl border border-gray-700/50 p-4 relative overflow-hidden group h-full">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#0a6fe8]"></div>
                <div className="text-[#8e9ab2] text-[10px] font-black mb-2 uppercase italic">■ 전략 로그</div>
                <p className="text-[#a4b1cd] text-[12px]">{sig.feedback || '분석 중입니다...'}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Short-term Picks */}
              <div className="bg-[#1a1f2b] rounded-xl border border-white/5 overflow-hidden">
                <div className="bg-white/[0.02] px-4 py-3 border-b border-white/5 flex items-center justify-between">
                  <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest">🔥 단기 모멘텀 공략주 (TOP 10)</h4>
                  <span className="text-[9px] text-white/30 uppercase italic font-bold">5-10일 스윙 전략</span>
                </div>
                <div className="p-0 overflow-x-auto">
                  <table className="w-full text-[11px] text-left">
                    <thead>
                      <tr className="text-white/20 text-[9px] uppercase border-b border-white/5">
                        <th className="px-4 py-2 font-black">종목명/코드</th>
                        <th className="px-4 py-2 text-right font-black">현재가</th>
                        <th className="px-4 py-2 text-right font-black text-green-400">목표가</th>
                        <th className="px-4 py-2 text-right font-black text-red-400">손절가</th>
                        <th className="px-4 py-2 text-right font-black">전략</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.02]">
                      {(sig.shortTermPicks || []).map((it, i) => (
                        <tr key={i} className="hover:bg-white/[0.02] cursor-pointer group" onClick={() => onOpenPopup(it.n, it.p, (it.tp ? `TARGET ${it.tp}` : '15%'), it.c)}>
                          <td className="px-4 py-3">
                            <div className="flex flex-col">
                              <span className="text-white font-bold group-hover:text-blue-400 transition-colors">{it.n}</span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[9px] text-white/30 font-mono tracking-tighter">{it.c}</span>
                                {it.sp && (
                                  <span className="text-[8px] px-1 py-0.2 rounded bg-blue-500/10 border border-blue-500/20 text-blue-300 font-medium leading-none">
                                    📊 {it.sp}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-white/70">{parseInt(it.p)?.toLocaleString()}원</td>
                          <td className="px-4 py-3 text-right font-mono text-green-400 font-bold">{it.tp ? parseInt(it.tp).toLocaleString() + '원' : '---'}</td>
                          <td className="px-4 py-3 text-right font-mono text-red-400 font-bold">{it.sl ? parseInt(it.sl).toLocaleString() + '원' : '---'}</td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-blue-400 font-black tabular-nums">{it.t || '15%'}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Long-term Picks */}
              <div className="bg-[#1a1f2b] rounded-xl border border-white/5 overflow-hidden">
                <div className="bg-white/[0.02] px-4 py-3 border-b border-white/5 flex items-center justify-between">
                  <h4 className="text-[10px] font-black text-purple-400 uppercase tracking-widest">💎 중장기 가치 투자주 (TOP 10)</h4>
                  <span className="text-[9px] text-white/30 uppercase italic font-bold">3-6개월 가치 분석</span>
                </div>
                <div className="p-0 overflow-x-auto">
                  <table className="w-full text-[11px] text-left">
                    <thead>
                      <tr className="text-white/20 text-[9px] uppercase border-b border-white/5">
                        <th className="px-4 py-2 font-black">종목명/코드</th>
                        <th className="px-4 py-2 text-right font-black">현재가</th>
                        <th className="px-4 py-2 text-right font-black text-green-400">목표가</th>
                        <th className="px-4 py-2 text-right font-black text-red-400">손절가</th>
                        <th className="px-4 py-2 text-right font-black">투자포인트</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.02]">
                      {(sig.longTermPicks || []).map((it, i) => (
                        <tr key={i} className="hover:bg-white/[0.02] cursor-pointer group" onClick={() => onOpenPopup(it.n, it.p, '실시간 분석', it.c)}>
                          <td className="px-4 py-3">
                            <div className="flex flex-col">
                              <span className="text-white font-bold group-hover:text-purple-400 transition-colors">{it.n}</span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[9px] text-white/30 font-mono tracking-tighter">{it.c}</span>
                                {it.sp && (
                                  <span className="text-[8px] px-1 py-0.2 rounded bg-purple-500/10 border border-purple-500/20 text-purple-300 font-medium leading-none">
                                    📊 {it.sp}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-white/70">{parseInt(it.p)?.toLocaleString()}원</td>
                          <td className="px-4 py-3 text-right font-mono text-green-400 font-bold">{it.tp ? parseInt(it.tp).toLocaleString() + '원' : '---'}</td>
                          <td className="px-4 py-3 text-right font-mono text-red-400 font-bold">{it.sl ? parseInt(it.sl).toLocaleString() + '원' : '---'}</td>
                          <td className="px-4 py-3 text-right text-[10px] text-white/40 italic truncate max-w-[100px]">
                            {it.r}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {sig.marketStress && (
              <div className="mt-2 mb-8 bg-[#1a1f2c]/50 rounded-2xl border border-white/5 p-6 backdrop-blur-xl bg-gradient-to-b from-[#1a1f2b] to-[#141822] shadow-[0_8px_32px_rgba(0,0,0,0.37)]">
                {/* 1. Header Section */}
                <div className="flex justify-between items-center mb-5 pb-4 border-b border-white/5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-1.5 h-4 bg-gradient-to-b from-blue-400 to-indigo-500 rounded-full animate-pulse"></div>
                    <h4 className="text-xs font-black text-white/95 uppercase tracking-wider">
                      💡 시장 스트레스 지표별 투자 행동 지침 (Risk Guidelines)
                    </h4>
                  </div>
                  <div className="px-3 py-0.5 rounded-full bg-white/[0.04] border border-white/5 text-[9px] font-black uppercase text-white/40 tracking-widest flex items-center gap-1.5">
                    Total Score: 
                    <span className={`font-mono text-xs font-bold ${
                      sig.marketStress.score >= 60 
                        ? 'text-red-400 animate-pulse' 
                        : sig.marketStress.score >= 50 
                          ? 'text-amber-400' 
                          : 'text-green-400'
                    }`}>
                      {sig.marketStress.score}점
                    </span>
                  </div>
                </div>

                {/* 2. Guidelines (3 Columns) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {/* 1. 안정 구간 */}
                  <div className={`p-4 rounded-xl border text-[11px] leading-relaxed transition-all duration-300 ${
                    sig.marketStress.score < 50 
                      ? 'border-green-500/30 bg-green-500/5 text-white/90 font-medium shadow-[0_0_15px_rgba(16,185,129,0.05)]' 
                      : 'border-white/5 bg-transparent text-white/40'
                  }`}>
                    <div className={`text-xs font-black mb-1.5 ${sig.marketStress.score < 50 ? 'text-green-400' : 'text-white/40'}`}>
                      🟢 안정 국면 (0 ~ 49점) {sig.marketStress.score < 50 && `[현재: ${sig.marketStress.score}점]`}
                    </div>
                    시장 변동성이 낮은 안정적인 상태입니다. 우량 펀더멘털 종목 중심의 정석적인 포트폴리오 운용 및 모멘텀 돌파 전략이 유효합니다.
                  </div>

                  {/* 2. 경계 구간 */}
                  <div className={`p-4 rounded-xl border text-[11px] leading-relaxed transition-all duration-300 ${
                    (sig.marketStress.score >= 50 && sig.marketStress.score < 60)
                      ? 'border-amber-500/30 bg-amber-500/5 text-white/90 font-medium shadow-[0_0_15px_rgba(245,158,11,0.05)]' 
                      : 'border-white/5 bg-transparent text-white/40'
                  }`}>
                    <div className={`text-xs font-black mb-1.5 ${(sig.marketStress.score >= 50 && sig.marketStress.score < 60) ? 'text-amber-400' : 'text-white/40'}`}>
                      🟡 경계 국면 (50 ~ 59점) {(sig.marketStress.score >= 50 && sig.marketStress.score < 60) && `[현재: ${sig.marketStress.score}점]`}
                    </div>
                    환율 상승 및 지표 불균형이 감지되는 시점입니다. 분할 매수 비중을 평소보다 20% 축소하고 손절가를 타이트하게 조절할 것을 경고합니다.
                  </div>

                  {/* 3. 폭락 위험 구간 */}
                  <div className={`p-4 rounded-xl border text-[11px] leading-relaxed transition-all duration-300 ${
                    sig.marketStress.score >= 60 
                      ? 'border-red-500/40 bg-red-500/10 text-white font-semibold shadow-[0_0_15px_rgba(239,68,68,0.1)]' 
                      : 'border-white/5 bg-transparent text-white/40'
                  }`}>
                    <div className={`text-xs font-black mb-1.5 ${sig.marketStress.score >= 60 ? 'text-red-400' : 'text-white/40'} flex items-center gap-1`}>
                      🚨 위험/폭락 국면 (60점 이상) {sig.marketStress.score >= 60 && `[현재: ${sig.marketStress.score}점]`}
                    </div>
                    코스피/코스닥 지수 패닉셀 및 환율 급등 국면입니다. <span className={`${sig.marketStress.score >= 60 ? 'text-red-300 font-black underline' : 'text-white/40'}`}>신규 매수를 원천적으로 금지하고 현금 보유 비중을 대폭 확대하여 자산을 안전하게 보존하세요!</span>
                  </div>
                </div>

                {/* 3. Sub-title / Divider */}
                <div className="flex items-center gap-2 mb-4 pt-2 border-t border-white/[0.03]">
                  <div className="w-1 h-3 bg-white/20 rounded-full"></div>
                  <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">■ 실시간 계량 리스크 지표 (4대 지표)</span>
                </div>

                {/* 4. Indicators Grid (4 Columns) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* 🔵 KOSPI */}
                  <div className="bg-white/[0.01] rounded-xl border border-white/5 p-4 flex flex-col justify-between hover:bg-white/[0.02] transition-colors duration-200">
                    <div>
                      <div className="text-white/40 text-[9px] font-black mb-1 uppercase tracking-widest">🔵 KOSPI STRESS (Z-Score)</div>
                      <div className="text-white font-black text-sm flex justify-between items-center mb-2">
                        <span>{sig.marketStress.kospi.current?.toLocaleString()}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-black ${sig.marketStress.kospi.score > 15 ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
                          {sig.marketStress.kospi.score}점
                        </span>
                      </div>
                    </div>
                    <div className="text-[10px] text-white/50 space-y-1 mt-2">
                      <div className="flex justify-between"><span>20일선 평균:</span> <span className="font-mono text-white/80">{sig.marketStress.kospi.sma20?.toLocaleString()}</span></div>
                      <div className="flex justify-between"><span>변동성 표준편차 배수:</span> <span className="font-mono text-white/80">{sig.marketStress.kospi.zScore}σ</span></div>
                      <div className="flex justify-between"><span>20일선 기울기 (5D):</span> <span className={`font-mono ${sig.marketStress.kospi.slope >= 0 ? 'text-green-400' : 'text-red-400'}`}>{sig.marketStress.kospi.slope >= 0 ? '+' : ''}{sig.marketStress.kospi.slope}%</span></div>
                    </div>
                  </div>
                  
                  {/* 🟢 KOSDAQ */}
                  <div className="bg-white/[0.01] rounded-xl border border-white/5 p-4 flex flex-col justify-between hover:bg-white/[0.02] transition-colors duration-200">
                    <div>
                      <div className="text-white/40 text-[9px] font-black mb-1 uppercase tracking-widest">🟢 KOSDAQ STRESS (Z-Score)</div>
                      <div className="text-white font-black text-sm flex justify-between items-center mb-2">
                        <span>{sig.marketStress.kosdaq.current?.toLocaleString()}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-black ${sig.marketStress.kosdaq.score > 15 ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
                          {sig.marketStress.kosdaq.score}점
                        </span>
                      </div>
                    </div>
                    <div className="text-[10px] text-white/50 space-y-1 mt-2">
                      <div className="flex justify-between"><span>20일선 평균:</span> <span className="font-mono text-white/80">{sig.marketStress.kosdaq.sma20?.toLocaleString()}</span></div>
                      <div className="flex justify-between"><span>변동성 표준편차 배수:</span> <span className="font-mono text-white/80">{sig.marketStress.kosdaq.zScore}σ</span></div>
                      <div className="flex justify-between"><span>20일선 기울기 (5D):</span> <span className={`font-mono ${sig.marketStress.kosdaq.slope >= 0 ? 'text-green-400' : 'text-red-400'}`}>{sig.marketStress.kosdaq.slope >= 0 ? '+' : ''}{sig.marketStress.kosdaq.slope}%</span></div>
                    </div>
                  </div>

                  {/* 💵 USD/KRW */}
                  <div className="bg-white/[0.01] rounded-xl border border-white/5 p-4 flex flex-col justify-between hover:bg-white/[0.02] transition-colors duration-200">
                    <div>
                      <div className="text-white/40 text-[9px] font-black mb-1 uppercase tracking-widest">💵 USD/KRW FX STRESS</div>
                      <div className="text-white font-black text-sm flex justify-between items-center mb-2">
                        <span>{sig.marketStress.usd.rate?.toLocaleString()}원</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-black ${sig.marketStress.usd.score > 10 ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
                          {sig.marketStress.usd.score}점
                        </span>
                      </div>
                    </div>
                    <div className="text-[10px] text-white/50 space-y-1 mt-2">
                      <div className="flex justify-between"><span>일일 변동률:</span> <span className={`font-mono ${sig.marketStress.usd.changePercent >= 0 ? 'text-red-400' : 'text-green-400'}`}>{sig.marketStress.usd.changePercent >= 0 ? '+' : ''}{sig.marketStress.usd.changePercent}%</span></div>
                      <div className="flex justify-between"><span>FX 임계 경계치:</span> <span className="font-mono text-white/80">1,520원</span></div>
                      <div className="flex justify-between"><span>전일 대비 방향:</span> <span className={`font-bold ${sig.marketStress.usd.score >= 5 ? 'text-red-400' : 'text-green-400'}`}>{sig.marketStress.usd.score >= 5 ? '상승 (주의)' : '안정'}</span></div>
                    </div>
                  </div>

                  {/* 🇺🇸 US 10Y BOND */}
                  <div className="bg-white/[0.01] rounded-xl border border-white/5 p-4 flex flex-col justify-between hover:bg-white/[0.02] transition-colors duration-200">
                    <div>
                      <div className="text-white/40 text-[9px] font-black mb-1 uppercase tracking-widest">🇺🇸 US 10Y BOND STRESS</div>
                      <div className="text-white font-black text-sm flex justify-between items-center mb-2">
                        <span>{sig.marketStress.us10y ? sig.marketStress.us10y.yield.toFixed(3) : '--'}%</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-black ${sig.marketStress.us10y?.score > 5 ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
                          {sig.marketStress.us10y ? sig.marketStress.us10y.score : 0}점
                        </span>
                      </div>
                    </div>
                    <div className="text-[10px] text-white/50 space-y-1 mt-2">
                      <div className="flex justify-between"><span>일일 변동률:</span> <span className={`font-mono ${sig.marketStress.us10y?.changePercent >= 0 ? 'text-red-400' : 'text-green-400'}`}>{sig.marketStress.us10y?.changePercent >= 0 ? '+' : ''}{sig.marketStress.us10y ? sig.marketStress.us10y.changePercent.toFixed(3) : '--'}%</span></div>
                      <div className="flex justify-between"><span>최고 임계 경계치:</span> <span className="font-mono text-white/80">4.50%</span></div>
                      <div className="flex justify-between"><span>금리 추세 지표:</span> <span className={`font-bold ${sig.marketStress.us10y?.score >= 3 ? 'text-red-400' : 'text-green-400'}`}>{sig.marketStress.us10y?.score >= 3 ? '상승 압박 (경계)' : '안정 국면'}</span></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            </>
            );
          })()
        ) : (
          <div className="py-12 text-center text-white/40 text-sm font-bold animate-pulse">AI 분석 데이터를 생성하는 중입니다...</div>
        )}

        <div className="mt-4 border-t border-white/5 pt-6">
          <h3 className="text-sm font-black text-white/60 mb-4 flex items-center gap-2 uppercase tracking-widest"><Activity size={14} className="text-blue-500" /> AI 추천 기록 누적</h3>
          
          {/* Desktop Table Layout */}
          <div className="hidden md:block overflow-x-auto rounded-xl border border-white/5 bg-black/20">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="text-white/30 text-[9px] uppercase tracking-widest bg-white/[0.02] border-b border-white/5">
                  <th className="p-4 whitespace-nowrap">분석 시점</th>
                  <th className="p-4 whitespace-nowrap">추천 테마</th>
                  <th className="p-4 whitespace-nowrap">핵심 종목</th>
                  <th className="p-4 whitespace-nowrap">분석 확률</th>
                  <th className="p-4">분석 근거</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {aiHistory.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((item, i) => {
                  const prediction = item.prediction || item.signal; // 호환성 유지
                  const isShortTerm = (item.shortTermPicks || []).some(p => p.n === prediction?.stock);
                  const isLongTerm = (item.longTermPicks || []).some(p => p.n === prediction?.stock);
                  return (
                    <tr key={i} className="hover:bg-white/[0.03] transition-colors group">
                      <td className="p-4 text-white/40 font-mono text-[10px] whitespace-nowrap">{formatDateTime(item.time)}</td>
                      <td className="p-4 text-white font-bold whitespace-nowrap">{prediction?.theme?.split('(')[0] || 'N/A'}</td>
                      <td className="p-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <span 
                            onClick={() => prediction?.stock && onOpenPopup(prediction.stock, prediction.price, prediction.themeProb, prediction.symbol)} 
                            className="px-2 py-1 rounded bg-blue-600/10 border border-blue-500/20 text-blue-300 font-black text-[10px] cursor-pointer inline-flex items-center w-max"
                          >
                            {prediction?.stock || '-'}
                            {isShortTerm && (
                              <span className="ml-1.5 px-1 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[8px] font-black leading-none">단기</span>
                            )}
                            {isLongTerm && (
                              <span className="ml-1.5 px-1 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[8px] font-black leading-none">장기</span>
                            )}
                          </span>
                          {(prediction?.targetPrice || prediction?.stopLoss || prediction?.tp || prediction?.sl) && (
                            <div className="text-[9px] text-white/40 flex gap-2 font-mono">
                              {(prediction?.targetPrice || prediction?.tp) && <span>목표 <span className="text-emerald-400/80 font-bold">{formatPrice(prediction.targetPrice || prediction.tp)}</span></span>}
                              {(prediction?.stopLoss || prediction?.sl) && <span>손절 <span className="text-rose-400/80 font-bold">{formatPrice(prediction.stopLoss || prediction.sl)}</span></span>}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-[#00ffab] font-black whitespace-nowrap">{prediction?.themeProb || '-'}</td>
                      <td className="p-4 text-white/40 text-[11px] leading-relaxed break-all">
                        <div>{prediction?.reason || '-'}</div>
                        {((item.shortTermPicks && item.shortTermPicks.length > 0) || (item.longTermPicks && item.longTermPicks.length > 0)) && (
                          <div className="mt-2 pt-2 border-t border-white/[0.03] flex flex-col gap-1 text-[10px]">
                            {item.shortTermPicks && item.shortTermPicks.length > 0 && (
                              <div className="flex gap-1.5 items-center">
                                <span className="text-amber-400/80 font-bold whitespace-nowrap">단기 추천군:</span>
                                <div className="flex flex-wrap gap-1">
                                  {item.shortTermPicks.map((p, idx) => (
                                    <span key={idx} className="text-white/40">
                                      <span 
                                        onClick={() => onOpenPopup(p.n, p.p, prediction?.themeProb, p.c)}
                                        className="text-amber-300/80 hover:text-amber-300 font-bold cursor-pointer hover:underline transition-colors"
                                      >
                                        {p.n}
                                      </span>
                                      {idx < item.shortTermPicks.length - 1 ? ', ' : ''}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {item.longTermPicks && item.longTermPicks.length > 0 && (
                              <div className="flex gap-1.5 items-center">
                                <span className="text-emerald-400/80 font-bold whitespace-nowrap">중장기 추천군:</span>
                                <div className="flex flex-wrap gap-1">
                                  {item.longTermPicks.map((p, idx) => (
                                    <span key={idx} className="text-white/40">
                                      <span 
                                        onClick={() => onOpenPopup(p.n, p.p, prediction?.themeProb, p.c)}
                                        className="text-emerald-300/80 hover:text-emerald-300 font-bold cursor-pointer hover:underline transition-colors"
                                      >
                                        {p.n}
                                      </span>
                                      {idx < item.longTermPicks.length - 1 ? ', ' : ''}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card Layout */}
          <div className="block md:hidden space-y-4">
            {aiHistory.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((item, i) => {
              const prediction = item.prediction || item.signal;
              const isShortTerm = (item.shortTermPicks || []).some(p => p.n === prediction?.stock);
              const isLongTerm = (item.longTermPicks || []).some(p => p.n === prediction?.stock);
              return (
                <div key={i} className="p-4 rounded-xl border border-white/5 bg-white/[0.02] flex flex-col gap-3">
                  <div className="flex justify-between items-center pb-2 border-b border-white/[0.03]">
                    <span className="text-[10px] text-white/40 font-mono">
                      {formatDateTime(item.time)}
                    </span>
                    <span className="text-xs text-[#00ffab] font-black">
                      {prediction?.themeProb || '-'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center gap-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-white/30 uppercase font-black">추천 테마</span>
                      <span className="text-xs text-white font-bold">{prediction?.theme?.split('(')[0] || 'N/A'}</span>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[10px] text-white/30 uppercase font-black">핵심 종목</span>
                      <span 
                        onClick={() => prediction?.stock && onOpenPopup(prediction.stock, prediction.price, prediction.themeProb, prediction.symbol)} 
                        className="px-2 py-0.5 rounded bg-blue-600/10 border border-blue-500/20 text-blue-300 font-black text-[10px] cursor-pointer inline-flex items-center"
                      >
                        {prediction?.stock || '-'}
                        {isShortTerm && (
                          <span className="ml-1 px-1 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[8px] font-black leading-none scale-90 origin-right">단기</span>
                        )}
                        {isLongTerm && (
                          <span className="ml-1 px-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[8px] font-black leading-none scale-90 origin-right">장기</span>
                        )}
                      </span>
                      {(prediction?.targetPrice || prediction?.stopLoss || prediction?.tp || prediction?.sl) && (
                        <div className="text-[9px] text-white/40 flex gap-1.5 font-mono mt-0.5">
                          {(prediction?.targetPrice || prediction?.tp) && <span>목표 <span className="text-emerald-400/80 font-bold">{formatPrice(prediction.targetPrice || prediction.tp)}</span></span>}
                          {(prediction?.stopLoss || prediction?.sl) && <span>손절 <span className="text-rose-400/80 font-bold">{formatPrice(prediction.stopLoss || prediction.sl)}</span></span>}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 bg-black/20 p-3 rounded-lg border border-white/[0.02]">
                    <span className="text-[10px] text-white/30 uppercase font-black">분석 근거</span>
                    <p className="text-[11px] text-white/60 leading-relaxed break-all whitespace-pre-line">
                      {prediction?.reason || '-'}
                    </p>
                    
                    {/* Other Short/Long term picks list */}
                    {((item.shortTermPicks && item.shortTermPicks.length > 0) || (item.longTermPicks && item.longTermPicks.length > 0)) && (
                      <div className="mt-2 pt-2 border-t border-white/[0.03] flex flex-col gap-1 text-[10px]">
                        {item.shortTermPicks && item.shortTermPicks.length > 0 && (
                          <div className="flex gap-1.5 items-center">
                            <span className="text-amber-400/80 font-bold whitespace-nowrap">단기 추천군:</span>
                            <div className="flex flex-wrap gap-1">
                              {item.shortTermPicks.map((p, idx) => (
                                <span key={idx} className="text-white/40">
                                  <span 
                                    onClick={() => onOpenPopup(p.n, p.p, prediction?.themeProb, p.c)}
                                    className="text-amber-300/80 active:text-amber-300 font-bold cursor-pointer hover:underline transition-colors"
                                  >
                                    {p.n}
                                  </span>
                                  {idx < item.shortTermPicks.length - 1 ? ', ' : ''}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {item.longTermPicks && item.longTermPicks.length > 0 && (
                          <div className="flex gap-1.5 items-center">
                            <span className="text-emerald-400/80 font-bold whitespace-nowrap">중장기 추천군:</span>
                            <div className="flex flex-wrap gap-1">
                              {item.longTermPicks.map((p, idx) => (
                                <span key={idx} className="text-white/40">
                                  <span 
                                    onClick={() => onOpenPopup(p.n, p.p, prediction?.themeProb, p.c)}
                                    className="text-emerald-300/80 active:text-emerald-300 font-bold cursor-pointer hover:underline transition-colors"
                                  >
                                    {p.n}
                                  </span>
                                  {idx < item.longTermPicks.length - 1 ? ', ' : ''}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {aiHistory.length > itemsPerPage && (
            <div className="mt-4 flex justify-center items-center gap-2">
              {Array.from({ length: Math.ceil(aiHistory.length / itemsPerPage) }).map((_, i) => (
                <button 
                  key={i} 
                  onClick={() => setCurrentPage(i + 1)} 
                  className={`w-8 h-8 rounded text-[11px] font-black border ${currentPage === i + 1 ? 'bg-blue-600 border-blue-400 text-white' : 'bg-white/5 border-white/10 text-white/40'}`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default AISignalSection;
