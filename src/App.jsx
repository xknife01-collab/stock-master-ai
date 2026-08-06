import React, { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { API_URL } from './config.js';

// Layout Components
import Header from './components/Layout/Header';
import FooterTicker from './components/Layout/FooterTicker';
import FloatingAlerts from './components/Layout/FloatingAlerts';
import MacroTicker from './components/Layout/MacroTicker';

// Main Sections
import MarketDashboard from './components/Dashboard/MarketDashboard';
import MarketRankings from './components/Dashboard/MarketRankings';
import GainerSection from './components/Dashboard/GainerSection';
import ConditionSearch from './components/ConditionSearch';
import AISignalSection from './components/AI/AISignalSection';
import PortfolioSection from './components/Portfolio/PortfolioSection';
import TradingJournal from './components/Portfolio/TradingJournal';
import StockPopup from './components/StockPopup';
import AuthModal from './components/Auth/AuthModal';
import AdminModal from './components/Admin/AdminModal';
import StickyStripBanner from './components/Ad/StickyStripBanner';
import AdVideoModal from './components/Ad/AdVideoModal';

const App = () => {
  // Authentication & Session
  const [user, setUser] = useState(() => {
    const email = localStorage.getItem('stock_user_email');
    const phone = localStorage.getItem('stock_user_phone');
    return email ? { email, phone } : null;
  });
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);

  // Global States
  const [stocks, setStocks] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [dashboardData, setDashboardData] = useState(null);
  const [news, setNews] = useState([]);
  const [aiSignal, setAiSignal] = useState(null);
  const [aiHistory, setAiHistory] = useState([]);
  const [popupItem, setPopupItem] = useState(null);

  // PWA Installation States
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);
  const [isIOSDevice, setIsIOSDevice] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  // Global Session Video Ad Pop-up States
  const [isAdModalOpen, setIsAdModalOpen] = useState(false);
  const [adConfig, setAdConfig] = useState({ showAds: true, previewDurationMinutes: 10, resetIntervalMinutes: 30 });

  // /admin URL 경로 감지 리스너
  useEffect(() => {
    const checkAdminRoute = () => {
      const path = window.location.pathname.toLowerCase();
      if (path === '/admin' || path === '/admin/' || window.location.hash === '#admin') {
        setIsAdminOpen(true);
      }
    };
    checkAdminRoute();
    window.addEventListener('popstate', checkAdminRoute);
    return () => window.removeEventListener('popstate', checkAdminRoute);
  }, []);

  // 글로벌 10분 사용 ➔ 15초 동영상 광고 팝업 ➔ 30분 해금 타이머
  useEffect(() => {
    let sessionStart = sessionStorage.getItem('stock_session_start_time');
    if (!sessionStart) {
      sessionStart = String(Date.now());
      sessionStorage.setItem('stock_session_start_time', sessionStart);
    }

    const checkSessionAdTimer = () => {
      fetch(`${API_URL}/api/admin/config`)
        .then(res => res.json())
        .then(data => {
          if (data.config) {
            const cfg = data.config;
            setAdConfig(cfg);

            const isAdEnabled = cfg.showAds === true || cfg.showAds === 'true';
            if (!isAdEnabled) {
              setIsAdModalOpen(false);
              return;
            }

            const elapsedMins = (Date.now() - parseInt(sessionStart)) / (1000 * 60);
            const previewLimit = parseInt(cfg.previewDurationMinutes) || 10;
            const unlockedUntil = parseInt(localStorage.getItem('stock_ad_unlocked_until') || '0');

            if (elapsedMins >= previewLimit && Date.now() > unlockedUntil) {
              setIsAdModalOpen(true);
            }
          }
        })
        .catch(() => {});
    };

    checkSessionAdTimer();
    const timer = setInterval(checkSessionAdTimer, 10000);
    return () => clearInterval(timer);
  }, []);

  const handleUnlockSessionSuccess = () => {
    const resetMins = parseInt(adConfig.resetIntervalMinutes) || 30;
    const unlockUntil = Date.now() + resetMins * 60 * 1000;
    localStorage.setItem('stock_ad_unlocked_until', String(unlockUntil));
    setIsAdModalOpen(false);
  };

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOSDevice(ios);

    // Track Page Visit & Referrer
    try {
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      fetch(`${API_URL}/api/admin/track-visit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referrer: document.referrer || 'direct',
          isMobile,
          isAdView: false
        })
      }).catch(e => console.warn('Traffic tracking skipped', e));
    } catch (err) {}

    if (isStandalone) {
      setShowInstallBtn(false);
      return;
    }

    // Always show install button if not running standalone
    setShowInstallBtn(true);

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOSDevice) {
      setShowIosGuide(true);
      return;
    }
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User install choice: ${outcome}`);
      setDeferredPrompt(null);
      setShowInstallBtn(false);
    } else {
      alert("이 브라우저에서는 공유 메뉴를 통해 홈 화면에 추가해주세요.");
    }
  };

  // 1. 포트폴리오 로드 함수
  const fetchPortfolio = async () => {
    if (!user) {
      setStocks([]);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/portfolio?userId=${user.email}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        // 각 종목별 실시간 현재가 병합 조회
        const withPrices = await Promise.all(data.map(async (stock) => {
          try {
            const priceRes = await fetch(`${API_URL}/api/stock/${stock.symbol}`);
            const priceData = await priceRes.json();
            return {
              ...stock,
              price: priceData && priceData.price ? priceData.price : 0
            };
          } catch (e) {
            console.error(`Price fetch error for ${stock.name}`, e);
            return { ...stock, price: 0 };
          }
        }));
        setStocks(withPrices);
      }
    } catch (err) {
      console.error('Fetch portfolio failed', err);
    }
  };

  // 2. 포트폴리오 변경 감지 (로그인 상태 변화 시 로드)
  useEffect(() => {
    fetchPortfolio();
  }, [user]);

  // Global Data Fetching (Synced)
  useEffect(() => {
    const fetchData = () => {
      fetch(`${API_URL}/api/dashboard`)
        .then(res => res.json())
        .then(data => setDashboardData(data))
        .catch(e => console.error('Dashboard load fail', e));
        
      fetch(`${API_URL}/api/ai/history`)
        .then(res => res.json())
        .then(data => setAiHistory(Array.isArray(data) ? data : []))
        .catch(e => console.error('AI history load fail', e));

      fetch(`${API_URL}/api/news`)
        .then(res => res.json())
        .then(data => setNews(Array.isArray(data) ? data : []))
        .catch(e => console.error('News load fail', e));

      // AI Pulse (Hourly Analysis or Cache)
      fetch(`${API_URL}/api/ai/pulse`)
        .then(res => res.json())
        .then(data => {
          if (data && (data.data || data.signal)) {
            setAiSignal(data);
          }
        })
        .catch(e => console.error('AI pulse load fail', e));
    };
    
    fetchData();
    const interval = setInterval(fetchData, 60000); // 1분마다 통합 동기화
    return () => clearInterval(interval);
  }, []);

  // Portfolio Real-time Price Update (Every 30 seconds)
  useEffect(() => {
    const updatePortfolioPrices = async () => {
      if (!user || stocks.length === 0) return;
      try {
        const updatedStocks = await Promise.all(stocks.map(async (stock) => {
          if (!stock.symbol) return stock;
          try {
            const res = await fetch(`${API_URL}/api/stock/${stock.symbol}`);
            const data = await res.json();
            if (data && data.price) {
              return { ...stock, price: data.price };
            }
          } catch (e) {
            console.error(`Failed to update ${stock.name}`, e);
          }
          return stock;
        }));
        setStocks(updatedStocks);
      } catch (err) {
        console.error('Portfolio sync fail', err);
      }
    };

    const portfolioInterval = setInterval(updatePortfolioPrices, 30000);
    return () => clearInterval(portfolioInterval);
  }, [stocks, user]);

  // Auth Handlers
  const handleLogout = () => {
    localStorage.removeItem('stock_user_email');
    localStorage.removeItem('stock_user_phone');
    localStorage.removeItem('stock_user_token');
    setUser(null);
  };

  // Portfolio CRUD Handlers
  const handleAddStock = async (stockData) => {
    if (!user) return;
    try {
      const res = await fetch(`${API_URL}/api/portfolio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.email,
          symbol: stockData.symbol,
          name: stockData.name,
          purchasePrice: stockData.purchasePrice,
          stopLossPrice: stockData.stopLossPrice
        })
      });
      if (res.ok) {
        fetchPortfolio();
      } else {
        const err = await res.json();
        alert(err.error || '종목 등록 실패');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteStock = async (id) => {
    try {
      const res = await fetch(`${API_URL}/api/portfolio/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchPortfolio();
      } else {
        alert('종목 삭제 실패');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateStopLoss = async (id, stopLossPrice) => {
    try {
      const res = await fetch(`${API_URL}/api/portfolio/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stopLossPrice })
      });
      if (res.ok) {
        fetchPortfolio();
      } else {
        alert('손절가 수정 실패');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenPopup = (name, price, change, symbol = null) => {
    setPopupItem({ name, price, change, symbol });
  };

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-white font-sans selection:bg-blue-500/30">
      {/* 0. Macro Indicators (Sticky Top) */}
      <MacroTicker />
      
      <div className="p-4 md:p-8 pb-32">
        {/* 1. Header */}
        <Header 
          user={user} 
          onOpenLogin={() => setIsAuthOpen(true)} 
          onLogout={handleLogout} 
          showInstallBtn={showInstallBtn}
          onInstallClick={handleInstallClick}
          onOpenAdmin={() => setIsAdminOpen(true)}
        />

        {/* 2. Market Overview (Dashboard) */}
        <MarketDashboard dashboardData={dashboardData} />

        {/* 3. AI Analysis Section */}
        <AISignalSection 
          aiSignal={aiSignal} 
          aiHistory={aiHistory} 
          onOpenPopup={handleOpenPopup} 
        />

        {/* 4. Condition Search (HTS) */}
        <ConditionSearch 
          onOpenPopup={handleOpenPopup} 
        />

        {/* 5. Market Rankings & News */}
        <MarketRankings 
          dashboardData={dashboardData} 
          news={news} 
          onOpenPopup={handleOpenPopup} 
        />

        {/* 6. Portfolio Monitoring & Real-time Gainers */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-20">
          <div className="lg:col-span-1">
            <GainerSection 
              dashboardData={dashboardData} 
              onOpenPopup={handleOpenPopup} 
            />
          </div>
          <div className="lg:col-span-3">
            <PortfolioSection 
              user={user}
              portfolio={stocks} 
              onOpenLogin={() => setIsAuthOpen(true)}
              onAddStock={handleAddStock}
              onDeleteStock={handleDeleteStock}
              onUpdateStopLoss={handleUpdateStopLoss}
            />
          </div>
        </div>

        {/* 7. AI 트레이딩 일지 (성과 공개 대시보드) */}
        <TradingJournal user={user} />

        {/* 8. Floating UI */}
        <FloatingAlerts alerts={alerts} />
        <FooterTicker stocks={stocks} />
        <StickyStripBanner showAds={adConfig.showAds} />

        {/* 8. Modals */}
        <AnimatePresence>
          {popupItem && (
            <StockPopup 
              item={popupItem} 
              onClose={() => setPopupItem(null)} 
            />
          )}
          {isAuthOpen && (
            <AuthModal 
              isOpen={isAuthOpen} 
              onClose={() => setIsAuthOpen(false)} 
              onSuccess={(userData) => setUser(userData)} 
            />
          )}
          {isAdminOpen && (
            <AdminModal
              isOpen={isAdminOpen}
              onClose={() => {
                setIsAdminOpen(false);
                if (window.location.pathname.toLowerCase() === '/admin' || window.location.pathname.toLowerCase() === '/admin/') {
                  window.history.pushState({}, '', '/');
                }
              }}
            />
          )}
          {showIosGuide && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
              {/* Backdrop */}
              <div 
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={() => setShowIosGuide(false)}
              />
              
              {/* Modal Content */}
              <div className="relative glass-card border border-[#00ffcc]/30 bg-[#0d1625]/95 p-6 max-w-sm w-full text-center shadow-2xl rounded-3xl animate-slide-up z-10">
                <div className="w-12 h-12 rounded-full bg-[#00ffcc]/10 flex items-center justify-center border border-[#00ffcc]/20 text-[#00ffcc] mx-auto mb-4">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                
                <h3 className="text-lg font-black text-white mb-2">iOS 홈 화면 추가 안내</h3>
                <p className="text-sm text-slate-300 leading-relaxed mb-6 text-left">
                  Safari 브라우저 하단의 <span className="text-[#00ffcc] font-bold">[공유 (Share)]</span> 아이콘을 누른 뒤, 스크롤을 내려 <span className="text-[#00ffcc] font-bold">[홈 화면에 추가]</span> 메뉴를 클릭해주세요.
                </p>
                
                <button
                  onClick={() => setShowIosGuide(false)}
                  className="w-full py-3 bg-[#00ffcc] hover:bg-[#00ffcc]/80 text-[#0a0f1a] font-bold text-sm rounded-xl transition-all shadow-md active:scale-95"
                >
                  확인 완료
                </button>
              </div>
            </div>
          )}
        </AnimatePresence>

        {/* 글로벌 15초 동영상 광고 세션 해금 모달 */}
        <AdVideoModal
          isOpen={isAdModalOpen}
          onClose={() => setIsAdModalOpen(false)}
          onUnlockSuccess={handleUnlockSessionSuccess}
        />

        <style dangerouslySetInnerHTML={{ __html: `
          .glass-card {
            background: rgba(255, 255, 255, 0.03);
            backdrop-filter: blur(20px);
            border-radius: 24px;
            border: 1px solid rgba(255, 255, 255, 0.05);
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          }
          .glass-card:hover {
            background: rgba(255, 255, 255, 0.05);
            border-color: rgba(255, 255, 255, 0.1);
            transform: translateY(-4px);
          }
          .custom-scrollbar::-webkit-scrollbar { width: 4px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
          .ticker-wrap { overflow: hidden; }
          .ticker-content { display: inline-flex; animation: ticker 60s linear infinite; }
          @keyframes ticker { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
          
          @keyframes slideUp {
            from { transform: translate(-50%, 20px); opacity: 0; }
            to { transform: translate(-50%, 0); opacity: 1; }
          }
          .animate-slide-up {
            animation: slideUp 0.3s ease-out forwards;
          }
        `}} />
      </div>
    </div>
  );
};

export default App;
