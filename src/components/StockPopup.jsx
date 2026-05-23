import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

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
      fetch(`http://localhost:5000/api/stock/history/${item.symbol || '005930'}?range=${popupRange}&price=${item.price}`)
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
      fetch(`http://localhost:5000/api/stock/${item.symbol}`)
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
      fetch(`http://localhost:5000/api/stock-detail/detail/${item.symbol}`)
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
              <ResponsiveContainer width="100%" height="100%">
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
                <div className="text-[11px] font-bold text-gray-500 mb-4 flex items-center gap-2">
                  <div className="w-1 h-3 bg-blue-600 rounded-full"></div>
                  수급 및 심리 분석 <span className="text-[9px] text-gray-400 font-normal">(Sentiment)</span>
                </div>

                <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm mb-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[11px] font-black text-gray-600 uppercase tracking-wider">체결강도</span>
                    <span className="text-[10px] px-2.5 py-1 rounded-full font-black bg-emerald-50 text-emerald-600 border border-emerald-200">
                      {parseFloat(stockDetail.advanced?.strength) >= 100 ? '▲ 매수 우위' : '▼ 매도 우위'}
                    </span>
                  </div>
                  <div className="text-3xl font-black text-gray-900 font-mono mb-2">{stockDetail.advanced?.strength}<span className="text-base text-gray-400 font-bold">%</span></div>
                  <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-300 z-10" />
                    <div className="h-full bg-emerald-400 rounded-full" style={{width: `${Math.min(parseFloat(stockDetail.advanced?.strength) || 0, 200)/2}%`}} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                    <span className="text-[10px] font-black text-gray-500 uppercase">이격도 (5일)</span>
                    <div className="text-xl font-black text-gray-900 font-mono mt-1">{stockDetail.advanced?.disparity5}{stockDetail.advanced?.disparity5 !== '-' ? '%' : ''}</div>
                  </div>
                  <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                    <span className="text-[10px] font-black text-gray-500 uppercase">공매도 비중</span>
                    <div className="text-xl font-black text-red-500 font-mono mt-1">{stockDetail.advanced?.shortRatio}{stockDetail.advanced?.shortRatio !== '-' ? '%' : ''}</div>
                  </div>
                </div>
              </div>

              <div className="mt-6 border-t border-gray-100 pt-6">
                <div className="text-[11px] font-bold text-gray-500 mb-3 flex items-center gap-2">
                  <div className="w-1 h-3 bg-[#7000ff] rounded-full"></div>
                  최근 실적 추이 <span className="text-[9px] text-gray-400 font-normal">(억 원)</span>
                </div>
                <div className="w-full bg-gray-50/30 rounded-xl p-2 mt-2" style={{ height: '160px', position: 'relative' }}>
                  {stockDetail.finance && stockDetail.finance.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
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
