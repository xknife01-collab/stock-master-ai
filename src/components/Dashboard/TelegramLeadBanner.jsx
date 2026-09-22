import React from 'react';
import { Send, TrendingUp, Zap, CheckCircle2, ShieldCheck } from 'lucide-react';

const TelegramLeadBanner = () => {
  const TELEGRAM_URL = "https://t.me/stockmaster_vip";

  return (
    <div className="mt-6 relative overflow-hidden rounded-2xl border border-blue-500/30 bg-gradient-to-r from-blue-950/70 via-slate-900/90 to-indigo-950/70 p-6 shadow-2xl backdrop-blur-xl transition-all duration-300 hover:border-blue-400/50">
      {/* Background ambient glow */}
      <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-blue-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-10 -bottom-10 h-44 w-44 rounded-full bg-indigo-500/10 blur-3xl" />

      <div className="relative z-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
        {/* Left: Headline & Benefits */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-400 border border-emerald-500/30">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              LIVE VIP 채널 가동 중
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2.5 py-1 text-xs font-semibold text-blue-300 border border-blue-500/20">
              <Zap className="h-3 w-3 text-amber-400" />
              매일 08:30 장전 정시 발송
            </span>
          </div>

          <div>
            <h3 className="text-lg md:text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-400" />
              오늘 장전 외인/기관 긴급 매집 특징주 무료 알림
            </h3>
            <p className="mt-1 text-xs md:text-sm text-slate-300 leading-relaxed">
              장 시작 전 미국 증시 핵심 요약 · 실시간 외인 순매수 급등 조건검색식 시그널을 텔레그램에서 가장 먼저 쏴드립니다.
            </p>
          </div>

          {/* Key Benefit Chips */}
          <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-slate-400">
            <div className="flex items-center gap-1 text-slate-300">
              <CheckCircle2 className="h-3.5 w-3.5 text-blue-400" />
              <span>장전 08:30 3분 브리핑</span>
            </div>
            <div className="flex items-center gap-1 text-slate-300">
              <CheckCircle2 className="h-3.5 w-3.5 text-blue-400" />
              <span>외인/기관 대량 수급 포착</span>
            </div>
            <div className="flex items-center gap-1 text-slate-300">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              <span>100% 무료 입장 (스팸 0%)</span>
            </div>
          </div>
        </div>

        {/* Right: CTA Action Button */}
        <div className="flex-shrink-0">
          <a
            href={TELEGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative inline-flex items-center justify-center gap-2.5 overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 px-6 py-3.5 text-sm md:text-base font-bold text-white shadow-lg shadow-blue-500/25 transition-all duration-300 hover:scale-[1.02] hover:shadow-blue-500/40 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.98]"
          >
            <Send className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            <span>VIP 텔레그램 1초 무료 입장</span>
            <span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-bold text-white uppercase">
              Free
            </span>
          </a>
        </div>
      </div>
    </div>
  );
};

export default TelegramLeadBanner;
