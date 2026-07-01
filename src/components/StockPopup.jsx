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
  const [activeTab, setActiveTab] = useState('basic');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleForceRefresh = async () => {
    if (!item.symbol || isRefreshing) return;
    setIsRefreshing(true);
    try {
      // 1. 상세 수급 및 펀더멘털 강제 동기화
      const res = await fetch(`${API_URL}/api/stock-detail/detail/${item.symbol}?force=true`);
      const data = await res.json();
      if (data.fundamental) {
        setStockDetail(data.fundamental);
      }
      
      // 2. 현재 활성화된 범위의 분봉/일봉 차트 강제 동기화
      const resChart = await fetch(`${API_URL}/api/stock/history/${item.symbol}?range=${popupRange}&price=${item.price}&force=true`);
      const dataChart = await resChart.json();
      if (dataChart && Array.isArray(dataChart)) {
        setPopupHistory(dataChart);
      }
    } catch (e) {
      console.error('Manual force refresh fail', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  const getRiskDetails = () => {
    if (!stockDetail) return { score: 50, level: '보통', color: 'text-blue-500', bgColor: 'bg-blue-500', badgeColor: 'bg-blue-50 text-blue-600 border-blue-200', list: [] };
    
    let score = 30; // base risk score
    const list = [];

    // 1. 신용잔고율
    const credit = parseFloat(stockDetail.advanced?.creditBalance) || 0;
    if (credit > 6) {
      score += 25;
      list.push({ type: 'danger', label: '신용잔고율 과다', desc: `현재 신용잔고율 ${credit}%로 임계치(6%)를 초과하여 주가 급락 시 반대매매 매물 폭탄 리스크가 매우 높습니다.` });
    } else if (credit > 4) {
      score += 15;
      list.push({ type: 'warning', label: '신용잔고율 다소 높음', desc: `신용잔고율 ${credit}%로 경계선 구간입니다. 시장 변동성 확대 시 예의주시 필요.` });
    }

    // 2. 공매도 비중
    const short = parseFloat(stockDetail.advanced?.shortRatio) || 0;
    if (short >= 15) {
      score += 15;
      list.push({ type: 'danger', label: '공매도 집중 과열', desc: `당일 공매도 거래 비중이 ${short}%에 달해 공매도 세력에 의한 강력한 하방 압력이 작용하고 있습니다.` });
    } else if (short >= 10) {
      score += 10;
      list.push({ type: 'warning', label: '공매도 비중 경계', desc: `공매도 거래 비중이 ${short}%로 다소 높아 상승 모멘텀을 일부 제한하고 있습니다.` });
    }

    // 3. 수급 이탈 (개미지옥)
    const investor = stockDetail.advanced?.investor;
    if (investor) {
      const fVal = investor.foreign1D !== undefined ? investor.foreign1D : investor.foreign5D;
      const oVal = investor.organ1D !== undefined ? investor.organ1D : investor.organ5D;
      const pVal = investor.personal1D !== undefined ? investor.personal1D : investor.personal5D;
      const isRealtime = investor.isRealtime;
      
      if ((isRealtime || investor.isTodayData) && pVal > 0 && fVal < 0 && oVal < 0) {
        score += 20;
        list.push({ type: 'danger', label: '개미지옥 수급 패턴 감지', desc: '장중 외인과 기관이 대량 매도하여 탈출 중인 물량을 개인이 홀로 떠받치는 고위험 설거지 수급입니다.' });
      }
    }

    // 4. 유동성 (거래대금)
    const txVal = stockDetail.advanced?.transactionValue || 0;
    if (txVal > 0 && txVal < 10000000000) { // < 100억
      score += 15;
      list.push({ type: 'danger', label: '유동성 극소 (소외주)', desc: `당일 거래대금 ${Math.round(txVal / 100000000)}억원으로 극도로 적어, 호가 공백 및 세력 조작에 취약한 리스크가 존재합니다.` });
    } else if (txVal > 0 && txVal < 20000000000) { // < 200억
      score += 8;
      list.push({ type: 'warning', label: '거래 유동성 부족', desc: `당일 거래대금 ${Math.round(txVal / 100000000)}억원으로 메이저 기관/외인의 정상적인 수급 유입을 기대하기 힘듭니다.` });
    }

    // 5. 단기 가격 과열 (이격도/RSI)
    const disp5 = parseFloat(stockDetail.advanced?.disparity5 || stockDetail.advanced?.technical?.disparity5) || 100;
    const rsi = parseFloat(stockDetail.advanced?.technical?.rsi) || 50;
    if (disp5 > 108 || rsi > 75) {
      score += 15;
      list.push({ type: 'danger', label: '단기 주가 급등 과열', desc: `5일 이격도 ${disp5}%, RSI ${rsi}pt로 단기 기술적 과열 임계값에 도달하여 차익 실현 매물이 쏟아질 리스크가 존재합니다.` });
    } else if (disp5 < 95 || rsi < 30) {
      score += 10;
      list.push({ type: 'warning', label: '단기 추세 붕괴/과매도', desc: `5일 이격도 ${disp5}%, RSI ${rsi}pt로 주가가 단기 하방으로 급격히 이탈하여 기술적 반등 대기 상태이거나 낙폭 과대 위험이 있습니다.` });
    }

    // 6. 재무 건전성 (ROE 적자, 고부채)
    const debt = parseFloat(stockDetail.debtRatio) || 0;
    const roe = parseFloat(stockDetail.roe) || 0;
    if (debt >= 200) {
      score += 10;
      list.push({ type: 'danger', label: '부채비율 과다 (200% 초과)', desc: `부채비율이 ${debt}%에 달하여 고금리 기조 유지 시 이자 부담 증가 및 신용등급 하락 위험이 존재합니다.` });
    }
    if (roe !== '-' && roe < 0) {
      score += 10;
      list.push({ type: 'danger', label: 'ROE 영업 적자 상태', desc: `자기자본이익률(ROE)이 ${roe}% 적자로, 주주 가치가 지속적으로 훼손되고 사업 모델의 수익성이 불투명합니다.` });
    }

    const finalScore = Math.min(100, Math.max(0, score));
    let level = '안전';
    let color = 'text-emerald-500';
    let bgColor = 'bg-emerald-500';
    let badgeColor = 'bg-emerald-50 text-emerald-600 border-emerald-200';

    if (finalScore >= 80) {
      level = '위험';
      color = 'text-red-500';
      bgColor = 'bg-red-500';
      badgeColor = 'bg-red-50 text-red-600 border-red-200';
    } else if (finalScore >= 60) {
      level = '경고';
      color = 'text-amber-500';
      bgColor = 'bg-amber-500';
      badgeColor = 'bg-amber-50 text-amber-600 border-amber-200';
    } else if (finalScore >= 35) {
      level = '보통';
      color = 'text-blue-500';
      bgColor = 'bg-blue-500';
      badgeColor = 'bg-blue-50 text-blue-600 border-blue-200';
    }

    return { score: finalScore, level, color, bgColor, badgeColor, list };
  };

  const riskInfo = getRiskDetails();

  useEffect(() => {
    if (!item) return;

    // Reset tab and data immediately
    setActiveTab('basic');
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
          if (data.fundamental) {
            setStockDetail(data.fundamental);
            
            // 실시간 백그라운드 갱신: 장중이거나 혹은 당일 마감 데이터가 아직 없는 경우에만 실행
            const krNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
            const curHHMM = krNow.getUTCHours().toString().padStart(2, '0') + krNow.getUTCMinutes().toString().padStart(2, '0');
            const krDay = krNow.getUTCDay();
            const isWeekend = krDay === 0 || krDay === 6;
            const isMarketActive = !isWeekend && curHHMM >= '0900' && curHHMM <= '1540';
            const hasTodayData = data.fundamental.advanced?.investor?.isTodayData;
            
            if (isMarketActive || !hasTodayData) {
              fetch(`${API_URL}/api/stock-detail/detail/${item.symbol}?force=true`)
                .then(res2 => res2.json())
                .then(data2 => {
                  if (data2.fundamental) setStockDetail(data2.fundamental);
                })
                .catch(e => console.error('Silent detail refresh fail', e));
            }
          }
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
                <span className={`font-bold pb-1 text-sm ${String(realTimeData.change || '').includes('-') ? 'text-blue-500' : 'text-[#ed3738]'}`}>
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
              {/* Tab navigation */}
              <div className="flex border-b border-gray-200 mb-6 bg-gray-50/50 p-1 rounded-xl">
                {[
                  { id: 'basic', label: '기본 정보' },
                  { id: 'supply', label: '수급 현황' },
                  { id: 'technical', label: '기술 지표' },
                  { id: 'risk', label: '리스크 평가' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 py-2 text-center text-xs font-black rounded-lg transition-all duration-200 ${
                      activeTab === tab.id
                        ? 'bg-white text-gray-900 shadow-sm border border-gray-100'
                        : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100/50'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Contents: Basic */}
              {activeTab === 'basic' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center mb-4">
                    <div className="text-sm font-bold text-gray-800">기업 펀더멘털 분석</div>
                    {stockDetail.consensus && stockDetail.consensus[0] && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">애널리스트 의견:</span>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                          stockDetail.consensus[0].opinion?.includes('매수') 
                            ? 'bg-[#ff3d68]/10 text-[#ff3d68]' 
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          {stockDetail.consensus[0].opinion}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { label: '주가수익비율', value: stockDetail.per || '-', sub: 'PER' },
                      { label: '주가순자산비율', value: stockDetail.pbr || '-', sub: 'PBR' },
                      { label: '자기자본이익률', value: (stockDetail.roe !== '-' && stockDetail.roe ? stockDetail.roe + '%' : '-'), sub: 'ROE' },
                      { label: '배당수익률', value: (stockDetail.yield !== '-' && stockDetail.yield ? stockDetail.yield + '%' : '-'), sub: 'Yield' }
                    ].map((stat, i) => (
                      <div key={i} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                        <div className="text-[10px] text-gray-400 font-bold mb-1 uppercase">{stat.label}</div>
                        <div className="text-sm font-black text-gray-900">{stat.value}</div>
                        <div className="text-[8px] text-gray-300 font-medium mt-1 uppercase">{stat.sub}</div>
                      </div>
                    ))}
                  </div>

                  {stockDetail.consensus && stockDetail.consensus[0] && stockDetail.consensus[0].target !== '-' && (
                    <div className="bg-[#f0f9ff] border border-[#bae6fd] rounded-xl p-3 flex justify-between items-center">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-sky-500 font-bold uppercase">목표 주가 (Consensus)</span>
                        <span className="text-lg font-black text-sky-600">₩{parseInt(stockDetail.consensus[0].target).toLocaleString()}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-sky-400 font-bold block">현재가 대비</span>
                        <span className="text-sm font-bold text-sky-500">
                          +{Math.round(((parseInt(stockDetail.consensus[0].target) - parseInt(String(item.price).replace(/,/g, ''))) / parseInt(String(item.price).replace(/,/g, ''))) * 100)}% 업사이드
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="border-t border-gray-100 pt-6">
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

              {/* Tab Contents: Supply */}
              {activeTab === 'supply' && (
                <div className="space-y-6">
                  <div className="text-[11px] font-bold text-gray-500 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-3 bg-[#7000ff] rounded-full"></div>
                      3대 주체별 수급 현황
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[9px] font-bold ${
                        stockDetail.advanced?.investor?.isRealtime 
                          ? 'text-emerald-500' 
                          : stockDetail.advanced?.investor?.isTodayData 
                            ? 'text-emerald-500' 
                            : 'text-amber-500'
                      }`}>
                        {stockDetail.advanced?.investor?.isRealtime 
                          ? '● 당일 실시간' 
                          : stockDetail.advanced?.investor?.isTodayData 
                            ? '● 당일 기준' 
                            : '● 전 영업일 기준'}
                      </span>
                      <button 
                        onClick={handleForceRefresh}
                        className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 transition-colors"
                        title="실시간 수급 새로고침"
                        disabled={isRefreshing}
                      >
                        <svg className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.5" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {stockDetail.advanced?.investor && (() => {
                    const fVal = stockDetail.advanced.investor.foreign1D !== undefined ? stockDetail.advanced.investor.foreign1D : stockDetail.advanced.investor.foreign5D;
                    const oVal = stockDetail.advanced.investor.organ1D !== undefined ? stockDetail.advanced.investor.organ1D : stockDetail.advanced.investor.organ5D;
                    const pVal = stockDetail.advanced.investor.personal1D !== undefined ? stockDetail.advanced.investor.personal1D : stockDetail.advanced.investor.personal5D;
                    const isRealtime = stockDetail.advanced.investor.isRealtime;
                    return (isRealtime || stockDetail.advanced.investor.isTodayData) && pVal > 0 && fVal < 0 && oVal < 0;
                  })() && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2.5 shadow-[0_2px_8px_rgba(239,68,68,0.08)] animate-pulse">
                      <span className="text-lg">🚨</span>
                      <div className="flex-1">
                        <div className="text-[11px] font-black text-red-600">개미 지옥 및 설거지 경보 (Retail Absorption Warning)</div>
                        <div className="text-[9px] text-red-500 leading-tight">외인/기관이 던진 대량 매도 물량을 개인이 홀로 수렴 중인 고위험 종목입니다. 진입에 극도로 유의하세요.</div>
                      </div>
                    </div>
                  )}

                  {stockDetail.advanced?.investor ? (() => {
                    const fVal = stockDetail.advanced.investor.foreign1D !== undefined ? stockDetail.advanced.investor.foreign1D : stockDetail.advanced.investor.foreign5D;
                    const oVal = stockDetail.advanced.investor.organ1D !== undefined ? stockDetail.advanced.investor.organ1D : stockDetail.advanced.investor.organ5D;
                    const pVal = stockDetail.advanced.investor.personal1D !== undefined ? stockDetail.advanced.investor.personal1D : stockDetail.advanced.investor.personal5D;

                    const maxAbs = Math.max(Math.abs(fVal), Math.abs(oVal), Math.abs(pVal), 1);
                    const fRatio = (fVal / maxAbs) * 100;
                    const oRatio = (oVal / maxAbs) * 100;
                    const pRatio = (pVal / maxAbs) * 100;

                    return (
                      <div className="bg-gray-50/50 border border-gray-100 rounded-xl p-4">
                        <div className="flex justify-between text-[9px] text-gray-400 font-bold mb-3 border-b border-gray-100 pb-1.5 uppercase tracking-wider">
                          <span>◀ 순매도 (유출)</span>
                          <span className="text-gray-500 font-black">0선 (기준)</span>
                          <span>순매수 (유입) ▶</span>
                        </div>

                        <div className="mb-4">
                          <div className="flex justify-between text-[10px] font-black mb-1">
                            <span className="text-gray-600">🔴 외국인</span>
                            <span className={`font-mono ${fVal >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                              {fVal > 0 ? '+' : ''}{fVal.toLocaleString()}주
                            </span>
                          </div>
                          <div className="h-3 w-full bg-gray-200/50 rounded-full overflow-hidden relative flex">
                            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-400/80 z-10" />
                            {fVal < 0 ? (
                              <div className="h-full bg-gradient-to-l from-blue-400 to-blue-500 rounded-l-full absolute right-1/2" style={{ width: `${Math.min(50, Math.abs(fRatio) / 2)}%` }} />
                            ) : (
                              <div className="h-full bg-gradient-to-r from-red-400 to-red-500 rounded-r-full absolute left-1/2" style={{ width: `${Math.min(50, fRatio / 2)}%` }} />
                            )}
                          </div>
                          <div className="text-[8px] text-gray-400 font-bold mt-0.5 text-right flex justify-between items-center">
                            <span>5일 누적 순매수 금액: <strong className={stockDetail.advanced.investor.foreignMoney5D >= 0 ? 'text-red-500' : 'text-blue-500'}>{stockDetail.advanced.investor.foreignMoney5D !== undefined ? `${stockDetail.advanced.investor.foreignMoney5D > 0 ? '+' : ''}${stockDetail.advanced.investor.foreignMoney5D}억원` : '정보 없음'}</strong></span>
                            <span>외인 {stockDetail.advanced.investor.foreignConsecutiveDays}일 연속 순매수{stockDetail.advanced.investor.foreignConsecutiveVolume > 0 && ` (총 ${stockDetail.advanced.investor.foreignConsecutiveVolume.toLocaleString()}주)`}</span>
                          </div>
                        </div>

                        <div className="mb-4">
                          <div className="flex justify-between text-[10px] font-black mb-1">
                            <span className="text-gray-600">🔵 기관</span>
                            <span className={`font-mono ${oVal >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                              {oVal > 0 ? '+' : ''}{oVal.toLocaleString()}주
                            </span>
                          </div>
                          <div className="h-3 w-full bg-gray-200/50 rounded-full overflow-hidden relative flex">
                            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-400/80 z-10" />
                            {oVal < 0 ? (
                              <div className="h-full bg-gradient-to-l from-blue-400 to-blue-500 rounded-l-full absolute right-1/2" style={{ width: `${Math.min(50, Math.abs(oRatio) / 2)}%` }} />
                            ) : (
                              <div className="h-full bg-gradient-to-r from-red-400 to-red-500 rounded-r-full absolute left-1/2" style={{ width: `${Math.min(50, oRatio / 2)}%` }} />
                            )}
                          </div>
                          <div className="text-[8px] text-gray-400 font-bold mt-0.5 text-right flex justify-between items-center">
                            <span>5일 누적 순매수 금액: <strong className={stockDetail.advanced.investor.organMoney5D >= 0 ? 'text-red-500' : 'text-blue-500'}>{stockDetail.advanced.investor.organMoney5D !== undefined ? `${stockDetail.advanced.investor.organMoney5D > 0 ? '+' : ''}${stockDetail.advanced.investor.organMoney5D}억원` : '정보 없음'}</strong></span>
                            <span>기관 {stockDetail.advanced.investor.organConsecutiveDays}일 연속 순매수{stockDetail.advanced.investor.organConsecutiveVolume > 0 && ` (총 ${stockDetail.advanced.investor.organConsecutiveVolume.toLocaleString()}주)`}</span>
                          </div>
                        </div>

                        <div className="mb-1">
                          <div className="flex justify-between text-[10px] font-black mb-1">
                            <span className="text-gray-600">🟢 개인(개미)</span>
                            <span className={`font-mono ${pVal >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                              {pVal > 0 ? '+' : ''}{pVal.toLocaleString()}주
                            </span>
                          </div>
                          <div className="h-3 w-full bg-gray-200/50 rounded-full overflow-hidden relative flex">
                            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-400/80 z-10" />
                            {pVal < 0 ? (
                              <div className="h-full bg-gradient-to-l from-blue-400 to-blue-500 rounded-l-full absolute right-1/2" style={{ width: `${Math.min(50, Math.abs(pRatio) / 2)}%` }} />
                            ) : (
                              <div className="h-full bg-gradient-to-r from-red-400 to-red-500 rounded-r-full absolute left-1/2" style={{ width: `${Math.min(50, pRatio / 2)}%` }} />
                            )}
                          </div>
                          <div className="text-[8px] text-gray-400 font-bold mt-0.5 text-right flex justify-between items-center">
                            <span>5일 누적 순매수 금액: <strong className={stockDetail.advanced.investor.personalMoney5D >= 0 ? 'text-red-500' : 'text-blue-500'}>{stockDetail.advanced.investor.personalMoney5D !== undefined ? `${stockDetail.advanced.investor.personalMoney5D > 0 ? '+' : ''}${stockDetail.advanced.investor.personalMoney5D}억원` : '정보 없음'}</strong></span>
                            <span>개인 {stockDetail.advanced.investor.personalConsecutiveDays}일 연속 순매수{stockDetail.advanced.investor.personalConsecutiveVolume > 0 && ` (총 ${stockDetail.advanced.investor.personalConsecutiveVolume.toLocaleString()}주)`}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })() : (
                    <div className="py-5 text-center text-[10px] text-gray-500 font-bold bg-gray-50 border border-gray-100 rounded-xl mb-4 p-4 flex flex-col gap-2 justify-center items-center">
                      <span className="text-lg">⚠️</span>
                      <span className="leading-relaxed font-bold max-w-[280px]">
                        수급 데이터가 존재하지 않거나 장외 서버 점검 중입니다.
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
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
                              {stockDetail.advanced.transactionValue < 20000000000 ? '소외주' : '거래 활발'}
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
                        당일 시장 거래대금. 기관/외인의 유입을 위해 200억원 이상 거래대금이 권장됩니다.
                      </p>
                    </div>

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
                        신용 융자 비율. 6% 초과 종목은 반대매매 리스크로 제외됩니다.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab Contents: Technical */}
              {activeTab === 'technical' && (
                <div className="space-y-6">
                  <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[11px] font-black text-gray-600 uppercase tracking-wider">당일 체결강도</span>
                      <span className="text-[10px] px-2.5 py-1 rounded-full font-black bg-emerald-50 text-emerald-600 border border-emerald-200">
                        {parseFloat(stockDetail.advanced?.strength) >= 100 ? '▲ 매수 우위' : '▼ 매도 우위'}
                      </span>
                    </div>
                    <div className="text-3xl font-black text-gray-900 font-mono mb-2">
                      {stockDetail.advanced?.strength}<span className="text-base text-gray-400 font-bold">%</span>
                    </div>
                    <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
                      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-300 z-10" />
                      <div className="h-full bg-emerald-400 rounded-full" style={{width: `${Math.min(parseFloat(stockDetail.advanced?.strength) || 0, 200)/2}%`}} />
                    </div>
                    <div className="text-[9px] text-gray-400 leading-normal">
                      매수 체결량 / 매도 체결량 비율. <strong>90% 이상</strong>이 매수 대기선 안정구간입니다.
                    </div>
                  </div>

                  {(() => {
                    const rsi = parseFloat(stockDetail.advanced?.technical?.rsi) || 50;
                    const rsiColor = rsi >= 70 ? 'bg-red-500' : rsi <= 30 ? 'bg-emerald-500' : 'bg-blue-500';
                    const rsiText = rsi >= 70 ? '과매수 (단기 고점 리스크)' : rsi <= 30 ? '과매도 (저가 매수 구간)' : '중립 영역';
                    
                    return (
                      <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[11px] font-black text-gray-600 uppercase tracking-wider">RSI (14일 상대강도지수)</span>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                            rsi >= 70 ? 'bg-red-50 text-red-600' : rsi <= 30 ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {rsi}pt - {rsiText}
                          </span>
                        </div>
                        <div className="relative pt-4 pb-2">
                          <div className="flex justify-between text-[8px] text-gray-400 font-bold px-1 mb-1">
                            <span>0</span>
                            <span className="text-emerald-500">30 (과매도선)</span>
                            <span>50</span>
                            <span className="text-red-500">70 (과매수선)</span>
                            <span>100</span>
                          </div>
                          <div className="h-3 w-full bg-gray-100 rounded-full relative overflow-hidden">
                            <div className="absolute left-[30%] right-[30%] top-0 bottom-0 bg-gray-200/50" />
                            <div className={`h-full ${rsiColor} transition-all duration-500`} style={{ width: `${rsi}%` }} />
                          </div>
                          <div className="absolute top-4 left-[30%] h-3 w-px bg-emerald-400 z-10" />
                          <div className="absolute top-4 left-[70%] h-3 w-px bg-red-400 z-10" />
                        </div>
                      </div>
                    );
                  })()}

                  {(() => {
                    const bb = stockDetail.advanced?.technical?.bollinger;
                    if (!bb) return null;
                    const pos = parseFloat(bb.positionPercent) || 50;
                    
                    return (
                      <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[11px] font-black text-gray-600 uppercase tracking-wider">볼린저 밴드 (SMA 20)</span>
                          <span className="text-[10px] text-gray-400 font-bold max-w-[200px] text-right truncate">
                            {bb.interpretation}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center mb-3">
                          <div className="bg-gray-50 rounded-lg p-1.5 border border-gray-100">
                            <div className="text-[8px] text-gray-400 font-bold">하한선 (Lower)</div>
                            <div className="text-[11px] font-mono font-black text-gray-700">₩{Math.round(bb.lower).toLocaleString()}</div>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-1.5 border border-gray-100">
                            <div className="text-[8px] text-gray-400 font-bold">중심선 (Middle)</div>
                            <div className="text-[11px] font-mono font-black text-gray-700">₩{Math.round(bb.middle).toLocaleString()}</div>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-1.5 border border-gray-100">
                            <div className="text-[8px] text-gray-400 font-bold">상한선 (Upper)</div>
                            <div className="text-[11px] font-mono font-black text-gray-700">₩{Math.round(bb.upper).toLocaleString()}</div>
                          </div>
                        </div>
                        <div className="relative pt-2 pb-1">
                          <div className="h-2 w-full bg-gradient-to-r from-blue-300 via-gray-200 to-red-300 rounded-full relative">
                            <div 
                              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-indigo-600 rounded-full shadow-md flex items-center justify-center transition-all duration-500" 
                              style={{ left: `calc(${Math.min(100, Math.max(0, pos))}% - 8px)` }}
                            >
                              <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full" />
                            </div>
                          </div>
                          <div className="flex justify-between text-[8px] text-gray-400 font-bold mt-1 px-1">
                            <span>하한 이탈</span>
                            <span>중심선</span>
                            <span>상한 이탈</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[10px] font-black text-gray-500 uppercase">5일 이격도</span>
                          <span className={`text-[8px] px-1.5 py-0.5 rounded font-black ${
                            parseFloat(stockDetail.advanced?.disparity5) > 106 
                              ? 'bg-red-50 text-red-600 border border-red-100' 
                              : parseFloat(stockDetail.advanced?.disparity5) >= 98 && parseFloat(stockDetail.advanced?.disparity5) <= 104
                                ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                : 'bg-gray-50 text-gray-600 border border-gray-100'
                          }`}>
                            {parseFloat(stockDetail.advanced?.disparity5) > 106 ? '단기 과열' : parseFloat(stockDetail.advanced?.disparity5) >= 98 && parseFloat(stockDetail.advanced?.disparity5) <= 104 ? '안정 수렴' : '관망/조정'}
                          </span>
                        </div>
                        <div className="text-sm font-black text-gray-900 font-mono mt-1 flex flex-col gap-0.5">
                          <div>5일: {stockDetail.advanced?.disparity5 !== undefined ? `${stockDetail.advanced.disparity5}%` : '-'}</div>
                          <div className="text-[10px] text-gray-500 font-normal">1일: {stockDetail.advanced?.disparity1 !== undefined ? `${stockDetail.advanced.disparity1}%` : '-'}</div>
                        </div>
                      </div>
                      <p className="text-[9px] text-gray-400 leading-normal mt-2 pt-2 border-t border-gray-50">
                        5일 이동평균선 및 전일비(1일) 대비 가격 괴리율. <strong>98%~104%</strong> 안정이 진입 적기이며, 106% 초과 시 리스크 관리가 필요합니다.
                      </p>
                    </div>

                    <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[10px] font-black text-gray-500 uppercase">공매도 비중</span>
                          {stockDetail.advanced?.shortRatio !== undefined && (
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

                    <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] font-black text-gray-500 uppercase block mb-1">평균 변동성 (ATR)</span>
                        <div className="text-sm font-black text-gray-900 font-mono">
                          {stockDetail.advanced?.atrPercent ? `${stockDetail.advanced.atrPercent}%` : '-'}
                          <div className="text-[9px] text-gray-500 font-normal">일 변동폭: {stockDetail.advanced?.atr ? `₩${Math.round(stockDetail.advanced.atr).toLocaleString()}` : '-'}</div>
                        </div>
                      </div>
                      <p className="text-[9px] text-gray-400 leading-normal mt-2 pt-2 border-t border-gray-50">
                        평균 변동성 지표. 최근 20일간의 가격 변동률을 측정하여 일일 기대 변동폭을 제시합니다.
                      </p>
                    </div>

                    <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] font-black text-gray-500 uppercase block mb-1">이평선 배열 상태</span>
                        <div className={`text-sm font-black mt-1 ${
                          stockDetail.advanced?.technical?.maAlignment === '정배열' ? 'text-emerald-500' :
                          stockDetail.advanced?.technical?.maAlignment === '역배열' ? 'text-red-500' : 'text-gray-700'
                        }`}>
                          {stockDetail.advanced?.technical?.maAlignment || '혼조세'}
                        </div>
                        <div className="text-[8px] text-gray-400 font-bold mt-1">
                          5일:{Math.round(stockDetail.advanced?.technical?.ma5 || 0).toLocaleString()} | 20일:{Math.round(stockDetail.advanced?.technical?.ma20 || 0).toLocaleString()}
                        </div>
                      </div>
                      <p className="text-[9px] text-gray-400 leading-normal mt-2 pt-2 border-t border-gray-50">
                        단기(5일) 및 중기(20일) 이동평균선 정렬 상태. 정배열은 강한 매수 모멘텀을 뜻합니다.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab Contents: Risk */}
              {activeTab === 'risk' && (
                <div className="space-y-6">
                  <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-[11px] font-black text-gray-600 uppercase tracking-wider">정량 리스크 종합 점수</span>
                      <span className={`text-xs font-black px-3 py-1 rounded-full border ${riskInfo.badgeColor}`}>
                        {riskInfo.level} (위험도: {riskInfo.score}/100)
                      </span>
                    </div>
                    <div className="h-4 w-full bg-gray-100 rounded-full relative overflow-hidden mb-2">
                      <div className={`h-full ${riskInfo.bgColor} transition-all duration-700`} style={{ width: `${riskInfo.score}%` }} />
                    </div>
                    <div className="flex justify-between text-[8px] text-gray-400 font-bold px-1">
                      <span>안전 (0~35)</span>
                      <span>보통 (~60)</span>
                      <span>경고 (~80)</span>
                      <span>위험 (~100)</span>
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] font-bold text-gray-500 mb-3 flex items-center gap-2">
                      <div className="w-1 h-3 bg-[#7000ff] rounded-full"></div>
                      식별된 주요 아킬레스건 (리스크 요인)
                    </div>

                    {riskInfo.list.length > 0 ? (
                      <div className="space-y-3">
                        {riskInfo.list.map((risk, index) => (
                          <div 
                            key={index} 
                            className={`p-3 rounded-xl border flex gap-3 ${
                              risk.type === 'danger' 
                                ? 'bg-red-50/50 border-red-100 text-red-700' 
                                : 'bg-amber-50/50 border-amber-100 text-amber-700'
                            }`}
                          >
                            <span className="text-base flex-shrink-0">⚠️</span>
                            <div>
                              <div className="text-[11px] font-black">{risk.label}</div>
                              <div className="text-[9px] mt-1 leading-normal opacity-90">{risk.desc}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 text-center bg-emerald-50/20 border border-emerald-100 rounded-xl text-[10px] text-emerald-600 font-bold flex flex-col items-center gap-2">
                        <span className="text-xl">✅</span>
                        <span>탐지된 주요 리스크 요인(아킬레스건)이 없습니다. 안전한 우량 투자 구간입니다.</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
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
