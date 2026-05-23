import React, { useState } from 'react';
import { Wallet, Plus, Trash2, Bell, AlertTriangle, Edit2, Check } from 'lucide-react';

const PortfolioSection = ({ user, portfolio, onOpenLogin, onAddStock, onDeleteStock, onUpdateStopLoss }) => {
  // Form states
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [stopLossPrice, setStopLossPrice] = useState('');
  
  // Edit states
  const [editingId, setEditingId] = useState(null);
  const [editSlValue, setEditSlValue] = useState('');

  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (!name || !symbol || !purchasePrice || !stopLossPrice) {
      alert('모든 필드를 입력해 주세요.');
      return;
    }
    onAddStock({
      name,
      symbol: symbol.trim(),
      purchasePrice: Number(purchasePrice),
      stopLossPrice: Number(stopLossPrice)
    });
    // Reset form
    setName('');
    setSymbol('');
    setPurchasePrice('');
    setStopLossPrice('');
  };

  const startEdit = (stock) => {
    setEditingId(stock.id);
    setEditSlValue(stock.stopLossPrice);
  };

  const saveEdit = (id) => {
    onUpdateStopLoss(id, Number(editSlValue));
    setEditingId(null);
  };

  // 1. 로그아웃 상태일 때 안내 UI
  if (!user) {
    return (
      <section className="mb-20 glass-card border border-white/5 bg-[#141822] p-8 rounded-3xl text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-blue-500/20"></div>
        <Wallet className="mx-auto text-white/20 mb-4" size={48} />
        <h2 className="text-xl font-black text-white uppercase italic tracking-tighter mb-2">My Monitoring Portfolio</h2>
        <p className="text-xs text-white/50 mb-6 max-w-sm mx-auto leading-relaxed">
          본인 보유 주식을 등록하고 손절 기준가를 설정하면,<br />
          실시간 주가가 손절가 이하로 내려갔을 때 즉시 문자/카톡으로 알림을 받을 수 있습니다.
        </p>
        <button 
          onClick={onOpenLogin}
          className="bg-blue-600 hover:bg-blue-500 border border-blue-400/30 rounded-xl px-6 py-3 text-xs font-black uppercase tracking-widest text-white transition-all shadow-[0_0_20px_rgba(59,130,246,0.2)]"
        >
          포트폴리오 가동 (로그인)
        </button>
      </section>
    );
  }

  return (
    <section className="mb-20 flex flex-col gap-6">
      {/* Section Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
            <Wallet className="text-purple-400" size={16} />
          </div>
          <div>
            <h2 className="text-lg font-black text-white uppercase tracking-tighter italic">My Active Portfolio</h2>
            <div className="text-[9px] text-white/30 font-bold uppercase tracking-wider">Stop-Loss Monitoring Network</div>
          </div>
        </div>
        <span className="text-[10px] font-mono text-purple-400 bg-purple-400/10 px-2 py-0.5 rounded font-black">
          {portfolio.length} STOCKS TRACKED
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* 2. 주식 등록 폼 (왼쪽 1열) */}
        <div className="glass-card border border-white/5 bg-gradient-to-b from-[#1a1f2b] to-[#141822] p-6 rounded-2xl">
          <h3 className="text-sm font-black text-white uppercase tracking-wider mb-4 flex items-center gap-2">
            <Plus size={16} className="text-blue-400" /> 신규 보유 주식 등록
          </h3>
          <form onSubmit={handleAddSubmit} className="space-y-4">
            <div>
              <label className="block text-[9px] font-black text-white/40 uppercase tracking-widest mb-1">종목 이름</label>
              <input 
                type="text" 
                placeholder="예: 삼성전자"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full bg-white/[0.02] border border-white/10 rounded-xl py-2.5 px-3.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-blue-500/40 font-bold"
              />
            </div>
            <div>
              <label className="block text-[9px] font-black text-white/40 uppercase tracking-widest mb-1">종목 코드 (6자리)</label>
              <input 
                type="text" 
                placeholder="예: 005930"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                required
                className="w-full bg-white/[0.02] border border-white/10 rounded-xl py-2.5 px-3.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-blue-500/40 font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[9px] font-black text-white/40 uppercase tracking-widest mb-1">평균 매수가</label>
                <input 
                  type="number" 
                  placeholder="₩"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                  required
                  className="w-full bg-white/[0.02] border border-white/10 rounded-xl py-2.5 px-3.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-blue-500/40 font-mono"
                />
              </div>
              <div>
                <label className="block text-[9px] font-black text-white/40 uppercase tracking-widest mb-1 text-red-400">목표 손절가</label>
                <input 
                  type="number" 
                  placeholder="₩"
                  value={stopLossPrice}
                  onChange={(e) => setStopLossPrice(e.target.value)}
                  required
                  className="w-full bg-white/[0.02] border border-white/10 rounded-xl py-2.5 px-3.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-red-500/40 font-mono"
                />
              </div>
            </div>
            <button 
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-500 border border-blue-500/20 text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all mt-2"
            >
              감시 대상 등록
            </button>
          </form>
        </div>

        {/* 3. 등록된 주식 카드 리스트 (오른쪽 2열) */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          {portfolio.length === 0 ? (
            <div className="col-span-full border border-dashed border-white/5 rounded-2xl py-16 text-center text-white/20 text-xs font-bold bg-white/[0.01]">
              등록된 보유 주식이 없습니다. 왼쪽 폼에서 첫 종목을 감시 등록해보세요!
            </div>
          ) : (
            portfolio.map(stock => {
              // 수익률 계산
              const currentLoss = stock.purchasePrice ? ((stock.price - stock.purchasePrice) / stock.purchasePrice) * 100 : 0;
              const isStopLossBreached = stock.price > 0 && stock.price <= stock.stopLossPrice;

              return (
                <div 
                  key={stock.id} 
                  className={`glass-card p-5 border-l-4 transition-all flex flex-col justify-between h-48 relative overflow-hidden ${isStopLossBreached ? 'border-l-[#ff3d68] bg-[#ff3d68]/5' : 'border-l-[#7000ff] bg-white/5'}`}
                >
                  {/* Top Bar */}
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-base font-black text-white tracking-tight flex items-center gap-1.5">
                        {stock.name} 
                        <span className="text-[9px] font-mono text-white/30 font-bold">{stock.symbol}</span>
                      </h4>
                      <p className="text-[10px] text-white/40 font-mono mt-0.5">
                        평단가: ₩{stock.purchasePrice?.toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {/* Alert State Badge */}
                      {stock.isAlerted ? (
                        <span className="flex items-center gap-1 text-[8px] font-black text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded uppercase tracking-wider">
                          <AlertTriangle size={10} /> 알림 발송됨
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[8px] font-black text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded uppercase tracking-wider">
                          <Bell size={10} className="animate-pulse" /> 감시 중
                        </span>
                      )}
                      {/* Delete Button */}
                      <button 
                        onClick={() => onDeleteStock(stock.id)}
                        className="text-white/30 hover:text-red-400 p-1 hover:bg-white/5 rounded transition-all"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Middle Bar: Prices & Return */}
                  <div className="my-2">
                    <div className="text-2xl font-mono font-black text-white tracking-tighter">
                      {stock.price ? `₩${Math.round(stock.price).toLocaleString()}` : '₩---'}
                    </div>
                    <div className={`text-[11px] font-black flex items-center gap-1 mt-0.5 ${currentLoss >= 0 ? 'text-[#00ffab]' : 'text-[#ff3d68]'}`}>
                      {currentLoss >= 0 ? '+' : ''}{currentLoss.toFixed(2)}%
                      <span className="text-[9px] font-normal opacity-50">
                        (매수대비 {currentLoss >= 0 ? '익절권' : '손실권'})
                      </span>
                    </div>
                  </div>

                  {/* Bottom Bar: Stop Loss Controls */}
                  <div className="border-t border-white/5 pt-3 flex justify-between items-center bg-white/[0.01]">
                    <div className="text-[9px] font-black text-white/40 uppercase tracking-widest">
                      위험선(손절가)
                    </div>
                    {editingId === stock.id ? (
                      <div className="flex items-center gap-1">
                        <input 
                          type="number"
                          value={editSlValue}
                          onChange={(e) => setEditSlValue(e.target.value)}
                          className="bg-white/10 border border-blue-500/50 rounded px-1.5 py-0.5 text-xs text-white font-mono w-24 focus:outline-none"
                        />
                        <button 
                          onClick={() => saveEdit(stock.id)}
                          className="bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 rounded p-1"
                        >
                          <Check size={11} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className={`font-mono text-xs font-bold ${isStopLossBreached ? 'text-red-400 line-through' : 'text-red-300'}`}>
                          ₩{stock.stopLossPrice?.toLocaleString()}
                        </span>
                        <button 
                          onClick={() => startEdit(stock)}
                          className="text-white/20 hover:text-white p-0.5 rounded transition-all"
                        >
                          <Edit2 size={10} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
};

export default PortfolioSection;
