import React, { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { INITIAL_STOCKS } from './data/stocks';

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

const App = () => {
  // Global States
  const [stocks, setStocks] = useState(INITIAL_STOCKS);
  const [alerts, setAlerts] = useState([
    { id: 1, message: 'KRW/USD 변동성 확대 감지', severity: 'info' }
  ]);
  const [dashboardData, setDashboardData] = useState(null);
  const [news, setNews] = useState([]);
  const [aiSignal, setAiSignal] = useState(null);
  const [aiHistory, setAiHistory] = useState([]);
  const [popupItem, setPopupItem] = useState(null);

  // Global Data Fetching (Synced)
  useEffect(() => {
    const fetchData = () => {
      fetch('http://localhost:5000/api/dashboard')
        .then(res => res.json())
        .then(data => setDashboardData(data))
        .catch(e => console.error('Dashboard load fail', e));
        
      fetch('http://localhost:5000/api/ai/history')
        .then(res => res.json())
        .then(data => setAiHistory(Array.isArray(data) ? data : []))
        .catch(e => console.error('AI history load fail', e));

      fetch('http://localhost:5000/api/news')
        .then(res => res.json())
        .then(data => setNews(Array.isArray(data) ? data : []))
        .catch(e => console.error('News load fail', e));

      // AI Pulse (Hourly Analysis or Cache)
      fetch('http://localhost:5000/api/ai/pulse')
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

  const handleOpenPopup = (name, price, change, symbol = null) => {
    setPopupItem({ name, price, change, symbol });
  };

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-white font-sans selection:bg-blue-500/30">
      {/* 0. Macro Indicators (Sticky Top) */}
      <MacroTicker />
      
      <div className="p-4 md:p-8 pb-32">
        {/* 1. Header */}
        <Header />

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
          <PortfolioSection portfolio={stocks} />
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
      </AnimatePresence>

      <style jsx global>{`
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
      `}</style>
      </div>
    </div>
  );
};

export default App;
