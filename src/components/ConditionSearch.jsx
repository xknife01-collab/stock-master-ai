import React, { useState, useEffect } from 'react';
import { TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ConditionSearch = ({ onOpenPopup, conditionAlerts }) => {
  const [conditionList, setConditionList] = useState([]);
  const [selectedCondSeq, setSelectedCondSeq] = useState(null);
  const [conditionStocks, setConditionStocks] = useState([]);
  const [loadingCondition, setLoadingCondition] = useState(false);

  useEffect(() => {
    fetch('http://localhost:5000/api/condition-list')
      .then(res => res.json())
      .then(data => {
        setConditionList(data);
        if (data.length > 0) setSelectedCondSeq(data[0].seq);
      })
      .catch(e => console.error('Condition list load fail', e));
  }, []);

  useEffect(() => {
    if (selectedCondSeq === null) return;
    setLoadingCondition(true);
    fetch(`http://localhost:5000/api/condition-search/${selectedCondSeq}`)
      .then(res => res.json())
      .then(data => setConditionStocks(data))
      .catch(e => console.error('Condition search fail', e))
      .finally(() => setLoadingCondition(false));
  }, [selectedCondSeq]);

  return (
    <section className="mb-12 flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <TrendingUp className="text-yellow-400" size={24} />
          <h2 className="text-xl font-bold text-white">개인화 종목 발굴 (HTS 조건검색)</h2>
        </div>
        {loadingCondition && <div className="text-[10px] text-white/40 animate-pulse font-mono font-black">SEARCHING KIS QUANT...</div>}
      </div>

      <div className="flex flex-wrap gap-2 mb-2">
        {conditionList.map(cond => (
          <button
            key={cond.seq}
            onClick={() => setSelectedCondSeq(cond.seq)}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
              selectedCondSeq === cond.seq
                ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.2)]'
                : 'bg-white/5 border-white/5 text-white/30 hover:text-white/60'
            }`}
          >
            {cond.name}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {selectedCondSeq !== null && conditionList.find(c => c.seq === selectedCondSeq)?.desc && (
          <motion.div 
            key={selectedCondSeq}
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-3 text-[11px] text-yellow-200/70 italic flex items-start gap-2"
          >
            <span className="text-yellow-500 font-black shrink-0">CRITERIA:</span>
            <span>{conditionList.find(c => c.seq === selectedCondSeq).desc}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="w-full">
        {/* 매칭 종목 테이블 */}
        <div className="glass-card border-white/5 overflow-hidden">
          <div className="p-4 bg-white/[0.02] border-b border-white/5">
            <span className="text-[10px] font-black text-white/40 uppercase italic">Active Signals for {conditionList.find(c => c.seq === selectedCondSeq)?.name}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="text-white/20 text-[9px] uppercase tracking-widest border-b border-white/5">
                  <th className="p-4">Ticker/Name</th>
                  <th className="p-4 text-right">Current Price</th>
                  <th className="p-4 text-right">Fluctuation</th>
                  <th className="p-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {conditionStocks.length > 0 ? (
                  conditionStocks.map((s, idx) => (
                    <tr key={idx} className="hover:bg-white/[0.03] transition-colors group">
                      <td className="p-4">
                        <div className="text-white font-bold">{s.name}</div>
                        <div className="text-[9px] text-white/20 font-mono italic">{s.code}</div>
                      </td>
                      <td className="p-4 text-right text-white/80 font-mono">₩{s.price}</td>
                      <td className={`p-4 text-right font-black ${parseFloat(s.change) >= 0 ? 'text-[#00ffab]' : 'text-[#ff3d68]'}`}>
                        {parseFloat(s.change) >= 0 ? '+' : ''}{s.change}
                      </td>
                      <td className="p-4 text-center">
                        <button 
                          onClick={() => onOpenPopup(s.name, s.price, s.change, s.code)}
                          className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-[9px] font-black text-white/50 hover:bg-yellow-500/20 hover:text-yellow-400 hover:border-yellow-500/30 transition-all"
                        >
                          AI ANALYSIS
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="4" className="p-12 text-center text-white/10 italic">해당 조건에 탐지된 종목이 없습니다.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ConditionSearch;
