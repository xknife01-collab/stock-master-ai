import React from 'react';
import { TrendingUp, Activity } from 'lucide-react';

const GainerSection = ({ dashboardData, onOpenPopup }) => {
  const gainers = (dashboardData?.topStocks?.[1] || []).slice(0, 10);

  return (
    <div className="glass-card border-[#ff3d68]/10 bg-gradient-to-br from-[#ff3d68]/5 to-transparent h-full flex flex-col p-6 overflow-hidden">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-400/10 rounded-xl flex items-center justify-center border border-red-400/20">
            <TrendingUp className="text-[#ff3d68]" size={20} />
          </div>
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-tighter">Real-time Gainers</h3>
            <div className="text-[9px] text-white/30 font-black uppercase tracking-widest">실시간 급등주 (KOSPI/KOSDAQ)</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse"></div>
          <span className="text-[9px] font-black text-white/40 uppercase">Live</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <table className="w-full text-xs">
          <thead className="text-white/30 text-[9px] uppercase tracking-widest sticky top-0 bg-[#1a1f2b] z-10">
            <tr className="border-b border-white/5">
              <th className="pb-3 text-left">종목명</th>
              <th className="pb-3 text-right">현재가</th>
              <th className="pb-3 text-right">등락률</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.03]">
            {gainers.map((it, i) => (
              <tr 
                key={i} 
                onClick={() => onOpenPopup(it.n, it.p, it.pct, it.s)} 
                className="hover:bg-white/[0.03] transition-all cursor-pointer group"
              >
                <td className="py-3 pr-2">
                  <div className="flex flex-col">
                    <span className="text-white font-bold group-hover:text-red-400 transition-colors truncate max-w-[120px]">{it.n}</span>
                    <span className="text-[10px] text-white/30 font-mono">{it.s}</span>
                  </div>
                </td>
                <td className="py-3 text-right font-black text-white font-mono">
                  {parseInt(it.p).toLocaleString()}원
                </td>
                <td className={`py-3 text-right font-black ${parseFloat(it.pct) >= 0 ? 'text-[#00ffab]' : 'text-[#ff3d68]'}`}>
                  <div className="flex items-center justify-end gap-1">
                    {parseFloat(it.pct) >= 0 ? '▲' : '▼'}
                    {it.pct}
                  </div>
                </td>
              </tr>
            ))}
            {gainers.length === 0 && (
              <tr>
                <td colSpan="3" className="py-10 text-center text-white/20 italic font-black">데이터 수신 중...</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
        <span className="text-[9px] font-black text-white/20 uppercase tracking-widest underline decoration-red-400/30">KIS Market Scan Active</span>
        <Activity size={12} className="text-white/10" />
      </div>
    </div>
  );
};

export default GainerSection;
