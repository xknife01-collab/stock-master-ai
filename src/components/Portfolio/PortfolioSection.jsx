import React from 'react';
import { Wallet, Activity } from 'lucide-react';

const PortfolioSection = ({ portfolio }) => {
  return (
    <section className="mb-20 flex flex-col">
      <div className="flex items-center gap-2 mb-6">
        <Wallet className="text-[#7000ff]" size={24} />
        <h2 className="text-xl font-bold text-white">내 포트폴리오 (자동 손절 감시)</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {portfolio.map(stock => {
          const currentLoss = stock.purchasePrice ? ((stock.price - stock.purchasePrice) / stock.purchasePrice) * 100 : 0;
          const isWarning = currentLoss <= -5;
          return (
            <div 
              key={stock.id} 
              className={`glass-card p-6 border-l-4 transition-all ${isWarning ? 'border-l-[#ff3d68] bg-[#ff3d68]/5' : 'border-l-[#7000ff] bg-white/5'}`}
            >
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
  );
};

export default PortfolioSection;
