import React, { useState } from 'react';
import { Activity, ChartLine } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const AISignalSection = ({ aiSignal, aiHistory, onOpenPopup }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const [scoreboardTab, setScoreboardTab] = useState('all');
  const [scoreboardSort, setScoreboardSort] = useState('score');
  const [scoreboardSearch, setScoreboardSearch] = useState('');
  const [expandedCand, setExpandedCand] = useState(null);

  const sig = aiSignal?.data?.pulse?.data || aiSignal?.pulse?.data || aiSignal?.data || aiSignal?.prediction || aiSignal;

  const getStatusBadge = (c) => {
    const badges = [];

    if (c.isVetoed) {
      let cleanReason = c.vetoReason || '필터배제';
      if (cleanReason.includes('설거지')) cleanReason = '🔴 설거지 경고';
      else if (cleanReason.includes('개미지옥')) cleanReason = '🔴 개미지옥 경보';
      else if (cleanReason.includes('적자') || cleanReason.includes('손실')) cleanReason = '🔴 좀비/적자 경고';
      else if (cleanReason.includes('부채')) cleanReason = '🔴 부실/고부채';
      else if (cleanReason.includes('이격도')) cleanReason = '🔴 이격과열 경고';
      else if (cleanReason.includes('RSI')) cleanReason = '🔴 RSI 과매수';
      else if (cleanReason.includes('하락')) cleanReason = '🔴 하락추세 감지';
      else cleanReason = `🔴 VETO: ${cleanReason.split('(')[0]}`;
      
      badges.push(
        <span key="veto" className="px-2.5 py-1 text-[10px] font-black rounded-lg bg-red-500/10 border border-red-500/20 text-[#ff3d68] shadow-sm select-none">
          {cleanReason}
        </span>
      );
    } else {
      if (c.metrics?.strengthAcceleration >= 5) {
        badges.push(
          <span key="accel-override" className="px-2.5 py-1 text-[10px] font-black rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 shadow-sm select-none animate-pulse">
            ⚡ 수급 가속 특례
          </span>
        );
      }
      badges.push(
        <span key="safe" className="px-2.5 py-1 text-[10px] font-black rounded-lg bg-[#00ffab]/10 border border-[#00ffab]/20 text-[#00ffab] shadow-sm select-none">
          🟢 진입 가능
        </span>
      );
    }

    if (c.isSupplyGoldenCross) {
      badges.push(
        <span key="golden" className="px-2.5 py-1 text-[10px] font-black rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 shadow-sm select-none animate-pulse">
          ✨ 상승 변곡점 (수급)
        </span>
      );
    }

    if (c.isSupplyDeathCross) {
      badges.push(
        <span key="death" className="px-2.5 py-1 text-[10px] font-black rounded-lg bg-red-500/10 border border-red-500/25 text-[#ff3d68] shadow-sm select-none animate-pulse">
          ⚠️ 하락 변곡점 (이탈)
        </span>
      );
    }

    return (
      <div className="flex gap-1.5 items-center flex-wrap">
        {badges}
      </div>
    );
  };

  const renderScoreBar = (label, value, maxVal) => {
    const isNegative = value < 0;
    const pct = isNegative ? 0 : Math.max(0, Math.min(100, (value / maxVal) * 100));
    
    return (
      <div className="flex flex-col gap-1 text-[11px] mb-2">
        <div className="flex justify-between font-bold text-white/50 text-[10px]">
          <span>{label}</span>
          <span className={`${isNegative ? 'text-[#ff3d68]' : 'text-white/80'} font-mono`}>{value} / {maxVal}점</span>
        </div>
        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden relative">
          <div 
            className={`h-full rounded-full transition-all duration-500 ${isNegative ? 'bg-[#ff3d68]' : 'bg-[#00ffab]'}`}
            style={{ width: `${isNegative ? Math.min(100, Math.abs(value)*3.3) : pct}%` }}
          />
        </div>
      </div>
    );
  };

  const renderRangeBar = (price, tp, sl) => {
    if (!price) return null;
    const priceNum = parseFloat(price);
    const tpNum = parseFloat(tp);
    const slNum = parseFloat(sl);
    
    const range = tpNum - slNum;
    const pct = range > 0 ? ((priceNum - slNum) / range) * 100 : 50;
    
    return (
      <div className="flex flex-col gap-2 bg-white/[0.01] border border-white/5 p-4 rounded-xl mt-3">
        <div className="flex justify-between items-center text-[10px] text-white/40 font-bold uppercase tracking-wider">
          <span>📉 청산 손절선 (Exit SL)</span>
          <span>현재 가격</span>
          <span>📈 스윙 목표선 (Swing TP)</span>
        </div>
        <div className="flex justify-between items-center text-xs font-black">
          <span className="text-[#ff3d68] font-mono">{formatPrice(slNum)}</span>
          <span className="text-white font-mono text-[13px]">{formatPrice(priceNum)}</span>
          <span className="text-[#00ffab] font-mono">{formatPrice(tpNum)}</span>
        </div>
        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden relative mt-1">
          {/* Marker lines */}
          <div className="absolute left-[33%] top-0 bottom-0 w-[1px] bg-white/10" />
          <div className="absolute left-[66%] top-0 bottom-0 w-[1px] bg-white/10" />
          
          {/* Progress bar representing range */}
          <div 
            className="h-full bg-gradient-to-r from-[#ff3d68] via-purple-500 to-[#00ffab] opacity-40"
            style={{ width: '100%' }}
          />
          {/* Current price indicator point */}
          <div 
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-white border-2 border-[#141822] shadow-[0_0_8px_rgba(255,255,255,0.8)]"
            style={{ left: `${Math.max(0, Math.min(100, pct))}%` }}
          />
        </div>
        <div className="text-[10px] text-white/30 text-center font-bold mt-1">
          ATR 변동성 기준: 단기 스윙 공략 3.0배수 목표 및 손절 배수 1.5배수 실시간 청산 지지대
        </div>
      </div>
    );
  };

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
    const num = Number(String(val).replace(/,/g, ''));
    if (!isNaN(num)) {
      return Math.round(num).toLocaleString() + '원';
    }
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
            {aiSignal?.marketOpen === false && (
              <div className="px-3 py-1 bg-amber-500/10 rounded-xl border border-amber-500/20 flex flex-col items-end shadow-[0_2px_10px_rgba(245,158,11,0.05)]">
                <div className="text-[9px] font-black uppercase tracking-wider opacity-95 flex items-center gap-1.5 text-amber-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                  장외 시간 (Market Closed)
                </div>
                <div className="text-[10px] font-bold text-amber-300/90 leading-tight mt-0.5">
                  직전 분석 결과 캐시 고정 제공
                </div>
              </div>
            )}
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
                    <>
                      {aiSignal?.marketOpen === false ? (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                          🔒 Off-Market Cached Top Pick
                        </>
                      ) : (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-[#00ffab] animate-pulse"></span>
                          ✨ Real-time Top Pick & Targets
                        </>
                      )}
                    </>
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

          {/* Quant Scoreboard & Risk Center */}
          {(() => {
            const candidates = sig?.candidates || [];
            
            const filteredCandidates = candidates.filter(c => {
              if (scoreboardSearch) {
                const q = scoreboardSearch.toLowerCase();
                const matchName = c.name?.toLowerCase().includes(q);
                const matchCode = c.code?.includes(q);
                if (!matchName && !matchCode) return false;
              }
              if (scoreboardTab === 'safe') return !c.isVetoed;
              if (scoreboardTab === 'veto') return c.isVetoed;
              if (scoreboardTab === 'golden') return c.isSupplyGoldenCross || c.isSupplyDeathCross;
              return true;
            });

            const sortedCandidates = [...filteredCandidates].sort((a, b) => {
              if (scoreboardSort === 'score') {
                return (b.totalScore || 0) - (a.totalScore || 0);
              }
              if (scoreboardSort === 'strength') {
                return (b.metrics?.strength || 0) - (a.metrics?.strength || 0);
              }
              if (scoreboardSort === 'disparity') {
                return Math.abs((b.metrics?.disparity5 || 100) - 100) - Math.abs((a.metrics?.disparity5 || 100) - 100);
              }
              if (scoreboardSort === 'short') {
                return (b.metrics?.shortRatio || 0) - (a.metrics?.shortRatio || 0);
              }
              return 0;
            });

            return (
              <div className="mt-8 border-t border-white/5 pt-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                  <div>
                    <h3 className="text-sm font-black text-white/80 flex items-center gap-2 uppercase tracking-widest">
                      <ChartLine size={14} className="text-[#00ffab]" /> 계량 전광판 및 실시간 리스크 센터
                    </h3>
                    <p className="text-[10px] text-orange-400 font-bold mt-1">국내 시장을 선도하는 350개 핵심 종목을 대상으로 30분마다 정밀 계량 평가를 실시하며, 분석 결과는 30분 주기로 자동 업데이트됩니다. 이 중 최종 엄선되어 AI 1차 심층 리스크 검증으로 유입되는 상위 25개 후보 종목의 실시간 퀀트 지표와 VETO 배제 사유를 투명하게 공개합니다.</p>
                  </div>
                  
                  {/* Controls */}
                  <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center w-full md:w-auto">
                    {/* Search Input */}
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="종목명/코드 검색..."
                        value={scoreboardSearch}
                        onChange={(e) => { setScoreboardSearch(e.target.value); setExpandedCand(null); }}
                        className="w-full sm:w-48 bg-white/[0.03] border border-white/10 rounded-xl px-3.5 py-1.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-[#00ffab]/50 transition-all font-bold"
                      />
                      {scoreboardSearch && (
                        <button
                          onClick={() => setScoreboardSearch('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white text-[10px]"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex bg-white/[0.02] border border-white/5 rounded-xl p-0.5 font-bold overflow-x-auto custom-scrollbar">
                      {[
                        { id: 'all', label: '전체' },
                        { id: 'safe', label: '🟢 진입유효' },
                        { id: 'veto', label: '🔴 배제(VETO)' },
                        { id: 'golden', label: '✨ 변곡점' }
                      ].map(tab => (
                        <button
                          key={tab.id}
                          onClick={() => { setScoreboardTab(tab.id); setExpandedCand(null); }}
                          className={`px-3 py-1.5 rounded-lg text-[10px] transition-all whitespace-nowrap ${scoreboardTab === tab.id ? 'bg-[#00ffab]/10 border border-[#00ffab]/20 text-[#00ffab]' : 'border border-transparent text-white/50 hover:text-white'}`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    {/* Sort Dropdown */}
                    <div className="flex items-center gap-1.5 bg-white/[0.02] border border-white/5 rounded-xl px-3 py-1.5 font-bold text-white/50 text-[10px] whitespace-nowrap">
                      <span>정렬:</span>
                      <select
                        value={scoreboardSort}
                        onChange={(e) => { setScoreboardSort(e.target.value); setExpandedCand(null); }}
                        className="bg-transparent border-none text-white focus:outline-none text-[10px] font-black cursor-pointer"
                      >
                        <option value="score" className="bg-[#141822] text-white">종합점수순</option>
                        <option value="strength" className="bg-[#141822] text-white">체결강도순</option>
                        <option value="disparity" className="bg-[#141822] text-white">이격과열순</option>
                        <option value="short" className="bg-[#141822] text-white">공매도비율순</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Scoreboard List */}
                {sortedCandidates.length === 0 ? (
                  <div className="py-12 text-center text-white/30 text-xs border border-white/5 rounded-2xl bg-white/[0.01]">
                    검색 조건에 맞는 계량 후보 종목이 없습니다.
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {sortedCandidates.map((c, idx) => {
                      const isExpanded = expandedCand ? (expandedCand === c.code) : (idx === 0);
                      const atrPercent = c.metrics?.atrPercent || 5.0;
                      const cPrice = parseFloat(c.price || 0);
                      const tp = cPrice * (1 + 3.0 * (atrPercent / 100));
                      const sl = cPrice * (1 - 1.5 * (atrPercent / 100));
                      
                      return (
                        <div 
                          key={c.code} 
                          className={`glass-card border border-white/5 bg-white/[0.01] rounded-2xl overflow-hidden transition-all duration-300 ${isExpanded ? 'bg-white/[0.03] border-white/10 shadow-lg' : 'hover:bg-white/[0.02]'}`}
                        >
                          {/* Collapsed Header Bar */}
                          <div 
                            onClick={() => setExpandedCand(isExpanded ? null : c.code)}
                            className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 cursor-pointer select-none"
                          >
                            <div className="flex items-center gap-3 w-full sm:w-auto">
                              <span className="w-5 text-center font-mono font-black text-white/30 text-xs">
                                {idx + 1}
                              </span>
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  <span 
                                    className="text-white font-black text-sm hover:text-blue-400 hover:underline cursor-pointer transition-colors"
                                    onClick={(e) => { 
                                      e.stopPropagation(); 
                                      onOpenPopup(c.name, String(c.price), c.change, c.code); 
                                    }}
                                  >
                                    {c.name}
                                  </span>
                                  <span className="text-[10px] text-white/30 font-mono">{c.code}</span>
                                </div>
                                <span className="text-[9px] text-white/40 mt-0.5">{c.metrics?.sector || '기타'}</span>
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto border-t sm:border-t-0 border-white/5 pt-2 sm:pt-0">
                              {/* Badges */}
                              <div className="flex gap-2">
                                {getStatusBadge(c)}
                              </div>

                              <div className="flex items-center gap-3">
                                {/* Total Score */}
                                <div className="flex flex-col items-end">
                                  <span className="text-[9px] text-white/30 font-bold uppercase tracking-widest">계량 종합</span>
                                  <span className={`text-sm font-black font-mono ${c.isVetoed ? 'text-white/40' : (c.totalScore >= 40 ? 'text-[#00ffab]' : 'text-white/80')}`}>
                                    {c.totalScore !== undefined && c.totalScore !== null ? c.totalScore.toFixed(0) : '0'}점
                                  </span>
                                </div>
                                
                                {/* Expand Arrow */}
                                <div className="text-white/30">
                                  {isExpanded ? (
                                    <svg className="w-4 h-4 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 15l7-7 7 7" />
                                    </svg>
                                  ) : (
                                    <svg className="w-4 h-4 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                                    </svg>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Expand Details Drawer */}
                          <AnimatePresence initial={false}>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.3, ease: 'easeInOut' }}
                              >
                                <div className="px-4 pb-6 pt-2 border-t border-white/5 bg-black/10">
                                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    
                                    {/* Column 1: Sub-Score breakdown */}
                                    <div className="lg:col-span-1 bg-white/[0.01] border border-white/5 rounded-2xl p-4">
                                      <div className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                        <span>📊 계량 가중치 분석 (Detail Scores)</span>
                                      </div>
                                      {renderScoreBar('당일 체결강도', c.scores?.strengthScore || 0, 30)}
                                      {renderScoreBar('외인/기관 수급', c.scores?.supplyScore || 0, 35)}
                                      {renderScoreBar('시장 연동 상대강도', c.scores?.indexRelativeScore || 0, 20)}
                                      {renderScoreBar('이동평균 추세', c.scores?.trendScore || 0, 15)}
                                      {renderScoreBar('자금 유입 규모', c.scores?.moneyInflowScore || 0, 15)}
                                      {renderScoreBar('외국계 창구 수급', c.scores?.memberTrendScore || 0, 10)}
                                      {renderScoreBar('대형 체결 (블록오더)', c.scores?.largeTradeScore || 0, 8)}
                                      {renderScoreBar('체결강도 가속도', c.scores?.strengthAccScore || 0, 10)}
                                      {c.scores?.financialScore !== undefined && c.scores.financialScore !== 0 && 
                                        renderScoreBar('하락장 재무 안전성', c.scores.financialScore, 20)
                                      }
                                      {c.scores?.backtestPenalty !== undefined && c.scores.backtestPenalty < 0 && (
                                        <div className="flex justify-between items-center text-[10px] text-[#ff3d68] font-bold mt-1 bg-[#ff3d68]/5 p-2 rounded-lg border border-[#ff3d68]/15">
                                          <span>📉 최근 30분 백테스트 감점</span>
                                          <span className="font-mono">{c.scores.backtestPenalty}점</span>
                                        </div>
                                      )}
                                    </div>

                                    {/* Column 2: Raw metrics */}
                                    <div className="lg:col-span-1 bg-white/[0.01] border border-white/5 rounded-2xl p-4 flex flex-col justify-between">
                                      <div>
                                        <div className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-3">
                                          <span>⚙️ 실시간 계량 지표 (Raw Metrics)</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px] text-white/60">
                                          <div className="flex justify-between py-1 border-b border-white/[0.03]">
                                            <span>체결강도:</span>
                                            <span className="font-mono text-white/95 font-bold">{c.metrics?.strength}%</span>
                                          </div>
                                          <div className="flex justify-between py-1 border-b border-white/[0.03]">
                                            <span>공매도 비중:</span>
                                            <span className="font-mono text-white/95 font-bold">{c.metrics?.shortRatio}%</span>
                                          </div>
                                          <div className="flex justify-between py-1 border-b border-white/[0.03]">
                                            <span>5일 이격도:</span>
                                            <span className="font-mono text-white/95 font-bold">{c.metrics?.disparity5}%</span>
                                          </div>
                                          <div className="flex justify-between py-1 border-b border-white/[0.03]">
                                            <span>1일 이격도:</span>
                                            <span className="font-mono text-white/95 font-bold">{c.metrics?.disparity1}%</span>
                                          </div>
                                          <div className="flex justify-between py-1 border-b border-white/[0.03]">
                                            <span>신용잔고율:</span>
                                            <span className="font-mono text-white/95 font-bold">{c.metrics?.creditBalance}%</span>
                                          </div>
                                          <div className="flex justify-between py-1 border-b border-white/[0.03]">
                                            <span>거래대금 (당일):</span>
                                            <span className="font-mono text-white/95 font-bold">{Math.round((c.metrics?.transactionValue || 0) / 100000000)}억원</span>
                                          </div>
                                          <div className="flex justify-between py-1 border-b border-white/[0.03]">
                                            <span>체결 가속도:</span>
                                            <span className="font-mono text-orange-400 font-bold">
                                              {c.metrics?.strengthAcceleration !== undefined ? `${c.metrics.strengthAcceleration > 0 ? '+' : ''}${c.metrics.strengthAcceleration}%p` : '-'}
                                            </span>
                                          </div>
                                          <div className="flex justify-between py-1 border-b border-white/[0.03]">
                                            <span>블록오더 비중:</span>
                                            <span className="font-mono text-[#00ffab] font-bold">
                                              {c.metrics?.largeTradeRatio !== undefined ? `${(c.metrics.largeTradeRatio * 100).toFixed(1)}%` : '-'}
                                            </span>
                                          </div>
                                          <div className="flex justify-between py-1 border-b border-white/[0.03] col-span-2">
                                            <span>이동평균 정렬:</span>
                                            <span className="text-[#00ffab] font-bold">{c.metrics?.maAlignment || '혼조세'}</span>
                                          </div>
                                          <div className="flex justify-between py-1 border-b border-white/[0.03] col-span-2">
                                            <span>외국계 순매수액:</span>
                                            <span className="font-mono text-[#00ffab] font-bold">
                                              {c.metrics?.netForeignWindowBuyMoney !== undefined ? `${c.metrics.netForeignWindowBuyMoney > 0 ? '+' : ''}${c.metrics.netForeignWindowBuyMoney}억원` : '-'}
                                            </span>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Financial info if available */}
                                      {c.financials && (
                                        <div className="mt-4 pt-3 border-t border-white/5">
                                          <div className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-1.5">
                                            Corporate Financials
                                          </div>
                                          <div className="grid grid-cols-3 gap-2 text-center text-[10px] text-white/60">
                                            <div className="bg-white/[0.02] p-1.5 rounded-lg border border-white/5">
                                              <div className="text-white/30 text-[8px] uppercase">ROE</div>
                                              <div className={`font-mono font-bold mt-0.5 ${c.financials.roe < 0 ? 'text-[#ff3d68]' : 'text-white'}`}>{c.financials.roe !== null ? `${c.financials.roe}%` : '-'}</div>
                                            </div>
                                            <div className="bg-white/[0.02] p-1.5 rounded-lg border border-white/5">
                                              <div className="text-white/30 text-[8px] uppercase">부채비율</div>
                                              <div className={`font-mono font-bold mt-0.5 ${c.financials.debtRatio >= 200 ? 'text-[#ff3d68]' : 'text-white'}`}>{c.financials.debtRatio !== null ? `${c.financials.debtRatio}%` : '-'}</div>
                                            </div>
                                            <div className="bg-white/[0.02] p-1.5 rounded-lg border border-white/5">
                                              <div className="text-white/30 text-[8px] uppercase">PBR</div>
                                              <div className="font-mono font-bold mt-0.5 text-white">{c.financials.pbr !== null ? `${c.financials.pbr}배` : '-'}</div>
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </div>

                                    {/* Column 3: ATR & Trading Guidance */}
                                    <div className="lg:col-span-1 flex flex-col justify-between">
                                      <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-4 h-full flex flex-col justify-between">
                                        <div>
                                          <div className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                            <span>🎯 진입 및 청산 가이드 (ATR Target Boundary)</span>
                                          </div>
                                          <div className="text-[11px] text-white/50 leading-relaxed mb-3">
                                            {c.isVetoed ? (
                                              <span className="text-[#ff3d68] font-bold">
                                                [주의] 본 종목은 {c.vetoReason || '계량 안전성 필터 배제'} 조건에 감지된 상태이므로 신규 진입을 금지합니다.
                                              </span>
                                            ) : (
                                              <div className="flex flex-col gap-2">
                                                {c.metrics?.strengthAcceleration >= 5 && (parseFloat(c.metrics?.strength) < 95 || (c.metrics?.maAlignment && c.metrics.maAlignment.includes('역배열'))) && (
                                                  <div className="p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[10px] font-bold leading-normal">
                                                    💡 [수급 가속 특례 적용] 체결강도({c.metrics?.strength}%)가 기준(95%)보다 낮거나 추세가 역배열 상태이나, 실시간 가속도(+{c.metrics?.strengthAcceleration}%p)와 블록오더 비중이 급증하여 리스크 VETO가 유예되고 진입이 유효 판정되었습니다.
                                                  </div>
                                                )}
                                                <span className="text-white/70">
                                                  변동성(ATR {atrPercent}%) 기준 매수 청산 지지대와 돌파 상승 저항대 가이드라인입니다.
                                                </span>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                        
                                        {/* Visual Range bar */}
                                        {renderRangeBar(c.price, tp, sl)}
                                      </div>
                                    </div>

                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>

                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

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
