import React, { useState } from 'react';

const MarketRankings = ({ dashboardData, news, onOpenPopup }) => {
  const [foreignTab, setForeignTab] = useState(0);
  const [instTab, setInstTab] = useState(0);
  const [rightTab, setRightTab] = useState(0);

  return (
    <main className="flex flex-col xl:flex-row gap-6 mb-8">
      <div className="flex-1 flex flex-col gap-6">
        {/* Sector & Theme Analysis */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-card border-white/5 overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-white/5 bg-white/[0.02]">
              <h3 className="font-bold text-white/80 text-sm italic uppercase tracking-widest">Sector Analysis</h3>
            </div>
            <div className="p-4">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-white/30 text-[10px] uppercase tracking-widest border-b border-white/5">
                    <th className="pb-3 text-left">업종명 (Sector)</th>
                    <th className="pb-3 text-right">등락</th>
                    <th className="pb-3 text-right px-4">비중</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  {(dashboardData?.sectors || []).slice(0, 10).map((it, i) => (
                    <tr key={i} onClick={() => onOpenPopup(it.name, 'INDEX', it.change, it.code)} className="hover:bg-white/[0.03] group transition-colors cursor-pointer">
                      <td className="py-3 text-white font-bold">{it.name}</td>
                      <td className="py-3 text-[#00ffab] font-black text-right tabular-nums">{it.change}</td>
                      <td className="py-3 text-right px-4"><div className="h-1.5 w-16 bg-white/5 rounded-full ml-auto overflow-hidden"><div className="h-full bg-blue-500" style={{width: it.width}}></div></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="glass-card border-white/5 overflow-hidden h-[500px] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-white/5 bg-white/[0.02]">
              <h3 className="font-bold text-white/80 text-sm italic uppercase tracking-widest">Theme Analysis</h3>
            </div>
            <div className="p-4 overflow-y-auto flex-1 custom-scrollbar">
              <table className="w-full text-xs">
                <thead className="text-white/30 text-[9px] uppercase tracking-widest sticky top-0 bg-[#141822] z-10">
                  <tr><th className="pb-3 text-left">테마명 (Theme)</th><th className="pb-3 text-right">등락</th><th className="pb-3 text-right">주도주</th></tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  {(dashboardData?.themes || []).slice(0, 10).map((it, i) => (
                    <tr key={i} onClick={() => onOpenPopup(it.name, 'INDEX', it.change, it.code)} className="hover:bg-white/[0.03] group transition-colors cursor-pointer">
                      <td className="py-3 text-white font-bold">{it.name}</td>
                      <td className="py-3 text-[#ff3d68] font-black text-right tabular-nums">{it.change}</td>
                      <td className="py-3 text-right"><span className="text-[10px] text-white/30 uppercase italic">{it.lead}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Foreign & Institution Volume */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-card border-white/5 overflow-hidden">
             <div className="flex border-b border-white/5 bg-white/[0.02] text-[10px] font-black uppercase">
               <div onClick={() => setForeignTab(0)} className={`flex-1 py-3 text-center cursor-pointer ${foreignTab === 0 ? 'bg-blue-600/20 text-blue-400' : 'text-white/20'}`}>외인 순매수</div>
               <div onClick={() => setForeignTab(1)} className={`flex-1 py-3 text-center cursor-pointer ${foreignTab === 1 ? 'bg-red-600/20 text-red-400' : 'text-white/20'}`}>외인 순매도</div>
             </div>
             <div className="p-4">
               <table className="w-full text-xs">
                 <tbody className="divide-y divide-white/[0.03]">
                  {(dashboardData?.foreign?.[foreignTab] || []).slice(0, 10).map((it, i) => (
                    <tr key={i} onClick={() => onOpenPopup(it.name, it.price, it.diff, it.symbol)} className="hover:bg-white/[0.03] group transition-colors cursor-pointer">
                      <td className="py-2.5 text-white/30 font-bold">{it.num}</td>
                      <td className="py-2.5 text-white font-bold px-2">{it.name}</td>
                      <td className="py-2.5 text-right font-mono text-white/80">{it.price}</td>
                      <td className={`py-2.5 text-right font-black ${it.isUp ? 'text-[#00ffab]' : 'text-[#0a6fe8]'}`}>{it.isUp?'▲':'▼'} {it.diff}</td>
                    </tr>
                  ))}
                 </tbody>
               </table>
             </div>
          </div>
          <div className="glass-card border-white/5 overflow-hidden">
             <div className="flex border-b border-white/5 bg-white/[0.02] text-[10px] font-black uppercase">
               <div onClick={() => setInstTab(0)} className={`flex-1 py-3 text-center cursor-pointer ${instTab === 0 ? 'bg-purple-600/20 text-purple-400' : 'text-white/20'}`}>기관 순매수</div>
               <div onClick={() => setInstTab(1)} className={`flex-1 py-3 text-center cursor-pointer ${instTab === 1 ? 'bg-red-600/20 text-red-400' : 'text-white/20'}`}>기관 순매도</div>
             </div>
             <div className="p-4">
               <table className="w-full text-xs">
                 <tbody className="divide-y divide-white/[0.03]">
                  {(dashboardData?.inst?.[instTab] || []).slice(0, 10).map((it, i) => (
                    <tr key={i} onClick={() => onOpenPopup(it.name, it.price, it.diff, it.symbol)} className="hover:bg-white/[0.03] group transition-colors cursor-pointer">
                      <td className="py-2.5 text-white/30 font-bold">{it.num}</td>
                      <td className="py-2.5 text-white font-bold px-2">{it.name}</td>
                      <td className="py-2.5 text-right font-mono text-white/80">{it.price}</td>
                      <td className={`py-2.5 text-right font-black ${it.isUp ? 'text-[#00ffab]' : 'text-[#0a6fe8]'}`}>{it.isUp?'▲':'▼'} {it.diff}</td>
                    </tr>
                  ))}
                 </tbody>
               </table>
             </div>
          </div>
        </div>
      </div>

      <div className="w-full xl:w-[320px] shrink-0 flex flex-col gap-6">
        <div className="glass-card border-white/5 overflow-hidden flex flex-col h-[550px]">
           <div className="flex border-b border-white/5 bg-white/[0.02] text-[10px] font-black uppercase tracking-widest divide-x divide-white/5">
              <div onClick={() => setRightTab(0)} className={`flex-1 text-center py-4 cursor-pointer ${rightTab === 0 ? 'bg-blue-600/10 text-blue-400' : 'text-white/30'}`}>Top Volume</div>
              <div onClick={() => setRightTab(1)} className={`flex-1 text-center py-4 cursor-pointer ${rightTab === 1 ? 'bg-purple-600/10 text-purple-400' : 'text-white/30'}`}>Top Gainers</div>
              <div onClick={() => setRightTab(2)} className={`flex-1 text-center py-4 cursor-pointer ${rightTab === 2 ? 'bg-emerald-600/10 text-emerald-400' : 'text-white/30'}`}>Live News</div>
           </div>
           <div className="p-4 overflow-y-auto flex-1 custom-scrollbar">
              {rightTab === 2 ? (
                <div className="flex flex-col gap-4 pr-2">
                  {news.map((item, i) => (
                    <div key={i} className="flex flex-col gap-1 group cursor-pointer" onClick={() => window.open(item.link, '_blank')}>
                      <span className="text-[11px] font-bold text-white/90 group-hover:text-emerald-400 transition-colors leading-tight line-clamp-2">{item.title}</span>
                      <span className="text-[9px] text-white/30 font-mono italic">{item.pubDate}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead className="text-white/30 text-[9px] uppercase tracking-widest sticky top-0 bg-[#1a1f2b] z-10">
                    <tr><th className="pb-3 text-left">Ticker</th><th className="pb-3 text-right">Price</th><th className="pb-3 text-right">Dir</th></tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.03]">
                    {(rightTab === 0 ? (dashboardData?.topStocks?.[0] || []) : (dashboardData?.topStocks?.[1] || [])).slice(0, 10).map((it, i) => (
                      <tr key={i} onClick={() => onOpenPopup(it.n, it.p, it.pct, it.s)} className="hover:bg-white/[0.03] transition-colors cursor-pointer group">
                        <td className="py-3 text-white font-bold uppercase tracking-tight">{it.n}</td>
                        <td className="py-3 text-right font-black text-white px-2 font-mono">{parseInt(it.p).toLocaleString()}원</td>
                        <td className={`py-3 text-right font-black ${parseFloat(it.pct) >= 0 ? 'text-[#00ffab]' : 'text-[#ff3d68]'}`}>{parseFloat(it.pct) >= 0 ? '▲' : '▼'}{it.pct}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
           </div>
        </div>
      </div>
    </main>
  );
};

export default MarketRankings;
