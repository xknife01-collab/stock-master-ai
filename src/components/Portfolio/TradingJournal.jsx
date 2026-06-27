import React, { useState, useEffect } from 'react';
import { BookOpen, Plus, TrendingUp, TrendingDown, CheckCircle, Clock, Trash2, BarChart2, DollarSign, Target, Award } from 'lucide-react';
import { API_URL } from '../../config.js';

const ADMIN_EMAIL = 'zkfnth01@naver.com'; // 대표 관리자 전용

const TradingJournal = ({ user }) => {
    const isAdmin = user?.email === ADMIN_EMAIL;
    const [journal, setJournal] = useState([]);
    const [summary, setSummary] = useState(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [closingId, setClosingId] = useState(null);
    const [sellPriceInput, setSellPriceInput] = useState('');
    const [sellDateInput, setSellDateInput] = useState(new Date().toISOString().slice(0, 10));
    const [loading, setLoading] = useState(false);
    const [deleteLoadingId, setDeleteLoadingId] = useState(null);

    // 신규 등록 폼
    const [form, setForm] = useState({
        trade_date: new Date().toISOString().slice(0, 10),
        stock_name: '',
        symbol: '',
        signal_type: 'AI',
        buy_price: '',
        sell_price: '',
        sell_date: '',
        quantity: '',
        memo: ''
    });

    const fetchJournal = async () => {
        try {
            const res = await fetch(`${API_URL}/api/journal`);
            const data = await res.json();
            setJournal(Array.isArray(data) ? data : []);
        } catch (e) { console.error(e); }
    };

    const fetchSummary = async () => {
        try {
            const res = await fetch(`${API_URL}/api/journal/summary`);
            const data = await res.json();
            setSummary(data);
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        fetchJournal();
        fetchSummary();
    }, []);

    // 거래 등록
    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/journal`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form)
            });
            if (res.ok) {
                setForm({
                    trade_date: new Date().toISOString().slice(0, 10),
                    stock_name: '', symbol: '', signal_type: 'AI',
                    buy_price: '', sell_price: '', sell_date: '', quantity: '', memo: ''
                });
                setIsFormOpen(false);
                fetchJournal();
                fetchSummary();
            } else {
                const err = await res.json().catch(() => ({}));
                alert('등록 실패: ' + (err.error || '서버 오류'));
            }
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    // 매도 청산
    const handleClose = async (id) => {
        if (!sellPriceInput) return;
        try {
            const res = await fetch(`${API_URL}/api/journal/${id}/close`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sell_price: sellPriceInput, sell_date: sellDateInput })
            });
            if (res.ok) {
                setClosingId(null);
                setSellPriceInput('');
                setSellDateInput(new Date().toISOString().slice(0, 10));
                fetchJournal();
                fetchSummary();
            } else {
                const err = await res.json().catch(() => ({}));
                alert('청산 실패: ' + (err.error || '서버 오류'));
            }
        } catch (e) { console.error(e); }
    };

    // 삭제 (confirm 없이 바로 실행)
    const handleDelete = async (id) => {
        setDeleteLoadingId(id);
        try {
            const res = await fetch(`${API_URL}/api/journal/${id}`, { method: 'DELETE' });
            const text = await res.text();
            if (res.ok) {
                fetchJournal();
                fetchSummary();
            } else {
                alert('삭제 실패: ' + (text || `HTTP ${res.status}`));
            }
        } catch (e) {
            alert('삭제 오류: ' + e.message);
        } finally {
            setDeleteLoadingId(null);
        }
    };

    const formatNum = (n) => n != null ? Number(n).toLocaleString() : '-';

    return (
        <section className="mb-8">
            {/* 헤더 */}
            <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-6">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                        <BookOpen className="text-emerald-400" size={16} />
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-white uppercase tracking-tighter italic">AI Trading Journal</h2>
                        <div className="text-[9px] text-white/30 font-bold uppercase tracking-wider">실전 트레이딩 성과 기록</div>
                    </div>
                </div>
                {isAdmin && (
                    <button
                        onClick={() => setIsFormOpen(v => !v)}
                        className="flex items-center gap-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-400 text-xs font-black px-3 py-1.5 rounded-xl transition-all"
                    >
                        <Plus size={13} /> 거래 기록
                    </button>
                )}
            </div>

            {/* 성과 요약 카드 */}
            {summary && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    {[
                        { label: '총 거래', value: `${summary.totalTrades}건`, icon: <BarChart2 size={14} />, color: 'blue' },
                        { label: 'AI 적중률', value: `${summary.winRate}%`, icon: <Target size={14} />, color: 'emerald' },
                        { label: '누적 수익', value: `+₩${formatNum(summary.totalProfit)}`, icon: <DollarSign size={14} />, color: 'yellow' },
                        { label: '평균 수익률', value: `${summary.avgRate > 0 ? '+' : ''}${summary.avgRate}%`, icon: <Award size={14} />, color: 'purple' },
                    ].map((item, i) => (
                        <div key={i} className={`glass-card border border-${item.color}-500/10 bg-${item.color}-500/5 p-4 rounded-2xl`}>
                            <div className={`text-${item.color}-400 mb-2 flex items-center gap-1.5`}>
                                {item.icon}
                                <span className="text-[9px] font-black uppercase tracking-widest opacity-70">{item.label}</span>
                            </div>
                            <div className={`text-base font-black font-mono text-${item.color}-300`}>{item.value}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* 거래 등록 폼 */}
            {isFormOpen && isAdmin && (
                <div className="glass-card border border-emerald-500/20 bg-emerald-500/5 p-5 rounded-2xl mb-6">
                    <h3 className="text-xs font-black text-emerald-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Plus size={13} /> 새 거래 기록 등록
                    </h3>
                    <form onSubmit={handleSubmit} className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <div>
                            <label className="block text-[9px] font-black text-white/40 uppercase tracking-widest mb-1">매수일</label>
                            <input type="date" value={form.trade_date} onChange={e => setForm(f => ({ ...f, trade_date: e.target.value }))}
                                className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-emerald-500/40 font-mono" />
                        </div>
                        <div>
                            <label className="block text-[9px] font-black text-white/40 uppercase tracking-widest mb-1">종목명</label>
                            <input type="text" placeholder="예: 삼성전자" value={form.stock_name} onChange={e => setForm(f => ({ ...f, stock_name: e.target.value }))} required
                                className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-2 px-3 text-xs text-white placeholder-white/20 focus:outline-none focus:border-emerald-500/40" />
                        </div>
                        <div>
                            <label className="block text-[9px] font-black text-white/40 uppercase tracking-widest mb-1">종목코드</label>
                            <input type="text" placeholder="예: 005930" value={form.symbol} onChange={e => setForm(f => ({ ...f, symbol: e.target.value }))}
                                className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-2 px-3 text-xs text-white placeholder-white/20 focus:outline-none focus:border-emerald-500/40 font-mono" />
                        </div>
                        <div>
                            <label className="block text-[9px] font-black text-white/40 uppercase tracking-widest mb-1">매수가 (1주당, 원)</label>
                            <input type="number" placeholder="₩ 1주 단가" value={form.buy_price} 
                                onChange={e => setForm(f => ({ ...f, buy_price: e.target.value }))} 
                                required={form.signal_type !== 'NOTRADE' && form.signal_type !== 'VETO'}
                                disabled={form.signal_type === 'NOTRADE' || form.signal_type === 'VETO'}
                                className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-2 px-3 text-xs text-white placeholder-white/20 focus:outline-none focus:border-emerald-500/40 font-mono disabled:opacity-50" />
                        </div>
                        <div>
                            <label className="block text-[9px] font-black text-white/40 uppercase tracking-widest mb-1">수량 (주)</label>
                            <input type="number" placeholder="주" value={form.quantity} 
                                onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} 
                                required={form.signal_type !== 'NOTRADE' && form.signal_type !== 'VETO'}
                                disabled={form.signal_type === 'NOTRADE' || form.signal_type === 'VETO'}
                                className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-2 px-3 text-xs text-white placeholder-white/20 focus:outline-none focus:border-emerald-500/40 font-mono disabled:opacity-50" />
                        </div>
                        <div>
                            <label className="block text-[9px] font-black text-white/40 uppercase tracking-widest mb-1">신호 유형</label>
                            <select 
                                value={form.signal_type} 
                                onChange={e => {
                                    const val = e.target.value;
                                    setForm(f => {
                                        const next = { ...f, signal_type: val };
                                        if (val === 'NOTRADE' || val === 'VETO') {
                                            next.buy_price = '0';
                                            next.quantity = '0';
                                            if (!f.stock_name || f.stock_name === '시장 관망 (대기)' || f.stock_name === 'VETO 시장 진입 차단') {
                                                next.stock_name = val === 'NOTRADE' ? '시장 관망 (대기)' : 'VETO 시장 진입 차단';
                                            }
                                        } else {
                                            if (f.buy_price === '0') next.buy_price = '';
                                            if (f.quantity === '0') next.quantity = '';
                                            if (f.stock_name === '시장 관망 (대기)' || f.stock_name === 'VETO 시장 진입 차단') next.stock_name = '';
                                        }
                                        return next;
                                    });
                                }}
                                className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-emerald-500/40">
                                <option value="AI" className="bg-[#141822] text-white">AI 신호</option>
                                <option value="MANUAL" className="bg-[#141822] text-white">수동 판단</option>
                                <option value="CONDITION" className="bg-[#141822] text-white">조건검색</option>
                                <option value="QUANT" className="bg-[#141822] text-white">퀀트/알고리즘</option>
                                <option value="THEME" className="bg-[#141822] text-white">재료/테마</option>
                                <option value="VALUE" className="bg-[#141822] text-white">가치/실적</option>
                                <option value="QUANT_BOARD" className="bg-[#141822] text-white">계량 전광판</option>
                                <option value="RISK_CENTER" className="bg-[#141822] text-white">실시간 리스크 센터</option>
                                <option value="NOTRADE" className="bg-[#141822] text-white">관망 (No Trade)</option>
                                <option value="VETO" className="bg-[#141822] text-white">VETO 차단 (Risk Off)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[9px] font-black text-white/40 uppercase tracking-widest mb-1">매도가 (1주당, 선택)</label>
                            <input type="number" placeholder="입력 시 청산 처리" value={form.sell_price} onChange={e => setForm(f => ({ ...f, sell_price: e.target.value }))}
                                className="w-full bg-white/[0.03] border border-emerald-500/20 rounded-xl py-2 px-3 text-xs text-emerald-300 placeholder-white/20 focus:outline-none focus:border-emerald-500/40 font-mono" />
                        </div>
                        <div>
                            <label className="block text-[9px] font-black text-white/40 uppercase tracking-widest mb-1">청산일 (선택)</label>
                            <input type="date" value={form.sell_date} onChange={e => setForm(f => ({ ...f, sell_date: e.target.value }))}
                                className="w-full bg-white/[0.03] border border-emerald-500/20 rounded-xl py-2 px-3 text-xs text-emerald-300 focus:outline-none focus:border-emerald-500/40 font-mono" />
                        </div>
                        <div className="col-span-2 md:col-span-3">
                            <label className="block text-[9px] font-black text-white/40 uppercase tracking-widest mb-1">메모 (선택)</label>
                            <input type="text" placeholder="AI 추천 이유, 시황 메모 등" value={form.memo} onChange={e => setForm(f => ({ ...f, memo: e.target.value }))}
                                className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-2 px-3 text-xs text-white placeholder-white/20 focus:outline-none focus:border-emerald-500/40" />
                        </div>
                        <div className="col-span-2 md:col-span-3 flex gap-2">
                            <button type="submit" disabled={loading}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all">
                                {loading ? '저장 중...' : '거래 기록 저장'}
                            </button>
                            <button type="button" onClick={() => setIsFormOpen(false)}
                                className="px-4 bg-white/5 hover:bg-white/10 text-white/50 py-2.5 rounded-xl text-xs font-black transition-all">
                                취소
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* 거래 기록 리스트 */}
            <div className="space-y-3">
                {journal.length === 0 ? (
                    <div className="border border-dashed border-white/5 rounded-2xl py-12 text-center text-white/20 text-xs font-bold bg-white/[0.01]">
                        아직 거래 기록이 없습니다. 첫 거래를 기록해보세요!
                    </div>
                ) : (
                    journal.map(entry => {
                        const isOpen = entry.status === 'open';
                        const isProfit = (entry.profit_amount || 0) > 0;
                        const isNoTrade = entry.signal_type === 'NOTRADE' || entry.signal_type === 'VETO' || entry.quantity === 0;
                        
                        return (
                            <div key={entry.id}
                                className={`glass-card p-4 rounded-2xl border-l-4 transition-all ${
                                    isNoTrade 
                                        ? (entry.signal_type === 'VETO' ? 'border-l-red-500 bg-red-500/5' : 'border-l-amber-500 bg-amber-500/5')
                                        : isOpen 
                                        ? 'border-l-blue-500 bg-blue-500/5' 
                                        : isProfit 
                                        ? 'border-l-emerald-500 bg-emerald-500/5' 
                                        : 'border-l-red-500 bg-red-500/5'
                                }`}>
                                <div className="flex items-start justify-between gap-4">
                                    {/* 왼쪽: 종목 정보 */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-black text-sm text-white">{entry.stock_name}</span>
                                            {entry.symbol && <span className="text-[9px] font-mono text-white/30">{entry.symbol}</span>}
                                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider border ${
                                                entry.signal_type === 'NOTRADE'
                                                    ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                                                    : entry.signal_type === 'VETO'
                                                    ? 'text-red-400 bg-red-500/10 border-red-500/20'
                                                    : entry.signal_type === 'AI'
                                                    ? 'text-purple-400 bg-purple-500/10 border-purple-500/20'
                                                    : entry.signal_type === 'MANUAL'
                                                    ? 'text-blue-400 bg-blue-500/10 border-blue-500/20'
                                                    : entry.signal_type === 'CONDITION'
                                                    ? 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20'
                                                    : entry.signal_type === 'QUANT'
                                                    ? 'text-teal-400 bg-teal-500/10 border-teal-500/20'
                                                    : entry.signal_type === 'THEME'
                                                    ? 'text-pink-400 bg-pink-500/10 border-pink-500/20'
                                                    : entry.signal_type === 'VALUE'
                                                    ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                                                    : entry.signal_type === 'QUANT_BOARD'
                                                    ? 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20'
                                                    : entry.signal_type === 'RISK_CENTER'
                                                    ? 'text-orange-400 bg-orange-500/10 border-orange-500/20'
                                                    : 'text-white/40 bg-white/5 border border-white/10'
                                            }`}>
                                                {entry.signal_type === 'QUANT_BOARD' 
                                                    ? '계량 전광판' 
                                                    : entry.signal_type === 'RISK_CENTER' 
                                                    ? '리스크 센터' 
                                                    : entry.signal_type === 'QUANT'
                                                    ? '퀀트'
                                                    : entry.signal_type === 'THEME'
                                                    ? '테마'
                                                    : entry.signal_type === 'VALUE'
                                                    ? '가치분석'
                                                    : entry.signal_type === 'VETO'
                                                    ? 'VETO 차단'
                                                    : entry.signal_type === 'NOTRADE'
                                                    ? 'NO TRADE'
                                                    : entry.signal_type}
                                            </span>
                                            {!isNoTrade && (
                                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider flex items-center gap-1 ${isOpen ? 'text-blue-400 bg-blue-500/10 border border-blue-500/20' : 'text-white/40 bg-white/5 border border-white/10'}`}>
                                                    {isOpen ? <><Clock size={8} /> 보유중</> : <><CheckCircle size={8} /> 청산완료</>}
                                                </span>
                                            )}
                                        </div>
                                        {isNoTrade ? (
                                            <div className="flex items-center gap-3 mt-1.5 text-[10px] font-mono text-amber-400/80 flex-wrap">
                                                <span className={entry.signal_type === 'VETO' ? 'text-red-400 font-bold' : 'text-amber-400 font-bold'}>
                                                    {entry.signal_type === 'VETO' ? '차단 결정일' : '관망 결정일'}: {entry.trade_date}
                                                </span>
                                                <span className="text-white/30">(실제 매매 없음)</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-3 mt-1.5 text-[10px] font-mono text-white/40 flex-wrap">
                                                <span>매수 {entry.trade_date}</span>
                                                <span>₩{formatNum(entry.buy_price)}/주</span>
                                                <span>{entry.quantity}주</span>
                                                {entry.sell_price && <span className="text-emerald-400">매도 ₩{formatNum(entry.sell_price)}/주</span>}
                                                {entry.sell_date && <span className="text-emerald-400">청산일 {entry.sell_date}</span>}
                                            </div>
                                        )}
                                        {entry.memo && <p className="text-[9px] text-white/30 mt-1 truncate">{entry.memo}</p>}
                                    </div>

                                    {/* 오른쪽: 수익 + 액션 */}
                                    <div className="text-right shrink-0">
                                        {isNoTrade ? (
                                            <div className={`text-xs font-black px-2 py-0.5 rounded inline-block uppercase tracking-wider ${
                                                entry.signal_type === 'VETO'
                                                    ? 'text-red-400 bg-red-500/10 border border-red-500/20'
                                                    : 'text-amber-400 bg-amber-500/10 border border-amber-500/20'
                                            }`}>
                                                RISK OFF
                                            </div>
                                        ) : !isOpen && entry.profit_amount != null ? (
                                            <>
                                                <div className={`text-base font-black font-mono ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                                                    {isProfit ? '+' : ''}₩{formatNum(entry.profit_amount)}
                                                </div>
                                                <div className={`text-[10px] font-black ${isProfit ? 'text-emerald-500' : 'text-red-500'}`}>
                                                    {isProfit ? '+' : ''}{entry.profit_rate}%
                                                    {isProfit ? <TrendingUp size={10} className="inline ml-1" /> : <TrendingDown size={10} className="inline ml-1" />}
                                                </div>
                                            </>
                                        ) : isOpen ? (
                                            <div className="text-[10px] text-blue-400 font-black">보유 중</div>
                                        ) : null}

                                        {/* 관리자 액션 버튼 */}
                                        {isAdmin && (
                                            <div className="flex items-center gap-1 mt-2 justify-end">
                                                {/* 매도 청산 버튼 (보유 중인 경우만) */}
                                                {isOpen && (
                                                    closingId === entry.id ? (
                                                        <div className="flex flex-col gap-1 items-end">
                                                            <div className="flex items-center gap-1">
                                                                <input type="date" value={sellDateInput}
                                                                    onChange={e => setSellDateInput(e.target.value)}
                                                                    className="bg-white/10 border border-emerald-500/40 rounded px-2 py-1 text-xs text-white font-mono w-32 focus:outline-none" />
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                <input type="number" placeholder="매도가(1주)" value={sellPriceInput}
                                                                    onChange={e => setSellPriceInput(e.target.value)}
                                                                    className="bg-white/10 border border-emerald-500/40 rounded px-2 py-1 text-xs text-white font-mono w-28 focus:outline-none" />
                                                                <button onClick={() => handleClose(entry.id)}
                                                                    className="bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-400 border border-emerald-500/30 rounded px-2 py-1 text-[10px] font-black">
                                                                    청산
                                                                </button>
                                                                <button onClick={() => { setClosingId(null); setSellPriceInput(''); }}
                                                                    className="text-white/30 text-[10px] px-1">✕</button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <button onClick={() => setClosingId(entry.id)}
                                                            className="text-[9px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded hover:bg-emerald-500/20 transition-all">
                                                            매도 청산
                                                        </button>
                                                    )
                                                )}
                                                {/* 삭제 버튼 */}
                                                <button
                                                    onClick={() => handleDelete(entry.id)}
                                                    disabled={deleteLoadingId === entry.id}
                                                    className="text-white/20 hover:text-red-400 disabled:opacity-30 p-1 rounded transition-all"
                                                    title="삭제">
                                                    <Trash2 size={11} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </section>
    );
};

export default TradingJournal;
