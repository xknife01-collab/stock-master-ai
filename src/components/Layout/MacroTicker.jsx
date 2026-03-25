import React, { useState, useEffect } from 'react';
import { Globe, TrendingUp, TrendingDown, Activity, Fuel, Coins } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const MacroTicker = () => {
  const [macroData, setMacroData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMacro = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/macro');
        const data = await response.json();
        if (Array.isArray(data)) {
          setMacroData(data);
        }
      } catch (e) {
        console.error('Macro fetch failed', e);
      } finally {
        setLoading(false);
      }
    };

    fetchMacro();
    const interval = setInterval(fetchMacro, 60000); // 1분마다 갱신
    return () => clearInterval(interval);
  }, []);

  if (loading && macroData.length === 0) return null;

  return (
    <div className="w-full bg-[#0d121f]/80 backdrop-blur-md border-b border-white/5 py-2 px-4 overflow-hidden z-50 sticky top-0">
      <div className="max-w-[1600px] mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2 mr-6 shrink-0">
          <div className="w-6 h-6 bg-blue-500/10 rounded flex items-center justify-center border border-blue-500/20">
            <Globe className="text-blue-400" size={12} />
          </div>
          <span className="text-[10px] font-black text-white/40 uppercase tracking-widest hidden sm:inline">Global Macro</span>
        </div>

        <div className="flex-1 overflow-hidden relative h-6">
          <div className="flex items-center gap-8 whitespace-nowrap animate-marquee">
            {macroData.map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 group px-4 border-r border-white/5 last:border-0">
                <div className="text-[10px] font-black text-white/30 uppercase tracking-tighter group-hover:text-white/60 transition-colors">
                  {item.label}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-white tracking-tight">
                    {item.value}
                  </span>
                  <span className={`text-[10px] font-black flex items-center gap-0.5 ${item.isUp ? 'text-red-400' : 'text-blue-400'}`}>
                    {item.isUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                    {item.change}
                  </span>
                </div>
              </div>
            ))}
            {/* Loop for continuous marquee */}
            {macroData.map((item, idx) => (
              <div key={`dup-${idx}`} className="flex items-center gap-3 group px-4 border-r border-white/5 last:border-0">
                <div className="text-[10px] font-black text-white/30 uppercase tracking-tighter group-hover:text-white/60 transition-colors">
                  {item.label}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-white tracking-tight">
                    {item.value}
                  </span>
                  <span className={`text-[10px] font-black flex items-center gap-0.5 ${item.isUp ? 'text-red-400' : 'text-blue-400'}`}>
                    {item.isUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                    {item.change}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4 ml-6 shrink-0">
            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 bg-white/5 rounded-full border border-white/10">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-[9px] font-black text-white/50 uppercase tracking-tighter">Live Market Feed</span>
            </div>
        </div>
      </div>
      
      <style jsx>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          display: inline-flex;
          animation: marquee 30s linear infinite;
        }
        .animate-marquee:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
};

export default MacroTicker;
