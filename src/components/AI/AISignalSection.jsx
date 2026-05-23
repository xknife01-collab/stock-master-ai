import React, { useState } from 'react';
import { Activity, ChartLine } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const AISignalSection = ({ aiSignal, aiHistory, onOpenPopup }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

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
          <div className="text-right">
            <div className="text-[10px] font-black text-white/30 uppercase mb-1">Last Update</div>
            <div className="text-xs font-mono font-black text-blue-400">{aiSignal?.time || '--:--'}</div>
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
              <div className="text-[10px] font-black text-blue-400 uppercase tracking-tighter">01. Data Ingestion</div>
              <p className="text-[11px] text-white/50 leading-tight">실시간 뉴스, 환율, 국채 금리 등 30+개 매크로 지표 수집</p>
            </div>
            <div className="flex flex-col gap-2 p-3 bg-white/5 rounded-xl border border-white/5 relative z-10">
              <div className="text-[10px] font-black text-purple-400 uppercase tracking-tighter">02. Context Alignment (RAG)</div>
              <p className="text-[11px] text-white/50 leading-tight">과거 추천 성적표(오답노트)를 참조하여 '자가 수정' 수행</p>
            </div>
            <div className="flex flex-col gap-2 p-3 bg-white/5 rounded-xl border border-white/5 relative z-10">
              <div className="text-[10px] font-black text-green-400 uppercase tracking-tighter">03. Strategic Filtering</div>
              <p className="text-[11px] text-white/50 leading-tight">손절가 산출, 재무 건전성 필터링, 하락 시나리오 시뮬레이션</p>
            </div>
            <div className="flex flex-col gap-2 p-3 bg-blue-500/10 rounded-xl border border-blue-500/20 relative z-10 shadow-[0_0_20px_rgba(59,130,246,0.1)]">
              <div className="text-[10px] font-black text-blue-300 uppercase tracking-tighter">04. Portfolio Signal</div>
              <p className="text-[11px] text-white/80 leading-tight font-medium">퀀트 논리 기반의 최종 주도 테마 및 종목 시그널 확정</p>
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
              <div className="bg-white/5 rounded-xl border border-white/10 p-4 col-span-2">
                <div className="text-[#a4b1cd] text-[9px] font-black mb-2 uppercase tracking-widest opacity-50">✨ Top Pick & Targets</div>
                <div className="flex items-center justify-between">
                  <span 
                    onClick={() => !hasNoRecommendation && onOpenPopup(sig.stock, sig.price, sig.themeProb, sig.symbol)} 
                    className={`font-black text-lg ${hasNoRecommendation ? 'text-white/20 italic' : 'text-blue-300 underline underline-offset-4 decoration-blue-500/50 cursor-pointer'}`}
                  >
                    {hasNoRecommendation ? '⚠️ 분석 정합성 부족으로 추천 보류' : sig.stock}
                  </span>
                  <div className="flex gap-2">
                    <div className="px-2 py-1 bg-green-500/10 border border-green-500/20 rounded text-[10px] font-black text-green-400">
                      TARGET {sig.tp && !isNaN(parseInt(sig.tp)) ? '₩' + parseInt(sig.tp).toLocaleString() : '---'}
                    </div>
                    <div className="px-2 py-1 bg-red-500/10 border border-red-500/20 rounded text-[10px] font-black text-red-400">
                      STOP {sig.sl && !isNaN(parseInt(sig.sl)) ? '₩' + parseInt(sig.sl).toLocaleString() : '---'}
                    </div>
                  </div>
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
                              <span className="text-[9px] text-white/30 font-mono tracking-tighter">{it.c}</span>
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
                              <span className="text-[9px] text-white/30 font-mono tracking-tighter">{it.c}</span>
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
                        <span 
                          onClick={() => prediction?.stock && onOpenPopup(prediction.stock, prediction.price, prediction.themeProb, prediction.symbol)} 
                          className="px-2 py-1 rounded bg-blue-600/10 border border-blue-500/20 text-blue-300 font-black text-[10px] cursor-pointer inline-flex items-center"
                        >
                          {prediction?.stock || '-'}
                          {isShortTerm && (
                            <span className="ml-1.5 px-1 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[8px] font-black leading-none">단기</span>
                          )}
                          {isLongTerm && (
                            <span className="ml-1.5 px-1 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[8px] font-black leading-none">장기</span>
                          )}
                        </span>
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
                                    <span key={idx} className="text-white/50">{p.n}{idx < item.shortTermPicks.length - 1 ? ',' : ''}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {item.longTermPicks && item.longTermPicks.length > 0 && (
                              <div className="flex gap-1.5 items-center">
                                <span className="text-emerald-400/80 font-bold whitespace-nowrap">중장기 추천군:</span>
                                <div className="flex flex-wrap gap-1">
                                  {item.longTermPicks.map((p, idx) => (
                                    <span key={idx} className="text-white/50">{p.n}{idx < item.longTermPicks.length - 1 ? ',' : ''}</span>
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
                                <span key={idx} className="text-white/50">{p.n}{idx < item.shortTermPicks.length - 1 ? ',' : ''}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {item.longTermPicks && item.longTermPicks.length > 0 && (
                          <div className="flex gap-1.5 items-center">
                            <span className="text-emerald-400/80 font-bold whitespace-nowrap">중장기 추천군:</span>
                            <div className="flex flex-wrap gap-1">
                              {item.longTermPicks.map((p, idx) => (
                                <span key={idx} className="text-white/50">{p.n}{idx < item.longTermPicks.length - 1 ? ',' : ''}</span>
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
