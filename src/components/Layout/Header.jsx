import React from 'react';
import { TrendingUp } from 'lucide-react';

const Header = () => {
  return (
    <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-500/20 border border-white/10 group hover:scale-105 transition-transform">
          <TrendingUp className="text-white group-hover:rotate-12 transition-transform" size={28} />
        </div>
        <div>
          <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic bg-clip-text text-transparent bg-gradient-to-r from-white to-white/40">Antigravity Terminal</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] font-black text-[#00ffab] bg-[#00ffab]/10 px-2 py-0.5 rounded uppercase tracking-widest">System Online</span>
            <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Multi-Agent Quant v4.0</span>
          </div>
        </div>
      </div>
      <div className="flex gap-4">
        <div className="glass-card px-6 py-3 border-white/10 bg-white/5 flex flex-col items-end">
          <span className="text-[10px] font-black text-white/30 uppercase mb-1">Portfolio Value</span>
          <span className="text-xl font-mono font-black text-white">₩1,240.5M</span>
        </div>
      </div>
    </header>
  );
};

export default Header;
