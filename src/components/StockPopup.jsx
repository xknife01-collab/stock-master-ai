import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { API_URL } from '../config.js';

const StockPopup = ({ item, onClose }) => {
  const [popupHistory, setPopupHistory] = useState([]);
  const [loadingPopup, setLoadingPopup] = useState(false);
  const [popupRange, setPopupRange] = useState('1M');
  const [stockDetail, setStockDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [realTimeData, setRealTimeData] = useState({ price: item.price, change: item.change });
  const [loadingRealTime, setLoadingRealTime] = useState(false);

  useEffect(() => {
    if (!item) return;

    // Reset real-time data to current item props immediately
    setRealTimeData({ price: item.price, change: item.change });
    setStockDetail(null);
    setPopupHistory([]);

    // Fetch history (initial = show loader, refresh = silent)
    const fetchHistory = (isInitial = false) => {
      if (isInitial) setLoadingPopup(true);
      fetch(`${API_URL}/api/stock/history/${item.symbol || '005930'}?range=${popupRange}&price=${item.price}`)
        .then(res => res.json())
        .then(data => setPopupHistory(data))
        .catch(e => console.error('History load fail', e))
        .finally(() => { if (isInitial) setLoadingPopup(false); });
    };

    fetchHistory(true);

    // 1분마다 자동 갱신 (1D 범위일 때만)
    let interval;
    if (popupRange === '1D') {
      interval = setInterval(() => fetchHistory(false), 60000);
    }

    // Fetch real-time price if it's a stock
    if (item.symbol && /^\d{6}$/.test(item.symbol)) {
      setLoadingRealTime(true);
      fetch(`${API_URL}/api/stock/${item.symbol}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.price) {
            setRealTimeData({ 
              price: data.price.toLocaleString(), 
              change: (data.change >= 0 ? '+' : '') + data.change + '%' 
            });
          }
        })
        .catch(e => console.error('Real-time price load fail', e))
        .finally(() => setLoadingRealTime(false));
    } else {
      setRealTimeData({ price: item.price, change: item.change });
    }

    // Fetch fundamental details if it's a KR stock code (6 digits)
    if (item.symbol && /^\d{6}$/.test(item.symbol)) {
      setLoadingDetail(true);
      fetch(`${API_URL}/api/stock-detail/detail/${item.symbol}`)
        .then(res => res.json())
        .then(data => {
          if (data.fundamental) setStockDetail(data.fundamental);
        })
        .catch(e => console.error('Detail load fail', e))
        .finally(() => setLoadingDetail(false));
    } else {
      setStockDetail(null);
    }

    return () => { if (interval) clearInterval(interval); };
  }, [item, popupRange]);

  if (!item) return null;

  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <motion.div initial={{scale:0.95, y:20}} animate={{scale:1, y:0}} exit={{scale:0.95, y:20}} onClick={e => e.stopPropagation()} className="bg-white rounded-xl shadow-2xl w-full max-w-2xl font-sans border border-gray-200 my-4 flex flex-col">
        <div className="sticky top-0 z-10 flex justify-between items-center p-5 border-b border-gray-100 bg-gray-50 rounded-t-xl">
          <div className="flex flex-col">
            <h2 className="text-xl font-bold text-gray-900">{item.name}</h2>
            <div className="flex items-end gap-2 mt-1">
              <span className="text-2xl font-black text-[#ed3738]">
                {loadingRealTime ? <span className="animate-pulse opacity-50">...</span> : realTimeData.price} 
                <span className="text-sm font-medium text-gray-500 ml-1">KRW</span>
              </span>
              {!loadingRealTime && (
                <span className={`font-bold pb-1 text-sm ${realTimeData.change?.includes('-') ? 'text-blue-500' : 'text-[#ed3738]'}`}>
                  {realTimeData.change}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        
        <div className="p-5">
          <div className="flex justify-between items-center mb-4">
            <div className="text-sm font-bold text-gray-600">주가/지수 추이</div>
            <div className="flex items-center gap-1 text-[11px] font-bold">
              {['1D', '1W', '1M', '1Y'].map(range => (
                <button 
                  key={range} 
                  onClick={() => setPopupRange(range)} 
                  className={`px-3 py-1 rounded border ${popupRange === range ? 'bg-white border-[#21a14c] text-[#21a14c] shadow-sm' : 'bg-gray-50 border-gray-200 text-gray-500'}`}
                >
                  {range === '1D' ? '1일' : range === '1W' ? '1주일' : range === '1M' ? '1개월' : '1년'}
                </button>
              ))}
            </div>
          </div>
          
          <div className="w-full font-sans" style={{ minHeight: '320px', height: '320px', position: 'relative' }}>
            {!loadingPopup && popupHistory && popupHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={popupHistory} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                  <defs><linearGradient id="colorPopup" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ed3738" stopOpacity={0.2}/><stop offset="95%" stopColor="#ed3738" stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="date" stroke="#888" fontSize={11} tickLine={false} axisLine={{stroke: '#e5e7eb'}} minTickGap={20} tickMargin={10} />
                  <YAxis domain={['dataMin - (dataMin*0.01)', 'dataMax + (dataMax*0.01)']} fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => Math.round(v).toLocaleString()} orientation="right" width={60} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} itemStyle={{ color: '#ed3738', fontWeight: 'bold' }} />
                  <Area type="monotone" dataKey="price" stroke="#ed3738" strokeWidth={2} fill="url(#colorPopup)" animationDuration={1000} isAnimationActive={true} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 font-bold text-sm">
                <div className="animate-pulse">{loadingPopup ? '차트 데이터를 불러오는 중...' : '데이터가 없습니다.'}</div>
              </div>
            )}
          </div>

          {stockDetail && (
            <div className="mt-6 border-t border-gray-100 pt-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="flex justify-between items-center mb-4">
                <div className="text-sm font-bold text-gray-800">기업 펀더멘털 분석</div>
                {stockDetail.consensus && stockDetail.consensus[0] && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">애널리스트 의견:</span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${stockDetail.consensus[0].opinion?.includes('매수') ? 'bg-[#ff3d68]/10 text-[#ff3d68]' : 'bg-gray-100 text-gray-500'}`}>
                      {stockDetail.consensus[0].opinion}
                    </span>
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-4 gap-3 mb-6">
                {[
                  { label: '주가수익비율', value: stockDetail.per, sub: 'PER' },
                  { label: '주가순자산비율', value: stockDetail.pbr, sub: 'PBR' },
                  { label: '자기자본이익률', value: (stockDetail.roe !== '-' ? stockDetail.roe + '%' : '-'), sub: 'ROE' },
                  { label: '배당수익률', value: (stockDetail.yield !== '-' ? stockDetail.yield + '%' : '-'), sub: 'Yield' }
                ].map((stat, i) => (
                  <div key={i} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                    <div className="text-[10px] text-gray-400 font-bold mb-1 uppercase">{stat.label}</div>
                    <div className="text-sm font-black text-gray-900">{stat.value}</div>
                    <div className="text-[8px] text-gray-300 font-medium mt-1 uppercase">{stat.sub}</div>
                  </div>
                ))}
              </div>

              {stockDetail.consensus && stockDetail.consensus[0] && stockDetail.consensus[0].target !== '-' && (
                <div className="bg-[#f0f9ff] border border-[#bae6fd] rounded-xl p-3 flex justify-between items-center mb-6">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-sky-500 font-bold uppercase">목표 주가 (Consensus)</span>
                    <span className="text-lg font-black text-sky-600">₩{parseInt(stockDetail.consensus[0].target).toLocaleString()}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-sky-400 font-bold block">현재가 대비</span>
                    <span className="text-sm font-bold text-sky-500">
                      +{Math.round(((parseInt(stockDetail.consensus[0].target) - parseInt(item.price.replace(/,/g, ''))) / parseInt(item.price.replace(/,/g, ''))) * 100)}% 업사이드
                    </span>
                  </div>
                </div>
              )}

              <div className="border-t border-gray-100 pt-6">
                <div className="text-[11px] font-bold text-gray-500 mb-4 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-3 bg-[#7000ff] rounded-full"></div>
                    3대 주체별 1일 수급 분석
                  </div>
                  <span className={`text-[9px] font-bold ${stockDetail.advanced?.investor?.isRealtime ? 'text-emerald-500' : 'text-amber-500'}`}>
                    {stockDetail.advanced?.investor?.isRealtime ? '● 당일 실시간' : '● 전 영업일 기준'}
                  </span>
                </div>

                {/* 🚨 개미지옥 경보 사이렌 (Retail Absorption Veto Warning) */}
                {stockDetail.advanced?.investor && (() => {
                  const fVal = stockDetail.advanced.investor.foreign1D !== undefined ? stockDetail.advanced.investor.foreign1D : stockDetail.advanced.investor.foreign5D;
                  const oVal = stockDetail.advanced.investor.organ1D !== undefined ? stockDetail.advanced.investor.organ1D : stockDetail.advanced.investor.organ5D;
                  const pVal = stockDetail.advanced.investor.personal1D !== undefined ? stockDetail.advanced.investor.personal1D : stockDetail.advanced.investor.personal5D;
                  const isRealtime = stockDetail.advanced.investor.isRealtime;
                  return isRealtime && pVal > 0 && fVal < 0 && oVal < 0;
                })() && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2.5 shadow-[0_2px_8px_rgba(239,68,68,0.08)] animate-pulse">
                    <span className="text-lg">🚨</span>
                    <div className="flex-1">
                      <div className="text-[11px] font-black text-red-600">개미 지옥 및 설거지 경보 (Retail Absorption Warning)</div>
                      <div className="text-[9px] text-red-500 leading-tight">외인/기관이 던진 대량 매도 물량을 개인이 홀로 수렴 중인 고위험 종목입니다. 진입에 극도로 유의하세요.</div>
                    </div>
                  </div>
                )}

                {/* 📊 수급 힘겨루기 가로 Bar 차트 (양방향 힘겨루기 세력선) */}
                {stockDetail.advanced?.investor ? (() => {
                  const fVal = stockDetail.advanced.investor.foreign1D !== undefined ? stockDetail.advanced.investor.foreign1D : stockDetail.advanced.investor.foreign5D;
                  const oVal = stockDetail.advanced.investor.organ1D !== undefined ? stockDetail.advanced.investor.organ1D : stockDetail.advanced.investor.organ5D;
                  const pVal = stockDetail.advanced.investor.personal1D !== undefined ? stockDetail.advanced.investor.personal1D : stockDetail.advanced.investor.personal5D;

                  // 3대 주체 중 가장 강력한 절대치를 100% 기준으로 삼아 스케일링
                  const maxAbs = Math.max(Math.abs(fVal), Math.abs(oVal), Math.abs(pVal), 1);

                  const fRatio = (fVal / maxAbs) * 100;
                  const oRatio = (oVal / maxAbs) * 100;
                  const pRatio = (pVal / maxAbs) * 100;

                  return (
                    <div className="bg-gray-50/50 border border-gray-100 rounded-xl p-4 mb-4">
                      {/* 포지션 차트 설명 */}
                      <div className="flex justify-between text-[9px] text-gray-400 font-bold mb-3 border-b border-gray-100 pb-1.5 uppercase tracking-wider">
                        <span>◀ 순매도 (유출)</span>
                        <span className="text-gray-500 font-black">0선 (기준)</span>
                        <span>순매수 (유입) ▶</span>
                      </div>

                      {/* 🔴 외국인 포지션 바 */}
                      <div className="mb-4">
                        <div className="flex justify-between text-[10px] font-black mb-1">
                          <span className="text-gray-600">🔴 외국인</span>
                          <span className={`font-mono ${fVal >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                            {fVal > 0 ? '+' : ''}{fVal.toLocaleString()}주
                          </span>
                        </div>
                        <div className="h-3 w-full bg-gray-200/50 rounded-full overflow-hidden relative flex">
                          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-400/80 z-10" /> {/* 0선 */}
                          {fVal < 0 ? (
                            <div 
                              className="h-full bg-gradient-to-l from-blue-400 to-blue-500 rounded-l-full absolute right-1/2" 
                              style={{ width: `${Math.min(50, Math.abs(fRatio) / 2)}%` }} 
                            />
                          ) : (
                            <div 
                              className="h-full bg-gradient-to-r from-red-400 to-red-500 rounded-r-full absolute left-1/2" 
                              style={{ width: `${Math.min(50, fRatio / 2)}%` }} 
                            />
                          )}
                        </div>
                        <div className="text-[8px] text-gray-400 font-bold mt-0.5 text-right flex justify-between items-center">
                          <span>
                            5일 누적 순매수 금액: <strong className={stockDetail.advanced.investor.foreignMoney5D >= 0 ? 'text-red-500' : 'text-blue-500'}>
                              {stockDetail.advanced.investor.foreignMoney5D !== undefined ? `${stockDetail.advanced.investor.foreignMoney5D > 0 ? '+' : ''}${stockDetail.advanced.investor.foreignMoney5D}억원` : '정보 없음'}
                            </strong>
                          </span>
                          <span>
                            외인 {stockDetail.advanced.investor.foreignConsecutiveDays}일 연속 순매수
                            {stockDetail.advanced.investor.foreignConsecutiveVolume > 0 && 
                              ` (총 ${stockDetail.advanced.investor.foreignConsecutiveVolume.toLocaleString()}주)`
                            }
                          </span>
                        </div>
                      </div>
 
                      {/* 🔵 기관 포지션 바 */}
                      <div className="mb-4">
                        <div className="flex justify-between text-[10px] font-black mb-1">
                          <span className="text-gray-600">🔵 기관</span>
                          <span className={`font-mono ${oVal >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                            {oVal > 0 ? '+' : ''}{oVal.toLocaleString()}주
                          </span>
                        </div>
                        <div className="h-3 w-full bg-gray-200/50 rounded-full overflow-hidden relative flex">
                          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-400/80 z-10" /> {/* 0선 */}
                          {oVal < 0 ? (
                            <div 
                              className="h-full bg-gradient-to-l from-blue-400 to-blue-500 rounded-l-full absolute right-1/2" 
                              style={{ width: `${Math.min(50, Math.abs(oRatio) / 2)}%` }} 
                            />
                          ) : (
                            <div 
                              className="h-full bg-gradient-to-r from-red-400 to-red-500 rounded-r-full absolute left-1/2" 
                              style={{ width: `${Math.min(50, oRatio / 2)}%` }} 
                            />
                          )}
                        </div>
                        <div className="text-[8px] text-gray-400 font-bold mt-0.5 text-right flex justify-between items-center">
                          <span>
                            5일 누적 순매수 금액: <strong className={stockDetail.advanced.investor.organMoney5D >= 0 ? 'text-red-500' : 'text-blue-500'}>
                              {stockDetail.advanced.investor.organMoney5D !== undefined ? `${stockDetail.advanced.investor.organMoney5D > 0 ? '+' : ''}${stockDetail.advanced.investor.organMoney5D}억원` : '정보 없음'}
                            </strong>
                          </span>
                          <span>
                            기관 {stockDetail.advanced.investor.organConsecutiveDays}일 연속 순매수
                            {stockDetail.advanced.investor.organConsecutiveVolume > 0 && 
                              ` (총 ${stockDetail.advanced.investor.organConsecutiveVolume.toLocaleString()}주)`
                            }
                          </span>
                        </div>
                      </div>
 
                      {/* 🟢 개인 포지션 바 */}
                      <div className="mb-1">
                        <div className="flex justify-between text-[10px] font-black mb-1">
                          <span className="text-gray-600">🟢 개인(개미)</span>
                          <span className={`font-mono ${pVal >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                            {pVal > 0 ? '+' : ''}{pVal.toLocaleString()}주
                          </span>
                        </div>
                        <div className="h-3 w-full bg-gray-200/50 rounded-full overflow-hidden relative flex">
                          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-400/80 z-10" /> {/* 0선 */}
                          {pVal < 0 ? (
                            <div 
                              className="h-full bg-gradient-to-l from-blue-400 to-blue-500 rounded-l-full absolute right-1/2" 
                              style={{ width: `${Math.min(50, Math.abs(pRatio) / 2)}%` }} 
                            />
                          ) : (
                            <div 
                              className="h-full bg-gradient-to-r from-red-400 to-red-500 rounded-r-full absolute left-1/2" 
                              style={{ width: `${Math.min(50, pRatio / 2)}%` }} 
                            />
                          )}
                        </div>
                        <div className="text-[8px] text-gray-400 font-bold mt-0.5 text-right flex justify-between items-center">
                          <span>
                            5일 누적 순매수 금액: <strong className={stockDetail.advanced.investor.personalMoney5D >= 0 ? 'text-red-500' : 'text-blue-500'}>
                              {stockDetail.advanced.investor.personalMoney5D !== undefined ? `${stockDetail.advanced.investor.personalMoney5D > 0 ? '+' : ''}${stockDetail.advanced.investor.personalMoney5D}억원` : '정보 없음'}
                            </strong>
                          </span>
                          <span>
                            개인 {stockDetail.advanced.investor.personalConsecutiveDays}일 연속 순매수
                            {stockDetail.advanced.investor.personalConsecutiveVolume > 0 && 
                              ` (총 ${stockDetail.advanced.investor.personalConsecutiveVolume.toLocaleString()}주)`
                            }
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })() : (
                  <div className="py-5 text-center text-[10px] text-gray-500 font-bold bg-gray-50 border border-gray-100 rounded-xl mb-4 p-4 flex flex-col gap-2 justify-center items-center">
                    <span className="text-lg">⚠️</span>
                    <span className="leading-relaxed font-bold max-w-[280px]">
                      한국투자증권 OpenAPI 서버는 매일 장외 시간(특히 밤 11시 30분 ~ 새벽 시간대)이나 특정 점검 시간에 접속 시 rt_cd 에러를 뱉으며 수급 데이터를 돌려주지 않습니다.
                    </span>
                  </div>
                )}
 
                <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm mb-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[11px] font-black text-gray-600 uppercase tracking-wider">체결강도</span>
                    <span className="text-[10px] px-2.5 py-1 rounded-full font-black bg-emerald-50 text-emerald-600 border border-emerald-200">
                      {parseFloat(stockDetail.advanced?.strength) >= 100 ? '▲ 매수 우위' : '▼ 매도 우위'}
                    </span>
                  </div>
                  <div className="text-3xl font-black text-gray-900 font-mono mb-2">{stockDetail.advanced?.strength}<span className="text-base text-gray-400 font-bold">%</span></div>
                  <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
                    <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-300 z-10" />
                    <div className="h-full bg-emerald-400 rounded-full" style={{width: `${Math.min(parseFloat(stockDetail.advanced?.strength) || 0, 200)/2}%`}} />
                  </div>
                  <div className="pt-2.5 border-t border-gray-50 flex items-start gap-1">
                    <span className="text-xs text-emerald-500 font-bold">💡</span>
                    <p className="text-[10px] text-gray-500 leading-normal">
                      <strong>체결강도:</strong> 매수 체결량 대비 매도 체결량 비율(100% 기준). <strong>90% 이상</strong>일 때 대기 매수세가 살아있는 안전한 진입선으로 판단합니다.
                    </p>
                  </div>
                </div>
 
                <div className="grid grid-cols-2 gap-3">
                  {/* Card 1: 20일 이격도 */}
                  <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-black text-gray-500 uppercase">이격도 (20일)</span>
                        {stockDetail.advanced?.disparity20 !== undefined && stockDetail.advanced?.disparity20 !== '-' && (
                          <span className={`text-[8px] px-1.5 py-0.5 rounded font-black ${
                            parseFloat(stockDetail.advanced?.disparity20) > 106 
                              ? 'bg-red-50 text-red-600 border border-red-100' 
                              : parseFloat(stockDetail.advanced?.disparity20) >= 98 && parseFloat(stockDetail.advanced?.disparity20) <= 104
                                ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                : 'bg-gray-50 text-gray-600 border border-gray-100'
                          }`}>
                            {parseFloat(stockDetail.advanced?.disparity20) > 106 ? '단기 과열' : parseFloat(stockDetail.advanced?.disparity20) >= 98 && parseFloat(stockDetail.advanced?.disparity20) <= 104 ? '안정 수렴' : '관망/조정'}
                          </span>
                        )}
                      </div>
                      <div className="text-xl font-black text-gray-900 font-mono mt-1">
                        {stockDetail.advanced?.disparity20 !== undefined ? `${stockDetail.advanced.disparity20}%` : '-'}
                      </div>
                    </div>
                    <p className="text-[9px] text-gray-400 leading-normal mt-2 pt-2 border-t border-gray-50">
                      20일 이동평균선과 현재가의 괴리율. <strong>98%~104%</strong> 안정이 진입 적기이며, 106% 초과 시 리스크 관리가 필요합니다.
                    </p>
                  </div>
 
                  {/* Card 2: 공매도 비중 */}
                  <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-black text-gray-500 uppercase">공매도 비중</span>
                        {stockDetail.advanced?.shortRatio !== undefined && stockDetail.advanced?.shortRatio !== '-' && (
                          <span className={`text-[8px] px-1.5 py-0.5 rounded font-black ${
                            parseFloat(stockDetail.advanced?.shortRatio) >= 10 
                              ? 'bg-red-50 text-red-600 border border-red-100' 
                              : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                          }`}>
                            {parseFloat(stockDetail.advanced?.shortRatio) >= 10 ? '공매도 과열' : '공매도 안전'}
                          </span>
                        )}
                      </div>
                      <div className="text-xl font-black text-[#ff3d68] font-mono mt-1">
                        {stockDetail.advanced?.shortRatio !== undefined ? `${stockDetail.advanced.shortRatio}%` : '-'}
                      </div>
                    </div>
                    <p className="text-[9px] text-gray-400 leading-normal mt-2 pt-2 border-t border-gray-50">
                      당일 총 거래대금 대비 공매도 비중. <strong>10% 미만</strong>이 안전구간이며, 10% 초과 시 하방 압력이 강합니다.
                    </p>
                  </div>
 
                  {/* Card 3: 당일 거래대금 */}
                  <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-black text-gray-500 uppercase">당일 거래대금</span>
                        {stockDetail.advanced?.transactionValue !== undefined && (
                          <span className={`text-[8px] px-1.5 py-0.5 rounded font-black ${
                            stockDetail.advanced.transactionValue < 20000000000 
                              ? 'bg-amber-50 text-amber-600 border border-amber-100' 
                              : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                          }`}>
                            {stockDetail.advanced.transactionValue < 20000000000 ? '소외주 (VETO)' : '거래 활발'}
                          </span>
                        )}
                      </div>
                      <div className="text-xl font-black text-gray-900 font-mono mt-1">
                        {stockDetail.advanced?.transactionValue !== undefined 
                          ? `${Math.round(stockDetail.advanced.transactionValue / 100000000).toLocaleString()}억원` 
                          : '-'}
                      </div>
                    </div>
                    <p className="text-[9px] text-gray-400 leading-normal mt-2 pt-2 border-t border-gray-50">
                      당일 시장에서 거래된 총 대금. 기관/외인의 원활한 진입을 위해 <strong>200억원 이상</strong> 우량 유동성이 필수적입니다.
                    </p>
                  </div>
 
                  {/* Card 4: 신용잔고율 */}
                  <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-black text-gray-500 uppercase">신용잔고율</span>
                        {stockDetail.advanced?.creditBalance !== undefined && (
                          <span className={`text-[8px] px-1.5 py-0.5 rounded font-black ${
                            parseFloat(stockDetail.advanced.creditBalance) > 6 
                              ? 'bg-red-50 text-red-600 border border-red-100' 
                              : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                          }`}>
                            {parseFloat(stockDetail.advanced.creditBalance) > 6 ? '경고 (VETO)' : '레버리지 안전'}
                          </span>
                        )}
                      </div>
                      <div className="text-xl font-black text-gray-900 font-mono mt-1">
                        {stockDetail.advanced?.creditBalance !== undefined 
                          ? `${stockDetail.advanced.creditBalance}%` 
                          : '-'}
                      </div>
                    </div>
                    <p className="text-[9px] text-gray-400 leading-normal mt-2 pt-2 border-t border-gray-50">
                      자기자본 대비 신용 융자 비율. <strong>6% 초과</strong>인 종목은 반대매매 리스크와 매물 폭탄 우려로 투자 대상에서 즉각 배제됩니다.
                    </p>
                  </div>
                </div>
              </div>

               <div className="mt-6 border-t border-gray-100 pt-6">
                <div className="text-[11px] font-bold text-gray-500 mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-3 bg-[#7000ff] rounded-full"></div>
                    최근 실적 추이 <span className="text-[9px] text-gray-400 font-normal">(억 원)</span>
                  </div>
                  <div className="flex items-center gap-3 text-[9px] font-bold">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-[#7000ff] inline-block"></span>
                      <span className="text-gray-600">매출액</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-[#00ffab] inline-block"></span>
                      <span className="text-gray-600">영업이익</span>
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-50/30 rounded-xl p-2 mt-2" style={{ height: '160px', position: 'relative' }}>
                  {stockDetail.finance && stockDetail.finance.length > 0 ? (
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={stockDetail.finance} margin={{top: 10, right: 10, left: 10, bottom: 5}}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="year" fontSize={9} tickLine={false} axisLine={false} tick={{fill: '#94a3b8'}} />
                        <YAxis hide />
                        <Tooltip 
                          contentStyle={{fontSize: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                          formatter={(val) => [`₩${Math.round(val/1000).toLocaleString()}k`, '']}
                        />
                        <Bar name="매출" dataKey="revenue" fill="#7000ff" radius={[2, 2, 0, 0]} barSize={20} />
                        <Bar name="영익" dataKey="profit" fill="#00ffab" radius={[2, 2, 0, 0]} barSize={20} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <div className="h-full flex items-center justify-center text-gray-400 text-[10px]">재무 차트 데이터 없음</div>}
                </div>
              </div>
            </div>
          )}

          {loadingDetail && (
            <div className="mt-6 border-t border-gray-100 pt-6 flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-6 h-6 border-2 border-[#7000ff] border-t-transparent rounded-full animate-spin"></div>
              <div className="text-xs font-bold text-gray-400">분석 중...</div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default StockPopup;
