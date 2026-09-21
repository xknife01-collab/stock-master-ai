import React, { useState, useEffect } from 'react';
import { 
  X, Calendar, TrendingUp, BarChart2, ShieldAlert, 
  Share2, ExternalLink, ChevronRight, Sparkles, Filter, 
  Eye, Award, CheckCircle2, AlertTriangle, ArrowUpRight
} from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ufkxxiuuefbefmtcnvtl.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_A_1jVOIjpEKNVOO6ugEtrQ_ZayCYgZW';

const QuantResearchModal = ({ isOpen, onClose }) => {
  const [posts, setPosts] = useState([]);
  const [selectedPost, setSelectedPost] = useState(null);
  const [filter, setFilter] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [isCopied, setIsCopied] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const fetchPosts = async () => {
      setIsLoading(true);
      try {
        const url = `${SUPABASE_URL}/rest/v1/quant_research_posts?select=*&is_published=eq.true&order=created_at.desc&limit=30`;
        const res = await fetch(url, {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setPosts(data);
            setSelectedPost(data[0]);
          }
        }
      } catch (err) {
        console.error('Failed to fetch quant research posts:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPosts();
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredPosts = posts.filter(p => {
    if (filter === 'ALL') return true;
    return p.category === filter;
  });

  const handleShare = () => {
    if (navigator.clipboard && selectedPost) {
      navigator.clipboard.writeText(window.location.href);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const getCategoryBadge = (cat) => {
    switch (cat) {
      case 'SEMICONDUCTOR':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-black text-amber-400 bg-amber-400/10 border border-amber-400/30 px-2.5 py-1 rounded-md">
            <Award size={12} /> 👑 반도체 주도주
          </span>
        );
      case 'RANK1':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-black text-[#00ffab] bg-[#00ffab]/10 border border-[#00ffab]/30 px-2.5 py-1 rounded-md">
            <Sparkles size={12} /> 🥇 전광판 1위
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-black text-blue-400 bg-blue-400/10 border border-blue-400/30 px-2.5 py-1 rounded-md">
            <TrendingUp size={12} /> 📈 퀀트 시황
          </span>
        );
    }
  };

  const quant = selectedPost?.quant_data || {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-6xl h-[92vh] bg-[#0d1322] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#00ffab]/20 to-blue-600/20 border border-[#00ffab]/40 flex items-center justify-center text-[#00ffab]">
              <BarChart2 size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg md:text-xl font-black text-white tracking-tight">QUANT RESEARCH CENTER</h2>
                <span className="text-[10px] font-black text-[#00ffab] bg-[#00ffab]/10 border border-[#00ffab]/30 px-2 py-0.5 rounded uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00ffab] animate-pulse" /> LIVE
                </span>
              </div>
              <p className="text-xs text-white/50 hidden sm:block">10분 계량 엔진 전광판 기반 실시간 주도주 심층 분석 칼럼</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleShare}
              className="text-xs font-bold text-white/70 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-2 rounded-xl transition-all flex items-center gap-1.5"
              title="현재 칼럼 링크 복사"
            >
              <Share2 size={14} />
              <span className="hidden sm:inline">{isCopied ? '링크 복사완료!' : '공유'}</span>
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 flex items-center justify-center transition-all"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Body: Left List + Right Detail */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          
          {/* Left: Article List Sidebar */}
          <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-white/10 bg-black/20 flex flex-col overflow-hidden max-h-[220px] md:max-h-full">
            {/* Filter Tabs */}
            <div className="p-3 border-b border-white/10 flex gap-1.5 overflow-x-auto">
              <button
                onClick={() => setFilter('ALL')}
                className={`text-[11px] font-bold px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                  filter === 'ALL'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                전체 ({posts.length})
              </button>
              <button
                onClick={() => setFilter('RANK1')}
                className={`text-[11px] font-bold px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                  filter === 'RANK1'
                    ? 'bg-[#00ffab]/20 text-[#00ffab] border border-[#00ffab]/40'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                🥇 1위 주도주
              </button>
              <button
                onClick={() => setFilter('SEMICONDUCTOR')}
                className={`text-[11px] font-bold px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                  filter === 'SEMICONDUCTOR'
                    ? 'bg-amber-400/20 text-amber-400 border border-amber-400/40'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                👑 반도체
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto divide-y divide-white/5 p-2">
              {isLoading ? (
                <div className="p-8 text-center text-white/40 text-xs flex flex-col items-center gap-2">
                  <div className="w-6 h-6 border-2 border-[#00ffab] border-t-transparent rounded-full animate-spin" />
                  <span>리서치 데이터 로딩 중...</span>
                </div>
              ) : filteredPosts.length === 0 ? (
                <div className="p-8 text-center text-white/40 text-xs">
                  해당 카테고리의 리포트가 없습니다.
                </div>
              ) : (
                filteredPosts.map((post) => {
                  const isSelected = selectedPost?.id === post.id;
                  const dateStr = post.created_at ? new Date(post.created_at).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
                  return (
                    <button
                      key={post.id}
                      onClick={() => setSelectedPost(post)}
                      className={`w-full text-left p-3 rounded-xl transition-all mb-1 ${
                        isSelected
                          ? 'bg-white/10 border border-white/20 shadow-lg'
                          : 'hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        {getCategoryBadge(post.category)}
                        <span className="text-[10px] text-white/40 font-mono">{dateStr}</span>
                      </div>
                      <h4 className="text-xs font-bold text-white leading-snug line-clamp-2 mb-1">
                        {post.title}
                      </h4>
                      {post.target_stock && (
                        <div className="text-[10px] font-mono text-[#00ffab]/90">
                          종목: {post.target_stock}
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: Article Detail Main View */}
          <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-[#0a0f1a]">
            {selectedPost ? (
              <div className="max-w-4xl mx-auto space-y-6">
                
                {/* Meta Header */}
                <div className="space-y-3 border-b border-white/10 pb-6">
                  <div className="flex flex-wrap items-center gap-2">
                    {getCategoryBadge(selectedPost.category)}
                    {selectedPost.target_stock && (
                      <span className="text-[11px] font-bold text-white/90 bg-white/5 border border-white/10 px-2.5 py-1 rounded-md font-mono">
                        🎯 {selectedPost.target_stock}
                      </span>
                    )}
                    <span className="text-xs text-white/40 font-mono flex items-center gap-1 ml-auto">
                      <Calendar size={13} /> {new Date(selectedPost.created_at).toLocaleString('ko-KR')}
                    </span>
                  </div>

                  <h1 className="text-xl md:text-3xl font-black text-white leading-tight tracking-tight">
                    {selectedPost.title}
                  </h1>

                  {selectedPost.summary && (
                    <div className="p-4 rounded-xl bg-gradient-to-r from-blue-950/40 to-purple-950/20 border border-blue-500/20 text-xs md:text-sm text-blue-200/90 leading-relaxed">
                      <div className="font-bold text-blue-400 mb-1 flex items-center gap-1.5">
                        <CheckCircle2 size={15} /> AI 3줄 핵심 요약
                      </div>
                      {selectedPost.summary}
                    </div>
                  )}
                </div>

                {/* 1600x1600 High-Res Dashboard Screenshot Viewer */}
                {selectedPost.image_url && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-white/60">
                      <span className="font-bold flex items-center gap-1.5 text-[#00ffab]">
                        <BarChart2 size={14} /> 실시간 계량 전광판 1600×1600 파노라마 스냅샷
                      </span>
                      <button
                        onClick={() => setIsZoomed(!isZoomed)}
                        className="text-[11px] text-white/40 hover:text-white underline"
                      >
                        {isZoomed ? '기본 크기로 축소' : '클릭하여 원본 확대'}
                      </button>
                    </div>
                    <div 
                      onClick={() => setIsZoomed(!isZoomed)}
                      className={`relative rounded-2xl overflow-hidden border border-white/15 bg-black/40 cursor-zoom-in transition-all ${
                        isZoomed ? 'max-h-none shadow-2xl ring-2 ring-[#00ffab]/50' : 'max-h-[480px]'
                      }`}
                    >
                      <img
                        src={selectedPost.image_url}
                        alt="실시간 퀀트 전광판 캡처"
                        className="w-full object-cover object-top"
                      />
                      {!isZoomed && (
                        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 to-transparent flex items-end justify-center pb-3">
                          <span className="text-xs font-bold text-white/80 bg-black/60 px-3 py-1.5 rounded-full border border-white/20 backdrop-blur-sm">
                            🔍 클릭하여 전체 전광판 크게 보기
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Key Quant Metrics Cards */}
                {Object.keys(quant).length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {quant.strength && (
                      <div className="glass-card p-3 rounded-xl border-white/10 bg-white/[0.03]">
                        <div className="text-[10px] font-bold text-white/40 uppercase">체결강도 / 가속도</div>
                        <div className="text-lg font-black text-[#00ffab] font-mono mt-1">
                          {quant.strength}
                        </div>
                        {quant.accel && <div className="text-[10px] text-white/60">{quant.accel}</div>}
                      </div>
                    )}
                    {quant.block_order && (
                      <div className="glass-card p-3 rounded-xl border-white/10 bg-white/[0.03]">
                        <div className="text-[10px] font-bold text-white/40 uppercase">블록오더(대량체결)</div>
                        <div className="text-lg font-black text-blue-400 font-mono mt-1">
                          {quant.block_order}
                        </div>
                        {quant.foreign_net && <div className="text-[10px] text-white/60">외인 {quant.foreign_net}</div>}
                      </div>
                    )}
                    {quant.target_price && (
                      <div className="glass-card p-3 rounded-xl border-white/10 bg-white/[0.03]">
                        <div className="text-[10px] font-bold text-white/40 uppercase">ATR 목표선</div>
                        <div className="text-lg font-black text-amber-400 font-mono mt-1">
                          {quant.target_price}
                        </div>
                        <div className="text-[10px] text-white/60">기술적 저항대</div>
                      </div>
                    )}
                    {quant.stop_loss && (
                      <div className="glass-card p-3 rounded-xl border-white/10 bg-white/[0.03]">
                        <div className="text-[10px] font-bold text-white/40 uppercase">시스템 손절선</div>
                        <div className="text-lg font-black text-red-400 font-mono mt-1">
                          {quant.stop_loss}
                        </div>
                        <div className="text-[10px] text-white/60">리스크 방어선</div>
                      </div>
                    )}
                  </div>
                )}

                {/* Article Main Content */}
                <div className="prose prose-invert max-w-none text-white/80 text-sm md:text-base leading-relaxed py-4 border-t border-white/10 space-y-4">
                  {selectedPost.content_html ? (
                    <div dangerouslySetInnerHTML={{ __html: selectedPost.content_html }} />
                  ) : (
                    <pre className="whitespace-pre-wrap font-sans">{selectedPost.content_markdown}</pre>
                  )}
                </div>

                {/* Tags */}
                {selectedPost.tags && selectedPost.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {selectedPost.tags.map((tag, idx) => (
                      <span key={idx} className="text-[11px] font-medium text-white/50 bg-white/5 px-2.5 py-1 rounded-lg">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* 🛡️ Legal Disclaimer Box (금융당국 100% 면책 조항) */}
                <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 text-xs text-white/50 space-y-2 mt-8">
                  <div className="flex items-center gap-2 font-bold text-amber-400 text-xs uppercase tracking-wider">
                    <ShieldAlert size={16} /> 투자 유의사항 및 법적 면책 고지 (Disclaimer)
                  </div>
                  <p className="leading-relaxed">
                    본 리서치 보고서 및 계량 데이터는 StockMaster AI의 알고리즘에 기반한 학술적·통계적 참고 자료이며, 자본시장법상 특정 금융투자상품의 매수·매도를 추천하거나 수익을 보장하지 않습니다. 
                  </p>
                  <p className="leading-relaxed">
                    본 서비스는 불특정 다수를 대상으로 대가 없이 순수 무료로 제공되는 단방향 계량 분석 리포트이며, 개별적인 1:1 투자 자문 및 상담을 일체 수행하지 않습니다. 모든 투자의 최종 결정과 그에 따른 책임은 투자자 본인에게 귀속됩니다.
                  </p>
                </div>

              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-white/40 text-sm">
                리서치 칼럼을 선택해주세요.
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};

export default QuantResearchModal;
