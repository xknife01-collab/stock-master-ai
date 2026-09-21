import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, Calendar, Clock, TrendingUp, BarChart2, ShieldAlert, 
  Share2, Sparkles, Award, CheckCircle2, ChevronRight, Search, 
  ExternalLink, User, Layers, ArrowUpRight
} from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ufkxxiuuefbefmtcnvtl.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_A_1jVOIjpEKNVOO6ugEtrQ_ZayCYgZW';

const QuantResearchPage = ({ isOpen, onClose }) => {
  const [posts, setPosts] = useState([]);
  const [selectedPost, setSelectedPost] = useState(null);
  const [filter, setFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCopied, setIsCopied] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const fetchPosts = async () => {
      setIsLoading(true);
      try {
        const url = `${SUPABASE_URL}/rest/v1/quant_research_posts?select=*&is_published=eq.true&order=created_at.desc&limit=50`;
        const res = await fetch(url, {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setPosts(data);
          }
        }
      } catch (err) {
        console.error('Failed to fetch quant research posts:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPosts();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [isOpen]);

  if (!isOpen) return null;

  // 필터 및 검색
  const filteredPosts = posts.filter(p => {
    const matchesFilter = filter === 'ALL' || p.category === filter;
    const matchesSearch = !searchQuery || 
      p.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.summary?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.target_stock?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const getCategoryBadge = (cat) => {
    switch (cat) {
      case 'SEMICONDUCTOR':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/30 px-2.5 py-1 rounded-md">
            <Award size={12} /> 👑 반도체 주도주
          </span>
        );
      case 'RANK1':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#00ffab] bg-[#00ffab]/10 border border-[#00ffab]/30 px-2.5 py-1 rounded-md">
            <Sparkles size={12} /> 🥇 전광판 1위
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-400 bg-blue-400/10 border border-blue-400/30 px-2.5 py-1 rounded-md">
            <TrendingUp size={12} /> 📈 퀀트 리서치
          </span>
        );
    }
  };

  const quant = selectedPost?.quant_data || {};

  return (
    <div className="fixed inset-0 z-50 bg-[#0a0f1a] text-white overflow-y-auto animate-fadeIn selection:bg-[#00ffab]/30">
      
      {/* 1. Global Navigation Bar (상단 고정 헤더) */}
      <header className="sticky top-0 z-40 bg-[#0d1322]/90 backdrop-blur-xl border-b border-white/10 px-4 md:px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          
          {/* Back Button & Title */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                if (selectedPost) {
                  setSelectedPost(null);
                } else {
                  onClose();
                }
              }}
              className="flex items-center gap-2 text-xs md:text-sm font-bold text-white/80 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-3.5 py-2 rounded-xl transition-all shadow-sm"
            >
              <ArrowLeft size={16} />
              <span>{selectedPost ? '리서치 목록으로' : '터미널로 돌아가기'}</span>
            </button>

            <div className="hidden sm:flex items-center gap-2.5 pl-2 border-l border-white/10">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00ffab] to-blue-600 flex items-center justify-center text-black font-black">
                <BarChart2 size={16} />
              </div>
              <div>
                <h1 className="text-base font-black text-white tracking-tight uppercase">Quant Research Center</h1>
                <p className="text-[10px] text-white/40 font-mono">10-MIN QUANT ENGINE RESEARCH ARCHIVE</p>
              </div>
            </div>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 text-xs font-bold text-white/80 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-2 rounded-xl transition-all"
            >
              <Share2 size={14} />
              <span className="hidden md:inline">{isCopied ? '링크 복사됨!' : '공유'}</span>
            </button>

            <button
              onClick={onClose}
              className="text-xs font-black text-[#00ffab] hover:text-black hover:bg-[#00ffab] border border-[#00ffab]/40 bg-[#00ffab]/10 px-4 py-2 rounded-xl transition-all shadow-[0_0_15px_rgba(0,255,171,0.15)]"
            >
              터미널 닫기 ✕
            </button>
          </div>

        </div>
      </header>

      {/* 2. Main Body Container */}
      <main className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        
        {/* VIEW A: Article Detail View (카드 클릭 시 단독 게시글) */}
        {selectedPost ? (
          <article className="max-w-4xl mx-auto space-y-8 animate-slideUp">
            
            {/* Detail Top Navigation */}
            <div className="flex items-center justify-between text-xs text-white/50 pb-4 border-b border-white/10">
              <button
                onClick={() => setSelectedPost(null)}
                className="flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 font-bold"
              >
                <ArrowLeft size={14} /> 퀀트 리서치 전체 목록
              </button>
              <span className="font-mono flex items-center gap-1">
                <Clock size={13} /> 3 min read
              </span>
            </div>

            {/* Author & Date Header (블로그 원문 스타일) */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-blue-600 to-[#00ffab] p-0.5 shadow-lg shadow-blue-500/20">
                  <div className="w-full h-full rounded-full bg-[#0a0f1a] flex items-center justify-center text-[#00ffab]">
                    <User size={20} />
                  </div>
                </div>
                <div>
                  <div className="text-sm font-bold text-white flex items-center gap-2">
                    <span>StockMaster AI 퀀트 연구소</span>
                    <span className="text-[10px] font-mono text-[#00ffab] bg-[#00ffab]/10 px-2 py-0.5 rounded border border-[#00ffab]/20">Official Quant</span>
                  </div>
                  <div className="text-xs text-white/40 font-mono flex items-center gap-2 mt-0.5">
                    <span>{new Date(selectedPost.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}</span>
                    <span>·</span>
                    <span>{new Date(selectedPost.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 발행</span>
                  </div>
                </div>
              </div>

              {/* Title */}
              <h1 className="text-2xl md:text-4xl font-black text-white leading-tight tracking-tight pt-2">
                {selectedPost.title}
              </h1>

              {/* Category & Stock Tag */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {getCategoryBadge(selectedPost.category)}
                {selectedPost.target_stock && (
                  <span className="text-xs font-bold text-white/90 bg-white/5 border border-white/10 px-3 py-1 rounded-md font-mono">
                    🎯 {selectedPost.target_stock}
                  </span>
                )}
              </div>
            </div>

            {/* AI 3줄 핵심 요약 카드 */}
            {selectedPost.summary && (
              <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-950/40 via-purple-950/20 to-black/40 border border-blue-500/25 shadow-xl">
                <div className="font-bold text-sm text-[#00ffab] mb-2 flex items-center gap-2">
                  <CheckCircle2 size={16} /> AI 3줄 핵심 퀀트 브리핑
                </div>
                <p className="text-sm md:text-base text-blue-100/90 leading-relaxed font-sans">
                  {selectedPost.summary}
                </p>
              </div>
            )}

            {/* 1600x1600 High-Res Dashboard Screenshot Viewer */}
            {selectedPost.image_url && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between text-xs text-white/60">
                  <span className="font-bold flex items-center gap-1.5 text-[#00ffab]">
                    <BarChart2 size={15} /> 10분 계량 전광판 실시간 1600×1600 고화질 스냅샷
                  </span>
                  <button
                    onClick={() => setIsZoomed(!isZoomed)}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 font-bold underline"
                  >
                    {isZoomed ? '기본 크기로 축소' : '원본 크기 전체 확대'}
                  </button>
                </div>
                <div 
                  onClick={() => setIsZoomed(!isZoomed)}
                  className={`relative rounded-2xl overflow-hidden border border-white/15 bg-black/50 cursor-pointer transition-all shadow-2xl ${
                    isZoomed ? 'max-h-none ring-2 ring-[#00ffab]/50' : 'max-h-[580px]'
                  }`}
                >
                  <img
                    src={selectedPost.image_url}
                    alt="실시간 퀀트 대시보드 캡처"
                    className="w-full object-cover object-top"
                  />
                  {!isZoomed && (
                    <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex items-end justify-center pb-4">
                      <span className="text-xs font-bold text-white/90 bg-black/70 px-4 py-2 rounded-full border border-white/20 backdrop-blur-md shadow-lg flex items-center gap-1.5">
                        🔍 클릭하여 1600×1600 파노라마 전광판 전체 보기
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 4단 퀀트 지표 카드 (체결강도, 블록오더, ATR목표선, 손절선) */}
            {Object.keys(quant).length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                {quant.strength && (
                  <div className="p-4 rounded-2xl border border-white/10 bg-white/[0.03]">
                    <div className="text-[10px] font-bold text-white/40 uppercase tracking-wider">체결강도 / 가속도</div>
                    <div className="text-xl font-black text-[#00ffab] font-mono mt-1">
                      {quant.strength}
                    </div>
                    {quant.accel && <div className="text-[11px] text-white/60 mt-0.5">{quant.accel}</div>}
                  </div>
                )}
                {quant.block_order && (
                  <div className="p-4 rounded-2xl border border-white/10 bg-white/[0.03]">
                    <div className="text-[10px] font-bold text-white/40 uppercase tracking-wider">블록오더(대량체결)</div>
                    <div className="text-xl font-black text-blue-400 font-mono mt-1">
                      {quant.block_order}
                    </div>
                    {quant.foreign_net && <div className="text-[11px] text-white/60 mt-0.5">외인 {quant.foreign_net}</div>}
                  </div>
                )}
                {quant.target_price && (
                  <div className="p-4 rounded-2xl border border-white/10 bg-white/[0.03]">
                    <div className="text-[10px] font-bold text-white/40 uppercase tracking-wider">ATR 목표선</div>
                    <div className="text-xl font-black text-amber-400 font-mono mt-1">
                      {quant.target_price}
                    </div>
                    <div className="text-[11px] text-white/60 mt-0.5">기술적 저항선</div>
                  </div>
                )}
                {quant.stop_loss && (
                  <div className="p-4 rounded-2xl border border-white/10 bg-white/[0.03]">
                    <div className="text-[10px] font-bold text-white/40 uppercase tracking-wider">시스템 손절선</div>
                    <div className="text-xl font-black text-red-400 font-mono mt-1">
                      {quant.stop_loss}
                    </div>
                    <div className="text-[11px] text-white/60 mt-0.5">리스크 방어선</div>
                  </div>
                )}
              </div>
            )}

            {/* 전문 칼럼 본문 */}
            <div className="py-6 border-t border-white/10">
              {selectedPost.content_html ? (
                <div 
                  className="prose prose-invert max-w-none text-white/85 text-base md:text-lg leading-relaxed space-y-5"
                  dangerouslySetInnerHTML={{ __html: selectedPost.content_html }} 
                />
              ) : (
                <pre className="whitespace-pre-wrap font-sans text-white/85 text-base leading-relaxed">
                  {selectedPost.content_markdown}
                </pre>
              )}
            </div>

            {/* Tags */}
            {selectedPost.tags && selectedPost.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-4 border-t border-white/10">
                {selectedPost.tags.map((tag, idx) => (
                  <span key={idx} className="text-xs font-medium text-white/60 bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg">
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* 🛡️ 법적 면책 조항 (Disclaimer Card) */}
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 text-xs text-white/50 space-y-2.5 mt-10">
              <div className="flex items-center gap-2 font-bold text-amber-400 text-xs uppercase tracking-wider">
                <ShieldAlert size={16} /> 투자 유의사항 및 법적 면책 고지 (Disclaimer)
              </div>
              <p className="leading-relaxed">
                본 리서치 보고서 및 계량 분석 데이터는 StockMaster AI의 알고리즘에 기반한 학술적·통계적 참고 자료이며, 자본시장법상 특정 금융투자상품의 매수·매도를 추천하거나 수익을 보장하지 않습니다. 
              </p>
              <p className="leading-relaxed">
                본 서비스는 불특정 다수를 대상으로 대가 없이 순수 무료로 제공되는 단방향 계량 분석 리포트이며, 개별적인 1:1 투자 자문 및 상담을 일체 수행하지 않습니다. 모든 투자의 최종 결정과 그에 따른 책임은 투자자 본인에게 귀속됩니다.
              </p>
            </div>

            {/* Bottom Back Button */}
            <div className="pt-8 text-center">
              <button
                onClick={() => setSelectedPost(null)}
                className="inline-flex items-center gap-2 text-sm font-bold text-white bg-white/10 hover:bg-white/20 border border-white/20 px-6 py-3 rounded-xl transition-all"
              >
                <ArrowLeft size={16} /> 전체 리서치 목록으로 돌아가기
              </button>
            </div>

          </article>
        ) : (
          /* VIEW B: 3열 카드 그리드 아카이브 뷰 (2번째 사진 스타일 완벽 반영) */
          <div className="space-y-8 animate-fadeIn">
            
            {/* Header Title & Intro Banner */}
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 text-xs font-bold text-[#00ffab] bg-[#00ffab]/10 border border-[#00ffab]/30 px-3 py-1 rounded-full uppercase tracking-wider">
                <Sparkles size={13} /> StockMaster AI Daily Quant Research
              </div>
              <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight">
                계량 전광판 데일리 퀀트 리서치
              </h2>
              <p className="text-sm md:text-base text-white/60 max-w-3xl leading-relaxed">
                국내 시장 350개 종목을 10분마다 스캔하는 AI 계량 전광판 데이터를 기반으로, 체결강도·블록오더·세력 수급을 심층 분석한 전문 퀀트 칼럼을 투명하게 공개합니다.
              </p>
            </div>

            {/* Filter Tabs & Search Bar */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 py-4 border-y border-white/10">
              
              {/* Category Filter Tabs */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
                <button
                  onClick={() => setFilter('ALL')}
                  className={`text-xs md:text-sm font-bold px-4 py-2 rounded-xl transition-all whitespace-nowrap ${
                    filter === 'ALL'
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-black'
                      : 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
                >
                  전체 리서치 ({posts.length})
                </button>
                <button
                  onClick={() => setFilter('RANK1')}
                  className={`text-xs md:text-sm font-bold px-4 py-2 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
                    filter === 'RANK1'
                      ? 'bg-[#00ffab]/20 text-[#00ffab] border border-[#00ffab]/40 font-black'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  🥇 1위 주도주 (12:30)
                </button>
                <button
                  onClick={() => setFilter('SEMICONDUCTOR')}
                  className={`text-xs md:text-sm font-bold px-4 py-2 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
                    filter === 'SEMICONDUCTOR'
                      ? 'bg-amber-400/20 text-amber-400 border border-amber-400/40 font-black'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  👑 반도체 주도주 (08:30)
                </button>
              </div>

              {/* Search Box */}
              <div className="relative w-full md:w-72">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" size={15} />
                <input
                  type="text"
                  placeholder="종목명 또는 키워드 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs md:text-sm text-white placeholder-white/40 focus:outline-none focus:border-[#00ffab]/50 transition-all"
                />
              </div>

            </div>

            {/* 3-Column Card Grid (2번째 사진 레퍼런스 스타일) */}
            {isLoading ? (
              <div className="py-24 text-center text-white/40 flex flex-col items-center justify-center gap-3">
                <div className="w-8 h-8 border-2 border-[#00ffab] border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">최신 퀀트 리서치 데이터를 불러오는 중입니다...</span>
              </div>
            ) : filteredPosts.length === 0 ? (
              <div className="py-24 text-center text-white/40 border border-dashed border-white/10 rounded-2xl">
                <BarChart2 size={32} className="mx-auto mb-3 text-white/20" />
                <p className="text-base font-bold">등록된 리서치 칼럼이 없습니다.</p>
                <p className="text-xs text-white/30 mt-1">마케팅봇이 다음 정기 발행 시각(08:30 / 12:30)에 자동으로 새 칼럼을 등록합니다.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredPosts.map((post) => {
                  const dateStr = post.created_at 
                    ? new Date(post.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\./g, '-').replace(/\s/g, '').slice(0, 10)
                    : '';
                  const q = post.quant_data || {};

                  return (
                    <div
                      key={post.id}
                      id={`research-post-${post.id}`}
                      onClick={() => {
                        setSelectedPost(post);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="research-post-card group cursor-pointer rounded-2xl overflow-hidden border border-white/10 bg-[#0d1625] hover:bg-[#111c30] transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-blue-500/10 hover:border-white/25 flex flex-col text-left"
                    >
                      {/* 1. Thumbnail Image Area */}
                      <div className="relative h-48 sm:h-52 bg-black/40 overflow-hidden">
                        {post.image_url ? (
                          <img
                            src={post.image_url}
                            alt={post.title}
                            className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-950/40 to-slate-900 text-white/20">
                            <BarChart2 size={48} />
                          </div>
                        )}
                        <div className="absolute top-3 left-3">
                          {getCategoryBadge(post.category)}
                        </div>
                        {post.target_stock && (
                          <div className="absolute bottom-3 right-3 text-[10px] font-bold font-mono text-white bg-black/70 px-2.5 py-1 rounded-md border border-white/20 backdrop-blur-sm">
                            {post.target_stock}
                          </div>
                        )}
                      </div>

                      {/* 2. Card Content Area (2번째 사진 레이아웃) */}
                      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                        
                        <div>
                          {/* Author & Date Header */}
                          <div className="flex items-center gap-2.5 text-xs text-white/50 mb-3">
                            <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-white/70">
                              <User size={13} />
                            </div>
                            <span className="font-bold text-white/70">StockMaster AI</span>
                            <span>·</span>
                            <span className="font-mono">{dateStr}</span>
                            <span>·</span>
                            <span className="font-mono">3 min read</span>
                          </div>

                          {/* Card Title (Bold 2-Line) */}
                          <h3 className="text-base sm:text-lg font-black text-white group-hover:text-[#00ffab] transition-colors leading-snug line-clamp-2 mb-2">
                            {post.title}
                          </h3>

                          {/* Summary Snippet */}
                          {post.summary && (
                            <p className="text-xs sm:text-sm text-white/60 line-clamp-2 leading-relaxed font-sans">
                              {post.summary}
                            </p>
                          )}
                        </div>

                        {/* Card Footer: Key Metric Preview */}
                        <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                          {q.strength ? (
                            <span className="text-[11px] font-mono text-[#00ffab] font-bold">
                              체결강도 {q.strength}
                            </span>
                          ) : (
                            <span className="text-[11px] text-white/40">계량 퀀트 분석</span>
                          )}
                          <span className="text-[11px] font-bold text-cyan-400 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                            자세히 읽기 <ChevronRight size={13} />
                          </span>
                        </div>

                      </div>

                    </div>
                  );
                })}
              </div>
            )}

          </div>
        )}

      </main>

    </div>
  );
};

export default QuantResearchPage;
