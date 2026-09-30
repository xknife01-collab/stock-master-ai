import React from 'react';
import { ShieldAlert, AlertTriangle, Scale, HelpCircle } from 'lucide-react';

const FooterDisclaimer = () => {
  return (
    <footer className="w-full mt-16 border-t border-white/10 bg-[#070b12]/80 backdrop-blur-md pt-10 pb-16 px-4 md:px-8 text-xs text-slate-400">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Disclaimer Title */}
        <div className="flex items-center gap-2 text-slate-300 font-bold text-sm pb-2 border-b border-white/5">
          <ShieldAlert className="w-4 h-4 text-[#00ffcc]" />
          <span>금융소비자보호 및 투자 유의사항 (자본시장법 준수 법적 고지)</span>
        </div>

        {/* 4 Core Legal Notice Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 leading-relaxed text-slate-400 text-[11px]">
          <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl space-y-1.5 hover:border-white/10 transition-colors">
            <div className="flex items-center gap-2 text-slate-200 font-semibold">
              <Scale className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>1. 비권유 및 단순 정보 제공 고지</span>
            </div>
            <p className="text-slate-400">
              본 서비스(Stock Master AI)에서 제공하는 AI 알고리즘 분석, 테마 예측, 퀀트 점수, 목표가 및 손절가 지표는 계량적 수치에 기반한 단순 투자 참고용 정보이며, 특정 금융투자상품에 대한 <strong className="text-slate-300">매수·매도 추천이나 투자 권유, 수익 보증이 아닙니다.</strong>
            </p>
          </div>

          <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl space-y-1.5 hover:border-white/10 transition-colors">
            <div className="flex items-center gap-2 text-slate-200 font-semibold">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>2. 원금 손실 위험 및 투자 책임 귀속</span>
            </div>
            <p className="text-slate-400">
              주식 및 파생상품 투자는 시장 변동에 따른 원금 손실 위험이 수반되며, 최악의 경우 투자 원금의 전부 또는 일부 손실이 발생할 수 있습니다. 모든 투자 판단 및 이에 따른 손익의 결과는 <strong className="text-slate-300">전적으로 투자자 본인에게 귀속</strong>됩니다.
            </p>
          </div>

          <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl space-y-1.5 hover:border-white/10 transition-colors">
            <div className="flex items-center gap-2 text-slate-200 font-semibold">
              <HelpCircle className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span>3. 과거 성과 및 백테스트 비보장</span>
            </div>
            <p className="text-slate-400">
              서비스 내에 표시되는 과거 시세 데이터, 백테스팅 성과, AI 학습 지표 및 적중률 통계는 과거의 일정 시점 기준 분석 결과일 뿐이며, <strong className="text-slate-300">미래의 투자 수익이나 시세 상승을 보장하지 않습니다.</strong>
            </p>
          </div>

          <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl space-y-1.5 hover:border-white/10 transition-colors">
            <div className="flex items-center gap-2 text-slate-200 font-semibold">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>4. 1:1 개별 투자 상담 불가</span>
            </div>
            <p className="text-slate-400">
              본 서비스는 불특정 다수를 대상으로 발행되는 통계 소프트웨어 정보 제공 서비스입니다. 자본시장과 금융투자업에 관한 법률에 따라 <strong className="text-slate-300">개별 투자자와의 사적 상담이나 1:1 투자 자문 행위는 일절 행하지 않습니다.</strong>
            </p>
          </div>
        </div>

        {/* Footer Meta & Copyright */}
        <div className="pt-4 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-3 text-[11px] text-slate-400">
          <div>
            <p>© {new Date().getFullYear()} Stock Master AI. 10-Min Quant & Real-Time Risk Intelligence. All rights reserved.</p>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>국내 증시 실시간 시세 연동 (한국투자증권 Open API)</span>
            <span>•</span>
            <span>Google Gemini AI Engine</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default FooterDisclaimer;
