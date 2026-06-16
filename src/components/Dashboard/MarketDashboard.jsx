import React, { useState, useEffect } from 'react';
import { ChartLine, Activity } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { API_URL } from '../../config.js';

const MarketDashboard = ({ dashboardData }) => {
  const [chartIndex, setChartIndex] = useState(0);
  const [timeRange, setTimeRange] = useState('1D');
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [indexPrices, setIndexPrices] = useState({ 'KOSPI': '0', 'KOSDAQ': '0', 'KOSPI200': '0' });
  const [indexChanges, setIndexChanges] = useState({ 'KOSPI': null, 'KOSDAQ': null, 'KOSPI200': null });

  const chartSymbols = ['KOSPI', 'KOSDAQ', 'KOSPI200'];

  // 1. 대시보드 캐시 데이터로부터 실시간 지수/등락률 동기화 (한투 실시간 정합성 보장)
  useEffect(() => {
    if (dashboardData && Array.isArray(dashboardData.sectors)) {
      const prices = { 'KOSPI': '0', 'KOSDAQ': '0', 'KOSPI200': '0' };
      const changes = { 'KOSPI': null, 'KOSDAQ': null, 'KOSPI200': null };
      dashboardData.sectors.forEach(s => {
        if (s.name === 'KOSPI' || s.name === 'KOSDAQ' || s.name === 'KOSPI200') {
          prices[s.name] = s.price;
          changes[s.name] = s.change;
        }
      });
      setIndexPrices(prices);
      setIndexChanges(changes);
    }
  }, [dashboardData]);

  // 2. 차트 히스토리 갱신 (1D이면 1분마다 자동 갱신)
  useEffect(() => {
    const symbol = chartSymbols[chartIndex];
    const fetchHistory = (isInitial = false) => {
      if (isInitial) setLoadingHistory(true);
      fetch(`${API_URL}/api/stock/history/${symbol}?range=${timeRange}`)
        .then(res => res.json())
        .then(data => {
          setHistory(data);
          if (data.length > 0) {
            setIndexPrices(prev => {
              // 이미 대시보드에서 실시간 가격을 받았으면 덮어쓰지 않음
              if (prev[symbol] && prev[symbol] !== '0') return prev;
              return { ...prev, [symbol]: data[data.length - 1].price };
            });
          }
        })
        .catch(e => console.error('Index history load fail', e))
        .finally(() => {
          if (isInitial) setLoadingHistory(false);
        });
    };

    fetchHistory(true);
    
    // 1분마다 자동 갱신 (1D 범위일 때만)
    let interval;
    if (timeRange === '1D') {
      interval = setInterval(() => fetchHistory(false), 60000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [chartIndex, timeRange]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
      <div className="lg:col-span-2 glass-card p-8 border-white/5 bg-white/[0.03]">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-[#00ffab]/10 rounded-2xl"><ChartLine className="text-[#00ffab]" size={24} /></div>
            <div>
              <div className="flex gap-2 mb-1 items-center">
                {chartSymbols.map((s, i) => (
                  <button key={s} onClick={() => setChartIndex(i)} className={`text-[10px] font-black px-2 py-0.5 rounded-full transition-all ${chartIndex === i ? 'bg-[#00ffab] text-black' : 'bg-white/5 text-white/40'}`}>{s}</button>
                ))}
                {timeRange === '1D' && (
                  <span className="flex items-center gap-1 ml-2 text-[9px] font-black text-[#00ffab] uppercase tracking-widest">
                    <span className="w-1.5 h-1.5 bg-[#00ffab] rounded-full animate-ping inline-block" />
                    실시간
                  </span>
                )}
              </div>
              <h2 className="text-2xl font-black text-white tracking-tighter">{chartSymbols[chartIndex]} 지수</h2>
            </div>
          </div>
          <div className="flex gap-2 p-1 bg-white/5 rounded-xl border border-white/10">
            {['1D', '1W', '1M', '1Y'].map(r => (
              <button key={r} onClick={() => setTimeRange(r)} className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${timeRange === r ? 'bg-white text-black shadow-lg' : 'text-white/40 hover:text-white/60'}`}>{r}</button>
            ))}
          </div>
        </div>
        <div className="w-full flex-1" style={{ minHeight: '320px', height: '320px', position: 'relative', overflow: 'hidden', minWidth: 0 }}>
          {!loadingHistory && history && history.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <defs><linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#00ffab" stopOpacity={0.3}/><stop offset="95%" stopColor="#00ffab" stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" stroke="rgba(255,255,255,0.2)" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                <YAxis domain={['dataMin', 'dataMax']} hide />
                <Tooltip contentStyle={{backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '12px'}} />
                <Area type="monotone" dataKey="price" stroke="#00ffab" strokeWidth={3} fill="url(#colorPrice)" animationDuration={300} isAnimationActive={true} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-white/20 font-black italic">
              {loadingHistory ? "데이터 동기화 중..." : "차트 데이터 대기 중..."}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <div className="glass-card p-6 border-white/10 bg-gradient-to-br from-[#7000ff]/20 to-transparent flex-1">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-2 h-2 bg-[#00ffab] rounded-full animate-ping" />
            <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">실시간 시장 현황</span>
          </div>
          <div className="space-y-6">
            {chartSymbols.map(s => {
              const chg = parseFloat(indexChanges[s]);
              const isUp = chg >= 0;
              return (
                <div key={s} className="flex justify-between items-end pb-4 border-b border-white/5 last:border-0">
                  <div>
                    <div className="text-[10px] font-black text-white/30 uppercase mb-1">{s} NOW</div>
                    <div className="text-2xl font-mono font-black text-white tracking-tighter">{parseFloat(indexPrices[s] || '0').toLocaleString()}</div>
                  </div>
                  <div className="text-right">
                    <Activity className="text-[#7000ff]/40 mb-1 ml-auto" size={16} />
                    {indexChanges[s] !== null ? (
                      <div className={`text-[10px] font-bold ${isUp ? 'text-[#00ffab]' : 'text-red-400'}`}>
                        {isUp ? '+' : ''}{chg}%
                      </div>
                    ) : (
                      <div className="text-[10px] font-bold text-white/20">--</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketDashboard;

