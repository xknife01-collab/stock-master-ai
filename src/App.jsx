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
import StockPopup from './components/StockPopup';
import AuthModal from './components/Auth/AuthModal';

const App = () => {
  // Authentication & Session
  const [user, setUser] = useState(() => {
    const email = localStorage.getItem('stock_user_email');
    const phone = localStorage.getItem('stock_user_phone');
    return email ? { email, phone } : null;
  });
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  // Global States
  const [stocks, setStocks] = useState([]);
  const [alerts, setAlerts] = useState([
    { id: 1, message: 'KRW/USD 변동성 확대 감지', severity: 'info' }
  ]);
  const [dashboardData, setDashboardData] = useState(null);
  const [news, setNews] = useState([]);
  const [aiSignal, setAiSignal] = useState(null);
  const [aiHistory, setAiHistory] = useState([]);
  const [popupItem, setPopupItem] = useState(null);

  // PWA Installation States
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isIOSDevice, setIsIOSDevice] = useState(false);

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOSDevice(ios);

    if (isStandalone) {
      setShowInstallBanner(false);
      return;
    }

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // If iOS and not standalone, show a guide banner
    if (ios && !isStandalone) {
      setShowInstallBanner(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User install choice: ${outcome}`);
    setDeferredPrompt(null);
    setShowInstallBanner(false);
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
        />

        {/* 2. Market Overview (Dashboard) */}
        <MarketDashboard />

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

        {/* 7. Floating UI */}
        <FloatingAlerts alerts={alerts} />
        <FooterTicker stocks={stocks} />

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
        </AnimatePresence>

        {showInstallBanner && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[999] w-[calc(100%-2rem)] max-w-md p-4 rounded-2xl glass-card border border-[#00ffcc]/30 bg-[#0d1625]/90 shadow-2xl flex items-center justify-between gap-4 animate-slide-up">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#00ffcc]/10 flex items-center justify-center border border-[#00ffcc]/20 text-[#00ffcc]">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </div>
              <div className="text-left">
                <h4 className="text-sm font-semibold text-white">Stock AI 홈화면 설치</h4>
                <p className="text-xs text-slate-400">
                  {isIOSDevice 
                    ? '하단 공유 아이콘 클릭 후 [홈 화면에 추가]를 눌러주세요.' 
                    : '바탕화면에 앱을 추가하여 간편하게 확인해보세요.'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!isIOSDevice && (
                <button 
                  onClick={handleInstallClick}
                  className="px-3 py-1.5 bg-[#00ffcc] hover:bg-[#00ffcc]/80 text-[#0a0f1a] font-bold text-xs rounded-lg transition-all shadow-md active:scale-95 whitespace-nowrap"
                >
                  설치
                </button>
              )}
              <button 
                onClick={() => setShowInstallBanner(false)}
                className="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

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
