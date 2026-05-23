import React from 'react';
import { TrendingUp } from 'lucide-react';

const Header = ({ user, onOpenLogin, onLogout, showInstallBtn, onInstallClick }) => {
  return (
    <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-500/20 border border-white/10 group hover:scale-105 transition-transform">
          <TrendingUp className="text-white group-hover:rotate-12 transition-transform" size={28} />
        </div>
        <div>
          <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic bg-clip-text text-transparent bg-gradient-to-r from-white to-white/40">Antigravity Terminal</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] font-black text-[#00ffab] bg-[#00ffab]/10 px-2 py-0.5 rounded uppercase tracking-widest">System Online</span>
            <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Multi-Agent Quant v4.0</span>
          </div>
        </div>
      </div>
      <div className="flex gap-4 items-center">
        {showInstallBtn && (
          <button
            onClick={onInstallClick}
            className="text-[10px] font-black text-[#00ffcc] hover:text-[#00ffcc]/80 hover:bg-[#00ffcc]/10 uppercase tracking-widest border border-[#00ffcc]/30 bg-[#00ffcc]/5 px-4 py-2.5 rounded-xl transition-all shadow-[0_0_15px_rgba(0,255,204,0.1)] flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            앱 설치
          </button>
        )}
        
        {user ? (
          <div className="flex flex-col items-end gap-1">
            <div className="glass-card px-4 py-2 border-white/10 bg-white/5 flex flex-col items-end">
              <span className="text-[9px] font-black text-blue-400 uppercase tracking-wider">Active Agent Session</span>
              <span className="text-xs font-mono font-bold text-white/80">{user.email}</span>
            </div>
            <button 
              onClick={onLogout} 
              className="text-[9px] font-black text-red-400 hover:text-red-300 hover:bg-red-500/10 uppercase tracking-widest border border-red-500/20 bg-red-500/5 px-3 py-1 rounded-lg transition-all"
            >
              로그아웃
            </button>
          </div>
        ) : (
          <button 
            onClick={onOpenLogin} 
            className="text-[10px] font-black text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 uppercase tracking-widest border border-blue-500/30 bg-blue-500/5 px-5 py-2.5 rounded-xl transition-all shadow-[0_0_15px_rgba(59,130,246,0.1)]"
          >
            로그인 / 회원가입
          </button>
        )}
      </div>
    </header>
  );
};

export default Header;
