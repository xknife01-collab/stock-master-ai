import React, { useState, useEffect } from 'react';
import { PlayCircle, CheckCircle, ShieldCheck, X, Film, Sparkles } from 'lucide-react';
import { API_URL } from '../../config.js';

const AdVideoModal = ({ isOpen, onClose, onUnlockSuccess }) => {
  const [countdown, setCountdown] = useState(15);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setCountdown(15);
      setIsCompleted(false);
      return;
    }

    setCountdown(15);
    setIsCompleted(false);

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsCompleted(true);
          handleAdViewSuccess();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen]);

  const handleAdViewSuccess = async () => {
    try {
      const userEmail = localStorage.getItem('stock_user_email') || '손님 (Guest/비회원)';
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      await fetch(`${API_URL}/api/admin/track-ad-view`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail,
          unlockedItems: 'AI 1위, 2위 TOP PICK 종목 (30분 해금)',
          adDuration: '15초 완수',
          device: isMobile ? 'Mobile PWA' : 'Desktop PC'
        })
      });
    } catch (err) {
      console.warn('Track ad view failed', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
      <div className="w-full max-w-xl bg-[#121722] border border-purple-500/30 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(168,85,247,0.2)] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-white/[0.02]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center">
              <Film className="text-purple-400" size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                15초 보상형 동영상 광고
                <span className="px-2 py-0.5 text-[9px] bg-purple-500/20 border border-purple-400/40 text-purple-300 rounded font-mono font-bold">
                  REWARDED AD
                </span>
              </h3>
              <p className="text-[10px] text-white/40">완수 시 AI 1위, 2위 TOP PICK 종목이 30분간 즉시 해금됩니다.</p>
            </div>
          </div>

          {isCompleted && (
            <button
              onClick={() => {
                onUnlockSuccess();
                onClose();
              }}
              className="p-2 text-white/50 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Video Simulation Display Body */}
        <div className="p-8 flex flex-col items-center justify-center text-center relative bg-gradient-to-b from-purple-950/20 via-[#121722] to-[#0a0d14]">
          {!isCompleted ? (
            <div className="w-full space-y-6 flex flex-col items-center">
              {/* Simulated Video Frame */}
              <div className="w-full aspect-video bg-gradient-to-br from-purple-900/40 via-indigo-900/30 to-black rounded-2xl border border-purple-500/30 flex flex-col items-center justify-center relative overflow-hidden shadow-2xl group">
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40" />
                
                {/* Playing Animation */}
                <div className="relative z-10 flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-full bg-purple-600/30 border-2 border-purple-400 flex items-center justify-center animate-pulse">
                    <PlayCircle className="text-purple-300" size={40} />
                  </div>
                  <div className="text-sm font-black text-white tracking-tight flex items-center gap-1.5">
                    <Sparkles className="text-amber-400" size={16} />
                    Stock Master AI Premium Sponsor Video
                  </div>
                  <div className="text-xs text-purple-300 font-medium">
                    15초 시청 후 AI 최신 수급 TOP 1, 2위 종목 공개
                  </div>
                </div>

                {/* Top Countdown Overlay */}
                <div className="absolute top-4 right-4 z-20 px-3 py-1 bg-black/70 border border-white/20 rounded-full text-xs font-mono font-bold text-white flex items-center gap-2 backdrop-blur-md">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                  남은 시간: <span className="text-purple-400 font-extrabold text-sm">{countdown}</span>초
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full space-y-2">
                <div className="flex justify-between text-xs text-white/50 font-bold">
                  <span>광고 시청 진행 중...</span>
                  <span className="font-mono text-purple-400">{Math.round(((15 - countdown) / 15) * 100)}%</span>
                </div>
                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 via-indigo-500 to-pink-500 transition-all duration-1000"
                    style={{ width: `${((15 - countdown) / 15) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 space-y-6 flex flex-col items-center animate-fadeIn">
              <div className="w-20 h-20 rounded-3xl bg-green-500/20 border border-green-400/40 flex items-center justify-center shadow-2xl shadow-green-500/20">
                <CheckCircle className="text-green-400" size={48} />
              </div>

              <div className="space-y-2">
                <h4 className="text-2xl font-black text-white">15초 시청 완수!</h4>
                <p className="text-sm text-green-300 font-bold">
                  🎉 TOP 1위, 2위 AI 핵심 종목이 30분간 성공적으로 해금되었습니다.
                </p>
              </div>

              <button
                onClick={() => {
                  onUnlockSuccess();
                  onClose();
                }}
                className="w-full max-w-sm py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-black rounded-2xl transition-all shadow-xl shadow-green-900/40 text-base"
              >
                해금된 AI 리포트 확인하기
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdVideoModal;
