import React, { useState, useEffect } from 'react';
import { TrendingUp, Bell, Wallet, Activity, ChartLine } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { INITIAL_STOCKS } from './data/stocks';

const App = () => {
  const [stocks, setStocks] = useState(INITIAL_STOCKS);
  const [alerts, setAlerts] = useState([]);
  const [selectedMarket, setSelectedMarket] = useState('ALL');
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  
  // Dashboard Tabs State
  const [foreignTab, setForeignTab] = useState(0);
  const [instTab, setInstTab] = useState(0);
  const [topTab, setTopTab] = useState(0);
  const [rightTab, setRightTab] = useState(0);
  const [chartIndex, setChartIndex] = useState(0);
  const [timeRange, setTimeRange] = useState('1M');
  const chartSymbols = ['KOSPI', 'KOSDAQ', 'KOSPI200'];

  // Popup Modal State
  const [popupItem, setPopupItem] = useState(null);
  const [popupHistory, setPopupHistory] = useState([]);
  const [loadingPopup, setLoadingPopup] = useState(false);
  const [popupRange, setPopupRange] = useState('1M');
  const [aiSignal, setAiSignal] = useState(null);
  const [aiHistory, setAiHistory] = useState([]);
  const [loadingHistoryData, setLoadingHistoryData] = useState(false);

  const handleOpenPopup = (name, price, change) => {
    setPopupItem({ name, price: price || '10,000', change: change || '0%' });
    setPopupRange('1M');
  };

  // Fetch Dashboard Live Data
  useEffect(() => {
    let isMounted = true;
    const fetchDashboard = () => {
      fetch('/api/dashboard')
        .then(res => res.json())
        .then(data => { if(isMounted) setDashboardData(data); })
        .catch(e => console.error('대시보드 데이터 로드 실패', e));
        
      fetch('/api/ai-signal')
        .then(res => res.json())
        .then(aiData => { if(isMounted) setAiSignal(aiData); })
        .catch(e => console.error('AI 시그널 로드 실패', e));

      fetch('/api/ai-history')
        .then(res => res.json())
        .then(data => { if(isMounted) setAiHistory(Array.isArray(data) ? data : []); })
        .catch(e => console.error('AI 히스토리 로드 실패', e));
    };
    
    fetchDashboard();
    
    // 15초마다 자동 갱신
    const interval = setInterval(fetchDashboard, 15000);
    return () => { clearInterval(interval); isMounted = false; };
  }, []);

  // Fetch History for Chart
  useEffect(() => {
    let isMounted = true;
    setLoadingHistory(true);
    const fetchHistory = async () => {
      try {
        const response = await fetch(`/api/history/${chartSymbols[chartIndex]}?range=${timeRange}`);
        const data = await response.json();
        if(isMounted) {
          // Add dummy padding if short
          if (Array.isArray(data)) {
            if (data.length > 0 && data.length < 3) data.push(...data);
            setHistory(data);
          } else {
             console.error('Invalid chart data:', data);
          }
        }
      } catch (e) {
        console.error('차트 데이터 로드 실패', e);
      } finally {
        if(isMounted) setLoadingHistory(false);
      }
    };
    fetchHistory();
    return () => { isMounted = false; };
  }, [chartIndex, timeRange]);

  // Fetch Popup Chart Data
  useEffect(() => {
    if(!popupItem) return;
    let isMounted = true;
    setLoadingPopup(true);
    const fetchPopupHistory = async () => {
      try {
        const response = await fetch(`/api/history/${encodeURIComponent(popupItem.name)}?price=${encodeURIComponent(popupItem.price)}&range=${popupRange}`);
        const data = await response.json();
        if(isMounted && Array.isArray(data)) {
           if(data.length > 0 && data.length < 3) data.push(...data);
           setPopupHistory(data);
        }
      } catch(e) {
        console.error('팝업 차트 로드 실패', e);
      } finally {
        if(isMounted) setLoadingPopup(false);
      }
    };
    fetchPopupHistory();
    return () => { isMounted = false; };
  }, [popupItem, popupRange]);
  
  // Real-time KIS API Integration
  useEffect(() => {
    const fetchStocks = async () => {
      try {
        const updatedStocks = await Promise.all(stocks.map(async (stock) => {
          if (stock.market !== 'KR') return stock; // KR 위주로 시범 운영
          try {
            const response = await fetch(`/api/stock/${stock.symbol}`);
            const data = await response.json();
            
            if (data.price) {
              const currentLoss = stock.purchasePrice ? ((data.price - stock.purchasePrice) / stock.purchasePrice) * 100 : 0;
              
              // 5% 손절 알림 트리거
              if (stock.isOwned && currentLoss <= -5) {
                triggerAlertOnce(stock.id, `${stock.name} 위험! 평단가 대비 -5% 도달!`, 'urgent');
              }
              
              // 급등 알림 (3% 이상 상승 시)
              if (data.change >= 3) {
                triggerAlertOnce(`gainer-${stock.id}`, `${stock.name} 급등 포착! (${data.change}%)`, 'info');
              }

              return { ...stock, price: data.price, change: data.change };
            }
            return stock;
          } catch (e) {
            console.error(`${stock.name} 페칭 실패`, e);
            return stock;
          }
        }));
        setStocks(updatedStocks);
      } catch (err) {
        console.error('API 연동 에러:', err);
      }
    };

    fetchStocks(); // 초기 실행
    const interval = setInterval(fetchStocks, 10000); // 10초마다 갱신 (KIS 서버 부하 방지용)

    return () => clearInterval(interval);
  }, []);

  const triggerAlertOnce = (id, message, severity) => {
    setAlerts(prev => {
      if (prev.some(a => a.id === id)) return prev;
      const newAlert = { id, message, severity };
      setTimeout(() => {
        setAlerts(current => current.filter(a => a.id !== id));
      }, 5000);
      return [newAlert, ...prev].slice(0, 5);
    });
  };

  const filteredStocks = stocks.filter(s => 
    selectedMarket === 'ALL' || s.market === selectedMarket
  );

  const gainers = filteredStocks.filter(s => s.change > 2).sort((a, b) => (b.change || 0) - (a.change || 0));
  const portfolio = stocks.filter(s => s.isOwned);

  return (
    <div className="min-h-screen p-6 md:p-12 relative flex flex-col">
      {/* Background Glows */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-purple-600/10 blur-[120px] rounded-full -z-10" />
      <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-emerald-600/10 blur-[120px] rounded-full -z-10" />

      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12">
        <div className="relative">
          <div className="absolute -top-4 -left-4 w-12 h-12 bg-purple-500/20 blur-xl rounded-full" />
          <h1 className="text-5xl font-black mb-1 tracking-tighter text-white uppercase italic">
            Stock<span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-500 [text-shadow:0_0_20px_rgba(168,85,247,0.4)]">Master</span> AI
          </h1>
          <p className="text-white/40 text-xs font-black tracking-widest uppercase ml-1 animate-pulse">Advanced Quantum Terminal System v4.0</p>
        </div>
        
        <div className="flex gap-4 mt-8 md:mt-0 items-center">
          <div className="flex p-1.5 glass-card bg-white/[0.03] border-white/5 rounded-2xl">
            {['ALL', 'KR', 'US'].map(m => (
              <button
                key={m}
                onClick={() => setSelectedMarket(m)}
                className={`px-8 py-2.5 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest ${
                  selectedMarket === m 
                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-[0_0_20px_rgba(147,51,234,0.3)] border border-white/20' 
                    : 'text-white/30 hover:text-white hover:bg-white/5'
                }`}
              >
                {m === 'ALL' ? 'Global' : m === 'KR' ? 'KOSPI' : 'NASDAQ'}
              </button>
            ))}
          </div>
        </div>
      </header>
      
      {/* AI 기술 가이드 카드 (가시성 강화) */}
      <div className="bg-gradient-to-r from-blue-900/40 via-purple-900/40 to-blue-900/40 border border-blue-500/30 rounded-xl p-5 mb-4 shadow-[0_0_20px_rgba(59,130,246,0.1)]">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-2 h-2 bg-blue-400 rounded-full animate-ping"></div>
          <span className="text-blue-300 font-bold text-xs tracking-widest uppercase">System Architecture Guide</span>
        </div>
        <p className="text-white text-[15px] sm:text-[17px] font-medium leading-relaxed">
          본 시스템은 <span className="text-blue-400 font-bold">네이버 실시간 뉴스</span>를 초고속 크롤링하여, <span className="text-purple-400 font-bold">Google Gemini AI</span>가 1시간 단위로 시장 문맥을 분석합니다.  
          특히 AI가 작성한 <span className="text-green-400 font-bold">과거 오답노트(RAG)</span>를 실시간 참조하여, 시간이 지날수록 예측 정확도를 스스로 높이는 <span className="bg-blue-600/30 px-1 rounded text-white font-bold italic">In-Context Learning</span> 기술이 완벽히 적용되어 있습니다.
        </p>
      </div>

        {/* AI 멀티 에이전트 퀀트 시스템 리포트 */}
        <section className="glass-card border-blue-500/20 bg-blue-900/10 rounded-2xl overflow-hidden font-sans relative mb-6">
          {/* Background Glow */}
          <div className="absolute top-[-20%] right-[-10%] w-80 h-80 bg-blue-500/10 rounded-full blur-[120px] pointer-events-none"></div>
          
          <div className="p-5 relative z-10">
            <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <span className="text-[26px]">🧠</span> AI 매매 시나리오 및 추천 종목
              </h2>
              {aiSignal && (
                <div className="bg-[#21a14c]/20 text-[#00ffab] text-[10px] sm:text-[11px] font-bold px-3 py-1 rounded-full border border-[#21a14c]/30 flex items-center gap-1.5 animate-pulse shadow-[0_0_10px_rgba(0,255,171,0.2)]">
                  <div className="w-1.5 h-1.5 bg-[#00ffab] rounded-full"></div> Live Update : {aiSignal.time}
                </div>
              )}
            </div>

            {aiSignal ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {/* Vertex AI */}
                  <div className="bg-white/5 rounded-xl border border-white/10 p-4 hover:bg-white/10 transition-all group">
                    <div className="text-[#a4b1cd] text-xs font-bold mb-2 flex items-center gap-1.5 uppercase tracking-widest">
                      <span>📊</span> 주도주 테마 예측 (Vertex AI)
                    </div>
                    <div className="text-white font-black text-lg flex justify-between items-end">
                      <span className="truncate pr-2">{aiSignal.data?.theme || '분석 중...'} <span className="text-[#ff3d68] text-[10px] font-bold bg-[#ff3d68]/15 px-2 py-0.5 rounded border border-[#ff3d68]/30 align-text-bottom ml-1 uppercase">Strong Buy</span></span>
                      <span className="text-gray-400 text-[10px] whitespace-nowrap">PROB. <span className="font-black text-[#00ffab] text-sm ml-0.5">{aiSignal.data?.themeProb || '??%'}</span></span>
                    </div>
                  </div>

                  {/* Gemini AI */}
                  <div className="bg-white/5 rounded-xl border border-white/10 p-4 hover:bg-white/10 transition-all group">
                    <div className="text-[#a4b1cd] text-xs font-bold mb-2 flex items-center gap-1.5 uppercase tracking-widest">
                      <span>✨</span> Top Pick 추천 종목 (Gemini AI)
                    </div>
                    <div className="text-white font-black text-lg flex items-center gap-2">
                      <span className="text-[22px]">📍</span> <span className="text-blue-300 underline underline-offset-4 decoration-blue-500/50 cursor-pointer hover:text-blue-400 transition-colors">{aiSignal.data?.stock || 'AI 연산 중'}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                  {/* Reason */}
                  <div className="bg-[#151c2c] rounded-xl border border-gray-700/50 p-4 relative overflow-hidden group h-full">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#ff3d68] group-hover:w-1.5 transition-all"></div>
                    <div className="text-gray-400 text-[10px] font-black mb-2 uppercase tracking-tighter italic">■ 실시간 AI 텍스트 분석 근거</div>
                    <p className="text-gray-200 text-sm leading-relaxed font-medium">
                      {aiSignal.data?.reason || '시장 데이터를 분석 중입니다...'}
                    </p>
                  </div>

                  {/* Feedback Loop */}
                  <div className="bg-[#151c2c]/80 rounded-xl border border-gray-700/50 p-4 relative overflow-hidden group h-full">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#0a6fe8] group-hover:w-1.5 transition-all"></div>
                    <div className="text-[#8e9ab2] text-[10px] font-black mb-2 flex items-center gap-1.5 uppercase tracking-tighter italic">
                     <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                      In-Context Learning 전략 로그
                    </div>
                    <p className="text-[#a4b1cd] text-[12px] leading-relaxed">
                      {aiSignal.data?.feedback || '분석 중입니다...'}
                    </p>
                  </div>
                </div>
              </>
            ) : (
                <div className="py-12 text-center">
                    <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-white/40 text-sm font-bold animate-pulse">AI 분석 데이터를 생성하는 중입니다...</p>
                </div>
            )}

            {/* AI 추천 테이블 (히스토리) - 복구 및 강화됨 */}
            <div className="mt-4 border-t border-white/5 pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black text-white/60 flex items-center gap-2 uppercase tracking-[2px]">
                  <Activity size={14} className="text-blue-500" /> AI Recommendation Archive (RAG Diary)
                </h3>
                <span className="text-[10px] text-white/20 font-bold uppercase tabular-nums">{aiHistory.length}/24 Records</span>
              </div>
              
              <div className="overflow-x-auto rounded-xl border border-white/5 bg-black/20">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="text-white/30 text-[9px] uppercase tracking-widest bg-white/[0.02] border-b border-white/5">
                      <th className="p-4 font-black">Analysis Time</th>
                      <th className="p-4 font-black text-blue-400">Target Theme</th>
                      <th className="p-4 font-black text-purple-400">Top Pick</th>
                      <th className="p-4 font-black">Theme Prob.</th>
                      <th className="p-4 font-black w-1/3">Core Context</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.03]">
                    {aiHistory.length > 0 ? (
                      aiHistory.map((item, i) => (
                        <tr key={i} className="hover:bg-white/[0.03] transition-colors group">
                          <td className="p-4 text-white/40 font-mono text-[10px]">{new Date(item.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                          <td className="p-4 text-white font-bold group-hover:text-blue-400 transition-colors">{item.prediction?.theme?.split('(')[0] || 'Theme N/A'}</td>
                          <td className="p-4">
                            <span className="px-2 py-1 rounded bg-blue-600/10 border border-blue-500/20 text-blue-300 font-black text-[10px]">
                              {item.prediction?.stock || '-'}
                            </span>
                          </td>
                          <td className="p-4 text-[#00ffab] font-black">{item.prediction?.themeProb || '-'}</td>
                          <td className="p-4 text-white/40 text-[11px] leading-relaxed line-clamp-1 group-hover:line-clamp-none transition-all duration-300">
                             {item.prediction?.reason?.substring(0, 80) || '-'}...
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" className="p-8 text-center text-white/20 italic font-medium">데이터가 충분하지 않습니다. 뉴스 분석 대기 중...</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </section>

      {/* Market Trend Chart (Premium Neon Dark Style) */}
      <section className="mb-8 glass-card border-white/5 overflow-hidden relative group">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-600/5 to-transparent pointer-events-none"></div>
        
        {/* Top Indices Navigation */}
        <div className="flex border-b border-white/5 items-stretch">
          {['코스피', '코스닥', '코스피200'].map((name, idx) => (
            <div 
              key={idx}
              onClick={() => setChartIndex(idx)} 
              className={`flex-1 p-5 cursor-pointer transition-all relative flex flex-col items-center justify-center border-r border-white/5 last:border-r-0 ${
                chartIndex === idx ? 'bg-white/5' : 'hover:bg-white/[0.02]'
              }`}
            >
              <div className={`text-xs font-bold tracking-widest mb-1 ${chartIndex === idx ? 'text-blue-400' : 'text-white/40'}`}>
                {name}
              </div>
              <div className="text-2xl font-black text-white flex items-baseline gap-1.5">
                {idx === 0 ? '5,781.20' : idx === 1 ? '1,161.52' : '862.50'}
                <span className="text-[10px] text-white/30 font-medium">INDEX</span>
              </div>
              <div className={`text-xs font-black flex items-center gap-1 mt-1 ${idx === 2 ? 'text-white/40' : 'text-[#00ffab]'}`}>
                {idx === 2 ? '● 0.00%' : `▲ ${idx === 0 ? '17.98' : '18.04'} (${idx === 0 ? '+0.31%' : '+1.58%'})`}
              </div>
              
              {chartIndex === idx && (
                <motion.div 
                  layoutId="activeTab" 
                  className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-purple-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]"
                />
              )}
            </div>
          ))}
        </div>

        {/* Chart Area */}
        <div className="p-6 relative">
          {/* Legend & Controls */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div className="flex flex-wrap items-center gap-4 text-[11px] font-bold text-white/50">
              <div className="flex items-center gap-2 px-2 py-1 bg-white/5 rounded border border-white/5">
                {chartSymbols[chartIndex]}
              </div>
              <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-[#ff862e] rounded-full shadow-[0_0_8px_rgba(255,134,46,0.3)]"></div> 개인 <span className="text-[#ff3d68]">+22,238억</span></div>
              <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-[#2db400] rounded-full shadow-[0_0_8px_rgba(45,180,0,0.3)]"></div> 외국인 <span className="text-[#0a6fe8]">-12,402억</span></div>
              <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-[#0958d9] rounded-full shadow-[0_0_8px_rgba(9,88,217,0.3)]"></div> 기관 <span className="text-[#0a6fe8]">-10,268억</span></div>
            </div>
            
            <div className="flex items-center gap-1 p-1 bg-white/5 rounded-lg border border-white/5">
               {['1W', '1M', '1Y'].map((rangeStr, idx) => (
                 <button 
                  key={idx} 
                  onClick={() => setTimeRange(rangeStr)}
                  className={`px-4 py-1.5 rounded-md text-[10px] font-bold transition-all ${
                    timeRange === rangeStr 
                      ? 'bg-blue-600 text-white shadow-lg' 
                      : 'text-white/40 hover:text-white/60'
                  }`}
                 >
                   {rangeStr === '1W' ? '1주' : rangeStr === '1M' ? '1달' : '1년'}
                 </button>
               ))}
            </div>
          </div>

          <div className="h-[280px] w-full pr-4 pb-2">
            {!loadingHistory ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history}>
                  <defs>
                    <linearGradient id="colorNaverPrice" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00ffab" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#00ffab" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" stroke="rgba(255,255,255,0.2)" fontSize={10} tickLine={false} axisLine={false}  dy={10} minTickGap={30} />
                  <YAxis domain={['auto', 'auto']} fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => Math.round(val).toLocaleString()} stroke="rgba(255,255,255,0.2)" orientation="right" width={50} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1a1f2b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '11px', color: 'white' }}
                    itemStyle={{ color: '#00ffab', fontBold: true }}
                    labelStyle={{ color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="price" 
                    stroke="#00ffab" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorNaverPrice)" 
                    animationDuration={1500}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm font-bold animate-pulse">차트 데이터를 불러오는 중...</div>
            )}
          </div>
        </div>

        {/* Bottom Market Snap (Modernized) */}
        <div className="flex flex-col lg:flex-row border-t border-white/5 bg-white/[0.02] divide-y lg:divide-y-0 lg:divide-x divide-white/5">
          <div className="flex-1 p-5 px-8 flex flex-col sm:flex-row items-center gap-6">
            <div className="uppercase text-[10px] font-black text-white/30 tracking-[4px] sm:rotate-180 sm:[writing-mode:vertical-lr] mb-2 sm:mb-0">Volatility</div>
            <div className="flex-1 grid grid-cols-5 gap-2 w-full">
              {[
                { label: '상한', val: 5, color: '#ff3d68' },
                { label: '상승', val: 245, color: '#ff3d68' },
                { label: '보합', val: 23, color: 'white' },
                { label: '하락', val: 159, color: '#0a6fe8' },
                { label: '하한', val: 0, color: '#0a6fe8' }
              ].map((it, i) => (
                <div key={i} className="flex flex-col items-center p-2 rounded-lg bg-white/5 border border-white/5">
                  <span className="text-[10px] text-white/30 font-bold mb-1">{it.label}</span>
                  <span className="text-sm font-black" style={{ color: it.color }}>{it.val}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex-1 p-5 px-8 flex flex-col sm:flex-row items-center gap-6">
            <div className="uppercase text-[10px] font-black text-white/30 tracking-[4px] sm:rotate-180 sm:[writing-mode:vertical-lr] mb-2 sm:mb-0">Program</div>
            <div className="flex-1 grid grid-cols-3 gap-3 w-full">
               {[
                 { label: '차익', val: '+447억', gain: true },
                 { label: '비차익', val: '-17,850억', gain: false },
                 { label: '전체합계', val: '-17,402억', gain: false }
               ].map((it, i) => (
                 <div key={i} className="flex flex-col items-center p-2 rounded-lg bg-white/5 border border-white/5">
                    <span className="text-[10px] text-white/30 font-bold mb-1">{it.label}</span>
                    <span className={`text-xs font-black ${it.gain ? 'text-[#ff3d68]' : 'text-[#0a6fe8]'}`}>{it.val}</span>
                 </div>
               ))}
            </div>
          </div>
        </div>
      </section>

      {/* Main Grid (Premium Global Financial Terminal Style) */}
      <main className="flex flex-col xl:flex-row gap-6 mb-20 font-sans">
        
        {/* Left & Center Main Column */}
        <div className="flex-1 flex flex-col gap-6">
          
          {/* Row 1: 업종 & 테마 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 업종별 시세 */}
            <div className="glass-card border-white/5 overflow-hidden">
              <div className="flex justify-between items-center p-4 border-b border-white/5 bg-white/[0.02]">
                <h3 className="font-bold text-white/80 text-sm flex items-center gap-2">
                  <div className="w-1 h-3 bg-blue-500 rounded-full"></div> 업종별 시세
                </h3>
                <span className="text-[10px] text-white/40 cursor-pointer font-bold tracking-tighter hover:text-white transition-colors uppercase">Real-time +</span>
              </div>
              <div className="p-4">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="text-white/30 text-[10px] uppercase tracking-widest">
                        <th className="pb-3 font-black text-left px-2">Sector Name</th>
                        <th className="pb-3 font-black text-right px-2">Change</th>
                        <th className="pb-3 font-black text-left px-2 pl-6">Weight</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.03]">
                    {(dashboardData?.sectors?.length ? dashboardData.sectors : [
                      { name: '에너지장비및서비스', change: '+9.07%', width: '100%' },
                      { name: '건설', change: '+7.12%', width: '78%' },
                      { name: '무역회사와판매업체', change: '+6.98%', width: '76%' },
                      { name: '식품과기본식료품소매', change: '+4.95%', width: '54%' },
                      { name: '가스유틸리티', change: '+4.57%', width: '50%' },
                      { name: '건축제품', change: '+4.54%', width: '50%' },
                      { name: '조선', change: '+4.29%', width: '47%' },
                      { name: '상업서비스와공급품', change: '+4.15%', width: '45%' },
                      { name: '독립전력생산및에너지', change: '+4.02%', width: '44%' },
                      { name: '제약', change: '+3.95%', width: '43%' },
                    ]).slice(0, 10).map((item, i) => (
                      <tr key={i} onClick={() => handleOpenPopup(item.name, '5000', item.change)} className="hover:bg-white/[0.03] group transition-all cursor-pointer">
                        <td className="py-3 text-left px-2 text-white/80 font-bold group-hover:text-blue-400 transition-colors uppercase tracking-tight">{item.name}</td>
                        <td className="py-3 text-[#00ffab] font-black text-right px-2 font-mono tabular-nums">{item.change}</td>
                        <td className="py-3 px-2 pl-6">
                          <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.5)]" style={{ width: item.width }}></div>
                          </div>
                        </td>
                      </tr>
                    ))}
                    </tbody>
                  </table>
              </div>
            </div>

            {/* 테마별 시세 */}
            <div className="glass-card border-white/5 overflow-hidden">
              <div className="flex justify-between items-center p-4 border-b border-white/5 bg-white/[0.02]">
                 <h3 className="font-bold text-white/80 text-sm flex items-center gap-2">
                  <div className="w-1 h-3 bg-purple-500 rounded-full"></div> 테마별 분석
                </h3>
                <span className="text-[10px] text-white/40 cursor-pointer font-bold tracking-tighter hover:text-white transition-colors uppercase">Insight +</span>
              </div>
              <div className="p-4">
                <table className="w-full text-xs border-collapse">
                  <thead className="text-white/30 text-[10px] uppercase tracking-widest">
                    <tr>
                      <th className="pb-3 font-black text-left px-2">Theme</th>
                      <th className="pb-3 font-black text-right px-2">Chg</th>
                      <th className="pb-3 font-black text-right px-2">Leader</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.03]">
                    {(dashboardData?.themes?.length ? dashboardData.themes : [
                      { name: '2026 상반기 신규상장', change: '+34.05%', lead: '아이엠바이오..' },
                      { name: '건설 대표주', change: '+13.57%', lead: 'DL이앤씨' },
                      { name: '면역항암제', change: '+11.05%', lead: '아이엠바이오..' },
                      { name: '모듈러주택', change: '+9.88%', lead: '한신공영' },
                      { name: '원자력발전', change: '+8.92%', lead: '서전기전' },
                      { name: '건설 중소형', change: '+8.68%', lead: '한신공영' },
                      { name: '우크라이나 재건', change: '+8.54%', lead: '현대에버다임' },
                      { name: '방위산업/전쟁', change: '+8.12%', lead: '한화에어로스..' },
                      { name: '전력설비', change: '+7.65%', lead: 'LS ELECTRIC' },
                      { name: '조선기자재', change: '+7.41%', lead: '태웅' },
                    ]).slice(0, 10).map((item, i) => (
                      <tr key={i} onClick={() => handleOpenPopup(item.name, '10000', item.change)} className="hover:bg-white/[0.03] group transition-all cursor-pointer">
                        <td className="py-3 text-left px-2 text-white/80 font-bold group-hover:text-purple-400 transition-colors">{item.name}</td>
                        <td className="py-3 text-[#ff3d68] font-black text-right px-2 font-mono tabular-nums">{item.change}</td>
                        <td className="py-3 text-right px-2">
                           <span className="bg-white/5 border border-white/5 py-1 px-2 rounded-md text-white/50 text-[10px] group-hover:text-white transition-colors font-bold uppercase tracking-tighter italic">
                             {item.lead}
                           </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Row 2: 외국인/기관 순매수 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 외국인 */}
            <div className="glass-card border-white/5 overflow-hidden">
              <div className="flex items-center text-[10px] font-black border-b border-white/5 bg-white/[0.02] px-2 pt-2 gap-1 rounded-t">
                <div onClick={() => setForeignTab(0)} className={`px-4 py-2 cursor-pointer transition-all ${foreignTab === 0 ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 border-b-0 rounded-t-lg' : 'text-white/30 hover:text-white/60 tracking-tighter'}`}>NET BUY</div>
                <div onClick={() => setForeignTab(1)} className={`px-4 py-2 cursor-pointer transition-all ${foreignTab === 1 ? 'bg-red-600/20 text-red-400 border border-red-500/30 border-b-0 rounded-t-lg' : 'text-white/30 hover:text-white/60 tracking-tighter'}`}>NET SELL</div>
                <div className="ml-auto text-white/20 font-light pr-2 tracking-widest uppercase">Foreign</div>
              </div>
              <div className="p-4">
                <table className="w-full text-xs text-right border-collapse">
                  <tbody className="divide-y divide-white/[0.03]">
                    {(dashboardData?.foreign?.[foreignTab]?.length ? dashboardData.foreign[foreignTab] : (
                      foreignTab === 0 ? [
                        { num: '01', name: '두산에너빌리티', price: '109,600', diff: '3,300', isUp: true },
                        { num: '02', name: '삼천당제약', price: '907,000', diff: '112,000', isUp: true },
                        { num: '03', name: '주성엔지니어링', price: '72,800', diff: '11,800', isUp: true },
                        { num: '04', name: '대한항공', price: '26,350', diff: '1,800', isUp: true },
                        { num: '05', name: '한미반도체', price: '309,500', diff: '2,500', isUp: true },
                        { num: '06', name: '삼성생명', price: '231,500', diff: '1,000', isUp: true },
                        { num: '07', name: '한화오션', price: '45,200', diff: '1,500', isUp: true },
                        { num: '08', name: '카카오', price: '53,100', diff: '1,100', isUp: true },
                        { num: '09', name: '알테오젠', price: '358,000', diff: '21,000', isUp: true },
                        { num: '10', name: '현대로템', price: '72,300', diff: '3,400', isUp: true },
                      ] : [
                        { num: '01', name: 'SK하이닉스', price: '1,007,000', diff: '6,000', isUp: false },
                        { num: '02', name: '삼성전자', price: '64,300', diff: '1,200', isUp: false },
                        { num: '03', name: '현대차', price: '243,500', diff: '4,500', isUp: false },
                        { num: '04', name: '기아', price: '112,400', diff: '1,500', isUp: false },
                        { num: '05', name: 'LG화학', price: '320,000', diff: '8,000', isUp: false },
                        { num: '06', name: 'POSCO홀딩스', price: '381,000', diff: '5,000', isUp: false },
                        { num: '07', name: 'NAVER', price: '201,000', diff: '3,000', isUp: false },
                        { num: '08', name: 'KB금융', price: '86,400', diff: '1,200', isUp: false },
                        { num: '09', name: '신한지주', price: '54,200', diff: '800', isUp: false },
                        { num: '10', name: '셀트리온', price: '182,500', diff: '2,500', isUp: false },
                      ]
                    )).slice(0, 10).map((item, i) => (
                      <tr key={i} onClick={() => handleOpenPopup(item.name, item.price, item.diff)} className="hover:bg-white/[0.03] transition-colors cursor-pointer group">
                        <td className="py-2.5 text-center w-8">
                          <span className="text-[10px] text-white/30 font-bold group-hover:text-blue-400">{item.num}</span>
                        </td>
                        <td className="py-2.5 text-left text-white/80 font-bold px-2 group-hover:text-white transition-colors">{item.name}</td>
                        <td className="py-2.5 text-right font-black text-white px-2 font-mono tabular-nums">{item.price}</td>
                        <td className={`py-2.5 text-right font-black px-2 font-mono ${item.isUp === true ? 'text-[#00ffab]' : item.isUp === false ? 'text-[#0a6fe8]' : 'text-white/20'}`}>
                          {item.isUp === true ? '▲' : item.isUp === false ? '▼' : '●'} {item.diff}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            {/* 기관 */}
            {/* 기관 */}
            <div className="glass-card border-white/5 overflow-hidden">
              <div className="flex items-center text-[10px] font-black border-b border-white/5 bg-white/[0.02] px-2 pt-2 gap-1 rounded-t">
                <div onClick={() => setInstTab(0)} className={`px-4 py-2 cursor-pointer transition-all ${instTab === 0 ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30 border-b-0 rounded-t-lg' : 'text-white/30 hover:text-white/60 tracking-tighter'}`}>NET BUY</div>
                <div onClick={() => setInstTab(1)} className={`px-4 py-2 cursor-pointer transition-all ${instTab === 1 ? 'bg-red-600/20 text-red-400 border border-red-500/30 border-b-0 rounded-t-lg' : 'text-white/30 hover:text-white/60 tracking-tighter'}`}>NET SELL</div>
                <div className="ml-auto text-white/20 font-light pr-2 tracking-widest uppercase">Institution</div>
              </div>
              <div className="p-4">
                <table className="w-full text-xs text-right border-collapse">
                  <tbody className="divide-y divide-white/[0.03]">
                    {(dashboardData?.inst?.[instTab]?.length ? dashboardData.inst[instTab] : (
                      instTab === 0 ? [
                        { num: '01', name: 'SK하이닉스', price: '1,007,000', diff: '6,000', isUp: false },
                        { num: '02', name: 'KODEX 코스닥150레버리지', price: '17,430', diff: '530', isUp: true },
                        { num: '03', name: '두산에너빌리티', price: '109,600', diff: '3,300', isUp: true },
                        { num: '04', name: 'KODEX 200선물인버스2X', price: '249', diff: '0', isUp: null },
                        { num: '05', name: 'KODEX 코스닥150', price: '20,090', diff: '305', isUp: true },
                        { num: '06', name: '삼성전자우', price: '139,200', diff: '5,000', isUp: false },
                        { num: '07', name: 'LG디스플레이', price: '12,500', diff: '400', isUp: true },
                        { num: '08', name: '한국전력', price: '24,100', diff: '800', isUp: true },
                        { num: '09', name: 'HD현대중공업', price: '154,000', diff: '4,500', isUp: true },
                        { num: '10', name: '현대건설', price: '36,200', diff: '1,200', isUp: true },
                      ] : [
                        { num: '01', name: 'LG에너지솔루션', price: '385,500', diff: '12,000', isUp: false },
                        { num: '02', name: 'NAVER', price: '201,000', diff: '3,000', isUp: false },
                        { num: '03', name: '카카오', price: '53,100', diff: '1,100', isUp: false },
                        { num: '04', name: '엔씨소프트', price: '210,500', diff: '4,500', isUp: false },
                        { num: '05', name: 'LG화학', price: '320,000', diff: '8,000', isUp: false },
                        { num: '06', name: '하나금융지주', price: '62,100', diff: '900', isUp: false },
                        { num: '07', name: '삼성전기', price: '142,500', diff: '2,500', isUp: false },
                        { num: '08', name: 'LG전자', price: '98,200', diff: '1,500', isUp: false },
                        { num: '09', name: 'SK이노베이션', price: '115,400', diff: '2,100', isUp: false },
                        { num: '10', name: '고려아연', price: '482,500', diff: '6,000', isUp: false },
                      ]
                    )).slice(0, 10).map((item, i) => (
                      <tr key={i} onClick={() => handleOpenPopup(item.name, item.price, item.diff)} className="hover:bg-white/[0.03] transition-colors cursor-pointer group">
                        <td className="py-2.5 text-center w-8">
                          <span className="text-[10px] text-white/30 font-bold group-hover:text-purple-400">{item.num}</span>
                        </td>
                        <td className="py-2.5 text-left text-white/80 font-bold px-2 group-hover:text-white transition-colors">{item.name}</td>
                        <td className="py-2.5 text-right font-black text-white px-2 font-mono tabular-nums">{item.price}</td>
                        <td className={`py-2.5 text-right font-black px-2 font-mono ${item.isUp === true ? 'text-[#00ffab]' : item.isUp === false ? 'text-[#0a6fe8]' : 'text-white/20'}`}>
                          {item.isUp === true ? '▲' : item.isUp === false ? '▼' : '●'} {item.diff}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Row 3: Top 종목 (Premium Dark Terminal Table) */}
          <div className="glass-card border-white/5 overflow-hidden">
            <div className="flex items-center p-4 border-b border-white/5 bg-white/[0.02]">
              <h3 className="font-bold text-white text-[14px] flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div> Market Leaders
              </h3>
            </div>
            <div className="bg-white/[0.02] border-b border-white/5 flex text-[10px] font-black uppercase tracking-tighter overflow-x-auto whitespace-nowrap hide-scrollbar">
              {['상한가','하한가','상승','보합','하락','거래량상위','고가대비급락','시가총액상위'].map((tab, i) => (
                <div key={i} onClick={() => setTopTab(i)} className={`py-2.5 px-4 cursor-pointer transition-all ${topTab === i ? 'text-red-400 bg-red-400/10 border-r border-white/5' : 'text-white/20 hover:text-white/60 hover:bg-white/5'}`}>
                  {tab}
                </div>
              ))}
            </div>
            <div className="p-4 overflow-x-auto">
              <table className="w-full text-[11px] text-right border-collapse min-w-[700px]">
                <thead>
                  <tr className="text-white/20 uppercase text-[9px] font-black tracking-widest border-b border-white/5">
                    <th className="pb-3 text-center w-8">Rank</th>
                    <th className="pb-3 text-center w-8">Seq</th>
                    <th className="pb-3 text-center w-8">Acc</th>
                    <th className="pb-3 text-left px-4">Ticker</th>
                    <th className="pb-3 px-4 text-right">Price</th>
                    <th className="pb-3 px-4 text-right">Change</th>
                    <th className="pb-3 px-4 text-right">Ratio</th>
                    <th className="pb-3 px-4 text-right">Volume</th>
                    <th className="pb-3 px-4 text-right">Open</th>
                    <th className="pb-3 px-4 text-right">High</th>
                    <th className="pb-3 px-4 text-right">Low</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  {(dashboardData?.topStocks?.[topTab]?.length ? dashboardData.topStocks[topTab] : (
                    topTab === 0 ? [
                      {r:'01', c:'1', a:'4', n:'SK증권우', p:'4,185', d:'965', pct:'+29.97%', v:'1,846,049', op:'3,390', hp:'4,185', lp:'3,165'},
                      {r:'02', c:'1', a:'1', n:'에이프로젠바이오로직스', p:'336', d:'77', pct:'+29.73%', v:'3,742,256', op:'260', hp:'336', lp:'260'},
                      {r:'03', c:'1', a:'1', n:'한신공영', p:'17,730', d:'4,090', pct:'+29.99%', v:'1,107,884', op:'14,100', hp:'17,730', lp:'14,100'},
                      {r:'04', c:'1', a:'2', n:'에쎈테크', p:'588', d:'135', pct:'+29.80%', v:'10,914,104', op:'455', hp:'588', lp:'455'},
                      {r:'05', c:'2', a:'2', n:'우리로', p:'2,710', d:'625', pct:'+29.98%', v:'16,195,873', op:'2,585', hp:'2,710', lp:'2,330'},
                      {r:'06', c:'1', a:'2', n:'제이케이시냅스', p:'478', d:'110', pct:'+29.89%', v:'3,030,052', op:'433', hp:'478', lp:'430'},
                      {r:'07', c:'1', a:'4', n:'빛과전자', p:'2,190', d:'503', pct:'+29.82%', v:'49,762,611', op:'1,754', hp:'2,190', lp:'1,751'},
                      {r:'08', c:'1', a:'1', n:'SK오션플랜트', p:'25,550', d:'5,870', pct:'+29.83%', v:'12,841,455', op:'23,650', hp:'25,550', lp:'23,250'},
                      {r:'09', c:'1', a:'1', n:'주성코퍼레이션', p:'1,225', d:'282', pct:'+29.90%', v:'6,357,070', op:'943', hp:'1,225', lp:'934'},
                      {r:'10', c:'1', a:'10', n:'유니포인트', p:'638', d:'83', pct:'+14.95%', v:'9', op:'638', hp:'638', lp:'638'},
                    ] : []
                  )).slice(0, 10).map((it, i) => (
                    <tr key={i} onClick={() => handleOpenPopup(it.n, it.p, it.pct)} className="hover:bg-white/[0.03] transition-colors cursor-pointer group">
                      <td className="py-3 text-center px-1"><span className="text-white/30 font-black font-mono group-hover:text-red-400">{it.r}</span></td>
                      <td className="py-3 text-center text-white/20">{it.c}</td>
                      <td className="py-3 text-center text-white/20">{it.a}</td>
                      <td className="py-3 text-left px-4 text-white font-bold group-hover:text-red-400 transition-colors uppercase tracking-tight">{it.n}</td>
                      <td className="py-3 px-4 font-black text-white font-mono tabular-nums">{it.p}</td>
                      <td className="py-3 px-4 text-[#ff3d68] font-bold font-mono tabular-nums"><span className="text-[9px] mr-1 uppercase opacity-50">Limit</span>{it.d}</td>
                      <td className="py-3 px-4 text-[#ff3d68] font-black font-mono tabular-nums">{it.pct}</td>
                      <td className="py-3 px-4 text-white/40 font-mono tracking-tighter italic">{it.v}</td>
                      <td className="py-3 px-4 text-white/40 font-mono italic">{it.op}</td>
                      <td className="py-3 px-4 text-[#ff3d68] font-black font-mono">{it.hp}</td>
                      <td className="py-3 px-4 text-white/40 font-mono italic">{it.lp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Sidebar (Premium Dark Terminal Side Widgets) */}
        <div className="w-full xl:w-[320px] shrink-0 flex flex-col gap-6">
          <div className="glass-card border-white/5 overflow-hidden">
             <div className="flex border-b border-white/5 bg-white/[0.02] text-[10px] font-black uppercase tracking-widest divide-x divide-white/5">
                <div onClick={() => setRightTab(0)} className={`flex-1 text-center py-3.5 cursor-pointer transition-all ${rightTab === 0 ? 'bg-blue-600/10 text-blue-400' : 'text-white/30 hover:text-white/60'}`}>Gap Up</div>
                <div onClick={() => setRightTab(1)} className={`flex-1 text-center py-3.5 cursor-pointer transition-all ${rightTab === 1 ? 'bg-purple-600/10 text-purple-400' : 'text-white/30 hover:text-white/60'}`}>Golden X</div>
             </div>
             <div className="p-4">
               <table className="w-full text-xs">
                 <tbody className="divide-y divide-white/[0.03]">
                    {(rightTab === 0 ? [
                      { n: '한신공영', p: '17,730', up: true },
                      { n: '우리로', p: '2,710', up: true },
                      { n: '서전기전', p: '6,210', up: true },
                      { n: '미디어젠', p: '8,780', up: true },
                      { n: 'DL이앤씨', p: '67,400', up: true },
                      { n: 'SK오션플랜트', p: '25,550', up: true },
                      { n: 'SNT에너지', p: '53,300', up: true },
                      { n: 'DL', p: '64,900', up: true },
                      { n: '태웅', p: '57,300', up: true },
                      { n: 'GS건설', p: '31,800', up: true },
                    ] : [
                      { n: '삼성전자', p: '63,100', up: true },
                      { n: '더존비즈온', p: '52,200', up: true },
                      { n: '엔씨소프트', p: '210,500', up: true },
                      { n: 'SK하이닉스', p: '128,100', up: true },
                      { n: '카카오', p: '53,100', up: true },
                      { n: 'NAVER', p: '201,000', up: true },
                      { n: '현대차', p: '243,500', up: true },
                      { n: '기아', p: '112,400', up: true },
                      { n: 'LG화학', p: '320,000', up: true },
                      { n: '셀트리온', p: '182,500', up: true }
                    ]).slice(0, 10).map((it, i) => (
                      <tr key={i} onClick={() => handleOpenPopup(it.n, it.p, '')} className="hover:bg-white/[0.03] group transition-all cursor-pointer">
                        <td className="py-2.5 px-2 text-white/80 font-bold group-hover:text-blue-400 transition-colors uppercase tracking-tight">{it.n}</td>
                        <td className="py-2.5 text-right font-black text-white px-2 font-mono tabular-nums">{it.p}</td>
                        <td className="py-2.5 text-right text-[#00ffab] w-[10%] text-[10px] pl-1 font-black">{it.up ? '▲' : ''}</td>
                      </tr>
                    ))}
                 </tbody>
               </table>
            </div>
          </div>
        </div>
      </main>

      {/* Core Features: Portfolio & Gainers (Original Watchdog system) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 mb-20 mt-8">
        
        {/* Market Gainers Section */}
        <section className="lg:col-span-4 flex flex-col">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="text-[#00ffab]" size={24} />
            <h2 className="text-xl font-bold text-white">실시간 급등주 포착</h2>
          </div>
          
          <div className="space-y-4 overflow-y-auto max-h-[60vh] pr-2 custom-scrollbar">
            <AnimatePresence mode="popLayout">
              {gainers.map(stock => (
                <motion.div
                  key={`gainer-card-${stock.id}`}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="glass-card p-5 flex justify-between items-center group cursor-pointer border border-white/10"
                >
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-lg text-white font-mono">{stock.symbol}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded border border-white/20 text-white/40">
                        {stock.market}
                      </span>
                    </div>
                    <div className="text-white/50 text-xs">{stock.name}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-mono font-bold text-white">
                      {stock.market === 'KR' ? 
                        `₩${Math.round(stock.price).toLocaleString()}` : 
                        `$${stock.price?.toFixed(2)}`
                      }
                    </div>
                    <div className="text-[#00ffab] text-sm font-bold">+{stock.change?.toFixed(2)}% ▲</div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {gainers.length === 0 && (
              <div className="text-white/30 text-center py-12 border border-dashed border-white/10 rounded-2xl">
                관측되는 급등주가 없습니다.
              </div>
            )}
          </div>
        </section>

        {/* Portfolio Watchdog Section */}
        <section className="lg:col-span-8 flex flex-col">
          <div className="flex items-center gap-2 mb-6">
            <Wallet className="text-[#7000ff]" size={24} />
            <h2 className="text-xl font-bold text-white">내 포트폴리오 (자동 손절 감시)</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {portfolio.map(stock => {
              const currentLoss = stock.purchasePrice ? ((stock.price - stock.purchasePrice) / stock.purchasePrice) * 100 : 0;
              const isWarning = currentLoss <= -5;
              
              return (
                <div key={`portfolio-${stock.id}`} className={`glass-card p-6 border-l-4 transition-all ${
                  isWarning ? 'border-l-[#ff3d68] bg-[#ff3d68]/5' : 'border-l-[#7000ff] bg-white/5'
                }`}>
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="text-xl font-bold text-white mb-1">{stock.name}</h3>
                      <div className="text-white/40 text-xs font-mono">
                        {stock.symbol} | 매수가: {stock.market === 'KR' ? `₩${stock.purchasePrice?.toLocaleString()}` : `$${stock.purchasePrice}`}
                      </div>
                    </div>
                    <Activity className={isWarning ? 'text-[#ff3d68] animate-pulse' : 'text-white/20'} size={24} />
                  </div>
                  
                  <div className="flex justify-between items-end">
                    <div>
                      <div className="text-3xl font-mono font-bold text-white tracking-tighter">
                        {stock.market === 'KR' ? `₩${Math.round(stock.price).toLocaleString()}` : `$${stock.price?.toFixed(2)}`}
                      </div>
                      <div className={`text-sm font-bold flex items-center gap-1 ${currentLoss >= 0 ? 'text-[#00ffab]' : 'text-[#ff3d68]'}`}>
                        {currentLoss >= 0 ? '+' : ''}{currentLoss.toFixed(2)}% 
                        <span className="text-[10px] opacity-60">({currentLoss >= 0 ? '익절권' : '손실권'})</span>
                      </div>
                    </div>
                    
                    {isWarning && (
                      <div className="bg-[#ff3d68] text-white text-[10px] px-2 py-1.5 rounded-lg font-bold animate-pulse shadow-lg shadow-red-500/20">
                         위험: 5% 하락
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Real-time Notification Overlay */}
      <aside className="fixed bottom-12 right-8 flex flex-col gap-4 z-[100]">
        <AnimatePresence>
          {alerts.map(alert => (
            <motion.div
              key={`alert-${alert.id}`}
              initial={{ opacity: 0, y: 50, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              className={`p-4 rounded-2xl shadow-2xl flex items-center gap-4 border backdrop-blur-xl ${
                alert.severity === 'urgent' ? 'bg-[#ff3d68] border-[#ff3d68]/50 text-white' : 'bg-[#7000ff] border-[#7000ff]/50 text-white'
              }`}
            >
              <div className="p-2 bg-white/20 rounded-xl">
                <Bell size={20} />
              </div>
              <p className="font-bold pr-8 text-sm">{alert.message}</p>
            </motion.div>
          ))}
        </AnimatePresence>
      </aside>

      {/* Market Ticker Footer */}
      <footer className="fixed bottom-0 left-0 w-full bg-black/80 backdrop-blur-2xl border-t border-white/10 py-3 overflow-hidden z-50">
        <div className="ticker-wrap w-full">
          <div className="ticker-content flex items-center gap-12 px-8">
            {[...stocks, ...stocks].map((stock, i) => (
              <div key={`ticker-item-${stock.id}-${i}`} className="flex items-center gap-4 whitespace-nowrap">
                <span className="text-white/30 font-mono text-xs">{stock.symbol}</span>
                <span className="font-bold text-white text-sm">
                  {stock.market === 'KR' ? `₩${Math.round(stock.price).toLocaleString()}` : `$${stock.price?.toFixed(2)}`}
                </span>
                <span className={`text-xs font-bold ${stock.change >= 0 ? 'text-[#00ffab]' : 'text-[#ff3d68]'}`}>
                  {stock.change >= 0 ? '▲' : '▼'} {Math.abs(stock.change || 0).toFixed(2)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </footer>

      {/* 팝업 차트 모달 */}
      <AnimatePresence>
        {popupItem && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
            onClick={() => setPopupItem(null)}
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden font-sans border border-gray-200"
            >
              {/* Modal Header */}
              <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-gray-50">
                <div className="flex flex-col">
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    {popupItem.name}
                  </h2>
                  <div className="flex items-end gap-2 mt-1">
                    <span className="text-2xl font-black text-[#ed3738]">{popupItem.price} <span className="text-sm font-medium text-gray-500">KRW</span></span>
                    <span className="text-[#ed3738] font-bold pb-1 text-sm">{popupItem.change}</span>
                  </div>
                </div>
                <button onClick={() => setPopupItem(null)} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>

              {/* Modal Body - Chart */}
              <div className="p-5">
                <div className="flex justify-between items-center mb-4">
                  <div className="text-sm font-bold text-gray-600">주가/지수 추이</div>
                  <div className="flex items-center gap-1 text-[11px] font-bold">
                    {['1W', '1M', '1Y'].map(range => (
                      <button key={range} onClick={() => setPopupRange(range)} className={`px-3 py-1 rounded border ${popupRange === range ? 'bg-white border-[#21a14c] text-[#21a14c] shadow-sm' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                        {range === '1W' ? '1주일' : range === '1M' ? '1개월' : '1년'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="h-[300px] w-full">
                  {!loadingPopup && popupHistory.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={popupHistory}>
                        <defs>
                          <linearGradient id="colorPopup" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ed3738" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#ed3738" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis dataKey="date" stroke="#888" fontSize={11} tickLine={false} axisLine={{stroke: '#e5e7eb'}} minTickGap={10} dy={10} />
                        <YAxis domain={['dataMin - (dataMin*0.01)', 'dataMax + (dataMax*0.01)']} fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => Math.round(v).toLocaleString()} orientation="right" width={60} />
                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} itemStyle={{ color: '#ed3738', fontWeight: 'bold' }} />
                        <Area type="monotone" dataKey="price" stroke="#ed3738" strokeWidth={2} fill="url(#colorPopup)" animationDuration={1000} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-400 font-bold text-sm">
                      <div className="animate-pulse">데이터를 불러오는 중...</div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
