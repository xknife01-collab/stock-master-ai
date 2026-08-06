import React from 'react';

const FooterTicker = ({ stocks }) => {
  if (!stocks || stocks.length === 0) return null;

  return (
    <footer className="w-full bg-transparent border-t border-white/10 py-3 overflow-hidden mt-8">
      <div className="ticker-wrap w-full">
        <div className="ticker-content flex items-center gap-12 px-8">
          {[...stocks, ...stocks].map((stock, i) => (
            <div key={i} className="flex items-center gap-4 whitespace-nowrap">
              <span className="text-white font-black text-sm">{stock.name}</span>
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
  );
};

export default FooterTicker;
