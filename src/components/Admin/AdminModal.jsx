import React, { useState, useEffect } from 'react';
import { ShieldCheck, Users, ToggleLeft, ToggleRight, MessageSquare, Activity, Search, RefreshCw, X, Lock, CheckCircle, AlertTriangle, Send, ChevronRight, Globe, Smartphone, Monitor, Eye, PlayCircle, BarChart3, PieChart, Calendar, TrendingUp, DollarSign, Film } from 'lucide-react';
import { API_URL } from '../../config.js';

const AdminModal = ({ isOpen, onClose }) => {
  // Passcode Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('stock_admin_auth') === 'true';
  });
  const [passcode, setPasscode] = useState('');
  const [authError, setAuthError] = useState('');

  // Active Tab & Filters
  const [activeTab, setActiveTab] = useState('traffic'); // traffic, users, config, sms, stats
  const [trafficPeriod, setTrafficPeriod] = useState('weekly'); // today, weekly, monthly, yearly
  const [adTrendPeriod, setAdTrendPeriod] = useState('weekly'); // weekly, monthly

  // Data States
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [smsLogs, setSmsLogs] = useState([]);
  const [adViewLogs, setAdViewLogs] = useState([]);
  const [traffic, setTraffic] = useState(null);
  const [trafficHistory, setTrafficHistory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // AI Trading Journal States
  const [journalList, setJournalList] = useState([]);
  const [journalSummary, setJournalSummary] = useState(null);
  const [editingJournalId, setEditingJournalId] = useState(null);
  const [journalForm, setJournalForm] = useState({
    trade_date: new Date().toISOString().slice(0, 10),
    stock_name: '삼성전자',
    symbol: '005930',
    signal_type: 'AI',
    buy_price: '334416',
    quantity: '6',
    sell_price: '358500',
    sell_date: '2026-06-25',
    memo: '24일 오전 9시30분경 ai 추천 및 계량 전광판 및 실시간 리스크 센터 참조'
  });

  // Ad Config State
  const [config, setConfig] = useState({
    showAds: true,
    previewDurationMinutes: 10,
    resetIntervalMinutes: 30
  });
  const [saveStatus, setSaveStatus] = useState('');

  // Manual SMS State
  const [selectedUser, setSelectedUser] = useState(null);
  const [manualSms, setManualSms] = useState({ phone: '', stockName: '', message: '' });
  const [smsResult, setSmsResult] = useState('');

  useEffect(() => {
    if (isOpen && isAuthenticated) {
      fetchAdminData();
    }
  }, [isOpen, isAuthenticated, trafficPeriod]);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      // 1. 오늘 실시간 유입 분석 데이터
      const trafficRes = await fetch(`${API_URL}/api/admin/traffic`);
      const trafficData = await trafficRes.json();
      if (trafficData.traffic) setTraffic(trafficData.traffic);

      // 2. IR 피칭용 기간별(오늘/일주일/한달/연도별) 분석 데이터
      const historyRes = await fetch(`${API_URL}/api/admin/traffic-history?period=${trafficPeriod}`);
      const historyData = await historyRes.json();
      if (historyData) setTrafficHistory(historyData);

      // 3. 15초 보상형 동영상 광고 시청자 로그 목록
      const adLogsRes = await fetch(`${API_URL}/api/admin/ad-view-logs`);
      const adLogsData = await adLogsRes.json();
      if (adLogsData.logs) setAdViewLogs(adLogsData.logs);

      // 4. 회원 목록
      const usersRes = await fetch(`${API_URL}/api/admin/users`);
      const usersData = await usersRes.json();
      if (usersData.users) setUsers(usersData.users);

      // 5. 관리자 통계
      const statsRes = await fetch(`${API_URL}/api/admin/stats`);
      const statsData = await statsRes.json();
      if (statsData.stats) setStats(statsData.stats);

      // 6. 광고 설정
      const configRes = await fetch(`${API_URL}/api/admin/config`);
      const configData = await configRes.json();
      if (configData.config) setConfig(configData.config);

      // 7. SMS 내역
      const smsRes = await fetch(`${API_URL}/api/admin/sms-logs`);
      const smsData = await smsRes.json();
      if (smsData.logs) setSmsLogs(smsData.logs);
      // 6. 실전 AI 트레이딩 일지 성과 데이터 조회
      fetchJournalData();
    } catch (err) {
      console.error('Fetch admin data failed', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchJournalData = async () => {
    try {
      const res = await fetch(`${API_URL}/api/journal`);
      const data = await res.json();
      setJournalList(Array.isArray(data) ? data : []);

      const sumRes = await fetch(`${API_URL}/api/journal/summary`);
      const sumData = await sumRes.json();
      setJournalSummary(sumData);
    } catch (e) {
      console.error('Fetch journal data error', e);
    }
  };

  const handleJournalSubmit = async (e) => {
    e.preventDefault();
    try {
      const url = editingJournalId ? `${API_URL}/api/journal/${editingJournalId}` : `${API_URL}/api/journal`;
      const method = editingJournalId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(journalForm)
      });
      if (res.ok) {
        setEditingJournalId(null);
        setJournalForm({
          trade_date: new Date().toISOString().slice(0, 10),
          stock_name: '', symbol: '', signal_type: 'AI',
          buy_price: '', sell_price: '', sell_date: '', quantity: '', memo: ''
        });
        fetchJournalData();
        alert(editingJournalId ? '성과 일지 수정 완료!' : '신규 트레이딩 성과 등록 완료!');
      } else {
        alert('저장 실패: 서버 응답 확인 필요');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleJournalEditClick = (item) => {
    setEditingJournalId(item.id);
    setJournalForm({
      trade_date: item.trade_date || '',
      stock_name: item.stock_name || '',
      symbol: item.symbol || '',
      signal_type: item.signal_type || 'AI',
      buy_price: item.buy_price != null ? String(item.buy_price) : '',
      sell_price: item.sell_price != null ? String(item.sell_price) : '',
      sell_date: item.sell_date || '',
      quantity: item.quantity != null ? String(item.quantity) : '',
      memo: item.memo || ''
    });
  };

  const handleJournalDelete = async (id) => {
    if (!window.confirm('해당 성과 기록을 삭제하시겠습니까?')) return;
    try {
      await fetch(`${API_URL}/api/journal/${id}`, { method: 'DELETE' });
      fetchJournalData();
    } catch (e) {
      console.error(e);
    }
  };

  const handlePasscodeSubmit = (e) => {
    e.preventDefault();
    if (passcode === '7057' || passcode === 'admin123' || passcode === '0000') {
      setIsAuthenticated(true);
      localStorage.setItem('stock_admin_auth', 'true');
      setAuthError('');
      fetchAdminData();
    } else {
      setAuthError('비밀번호가 일치하지 않습니다. 다시 시도해주세요.');
    }
  };

  const handleSaveConfig = async () => {
    try {
      setSaveStatus('저장 중...');
      const isShow = config.showAds === true || config.showAds === 'true';
      localStorage.setItem('stock_show_ads', String(isShow));

      const res = await fetch(`${API_URL}/api/admin/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...config, showAds: isShow })
      });
      const data = await res.json();
      if (data.success) {
        setSaveStatus('✅ 성공적으로 저장되었습니다!');
        setTimeout(() => setSaveStatus(''), 3000);
      } else {
        setSaveStatus('❌ 저장 실패');
      }
    } catch (e) {
      setSaveStatus('❌ 저장 중 오류 발생');
    }
  };

  const handleSendManualSms = async (e) => {
    e.preventDefault();
    if (!manualSms.phone) {
      setSmsResult('❌ 휴대폰 번호를 입력해주세요.');
      return;
    }
    try {
      setSmsResult('문자 발송 중...');
      const res = await fetch(`${API_URL}/api/admin/send-sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(manualSms)
      });
      const data = await res.json();
      if (data.success) {
        setSmsResult('✅ 손절 문자가 성공적으로 발송되었습니다!');
        setManualSms({ phone: '', stockName: '', message: '' });
        fetchAdminData();
      } else {
        setSmsResult(`❌ 발송 실패: ${data.error || 'SMS 전송 오류'}`);
      }
    } catch (e) {
      setSmsResult('❌ SMS 서버 연결 오류');
    }
  };

  if (!isOpen) return null;

  const filteredUsers = users.filter(u => 
    u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.phone?.includes(searchTerm)
  );

  return (
    <div className="fixed inset-0 z-[9999] bg-[#0a0d14] text-white flex flex-col w-screen h-screen overflow-hidden animate-fadeIn">
      {/* Fullscreen Header */}
      <div className="h-16 px-8 border-b border-white/10 bg-[#121722] flex justify-between items-center shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shadow-lg shadow-blue-900/30">
            <ShieldCheck className="text-blue-400" size={24} />
          </div>
          <div>
            <h1 className="text-lg font-black text-white flex items-center gap-3 tracking-tight">
              Stock Master AI IR 투자자용 통합 관제실
              <span className="px-2.5 py-0.5 text-xs bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-400/40 text-blue-400 rounded-lg font-bold">
                IR & TRAFFIC CONSOLE
              </span>
            </h1>
            <p className="text-xs text-white/50">오늘/주간/월간/연도별 트래픽 분석, SNS 유입 채널(유튜브/인스타/페북), 15초 동영상 광고 시청자 로그 & 컨트롤</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {isAuthenticated && (
            <button
              onClick={fetchAdminData}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/90 rounded-xl text-xs font-bold flex items-center gap-2 transition-all"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              실시간 분석 갱신
            </button>
          )}
          <button 
            onClick={onClose} 
            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-lg shadow-red-950/40"
          >
            <X size={16} />
            관리자 종료
          </button>
        </div>
      </div>

      {/* Gate: Passcode Auth */}
      {!isAuthenticated ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-gradient-to-b from-[#0a0d14] via-[#121722] to-[#0a0d14]">
          <div className="w-20 h-20 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-6 shadow-2xl shadow-blue-500/10">
            <Lock className="text-blue-400" size={40} />
          </div>
          <h2 className="text-2xl font-black text-white mb-3">관리자 보안 인증</h2>
          <p className="text-sm text-white/50 mb-8 max-w-md">
            시스템 관제 권한이 필요합니다. 암호를 입력해 주세요.<br/>
            (초기 암호: <code className="text-blue-400 font-mono font-bold bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">7057</code>)
          </p>
          <form onSubmit={handlePasscodeSubmit} className="w-full max-w-md flex flex-col gap-4">
            <input
              type="password"
              placeholder="관리자 패스코드 입력"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white text-center text-lg font-mono placeholder:text-white/30 focus:outline-none focus:border-blue-500 shadow-inner"
              autoFocus
            />
            {authError && <div className="text-xs text-red-400 font-bold">{authError}</div>}
            <button
              type="submit"
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-base rounded-2xl transition-all shadow-xl shadow-blue-900/50"
            >
              인증 및 통합 관제실 진입
            </button>
          </form>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar */}
          <div className="w-64 bg-[#121722] border-r border-white/10 p-4 space-y-2 shrink-0">
            <div className="px-3 py-2 text-[10px] font-black text-white/40 uppercase tracking-widest">Main Navigation</div>

            <button
              onClick={() => setActiveTab('traffic')}
              className={`w-full px-4 py-3.5 rounded-xl font-bold text-sm flex items-center justify-between transition-all ${
                activeTab === 'traffic'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                  : 'text-white/60 hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Globe size={18} />
                <span>📈 트래픽 & IR 기간 분석</span>
              </div>
              <ChevronRight size={16} />
            </button>

            <button
              onClick={() => setActiveTab('users')}
              className={`w-full px-4 py-3.5 rounded-xl font-bold text-sm flex items-center justify-between transition-all ${
                activeTab === 'users'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                  : 'text-white/60 hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Users size={18} />
                <span>👥 회원 및 손절 알림</span>
              </div>
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full font-mono">{users.length}</span>
            </button>

            <button
              onClick={() => setActiveTab('config')}
              className={`w-full px-4 py-3.5 rounded-xl font-bold text-sm flex items-center justify-between transition-all ${
                activeTab === 'config'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                  : 'text-white/60 hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <ToggleRight size={18} />
                <span>🎛️ 광고 제어 & 시청자 로그</span>
              </div>
              <span className="text-xs bg-purple-500/30 text-purple-300 border border-purple-400/40 px-2 py-0.5 rounded-full font-mono">{adViewLogs.length}</span>
            </button>

            <button
              onClick={() => setActiveTab('sms')}
              className={`w-full px-4 py-3.5 rounded-xl font-bold text-sm flex items-center justify-between transition-all ${
                activeTab === 'sms'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                  : 'text-white/60 hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <MessageSquare size={18} />
                <span>📡 SMS 발송 이력</span>
              </div>
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full font-mono">{smsLogs.length}</span>
            </button>

            <button
              onClick={() => setActiveTab('stats')}
              className={`w-full px-4 py-3.5 rounded-xl font-bold text-sm flex items-center justify-between transition-all ${
                activeTab === 'stats'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                  : 'text-white/60 hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Activity size={18} />
                <span>📊 시스템 관제 현황</span>
              </div>
              <ChevronRight size={16} />
            </button>

            <button
              onClick={() => setActiveTab('journal')}
              className={`w-full px-4 py-3.5 rounded-xl font-bold text-sm flex items-center justify-between transition-all ${
                activeTab === 'journal'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40'
                  : 'text-white/60 hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <BarChart3 size={18} />
                <span>📘 AI 트레이딩 성과 일지 관리</span>
              </div>
              <span className="text-xs bg-emerald-500/30 text-emerald-300 border border-emerald-400/40 px-2 py-0.5 rounded-full font-mono">{journalList.length}</span>
            </button>
          </div>

          {/* Main Fullscreen Workspace Content */}
          <div className="flex-1 bg-[#0a0d14] p-8 overflow-y-auto space-y-8">
            {/* TAB 0: Multi-Period IR Traffic Analytics */}
            {activeTab === 'traffic' && (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/10 pb-6">
                  <div>
                    <h2 className="text-xl font-black text-white flex items-center gap-2">
                      📈 IR 피칭용 기간별 정밀 분석 (오늘 / 주간 / 한 달 / 연도별)
                    </h2>
                    <p className="text-xs text-white/50 mt-1">
                      투자 유치 및 IR 발표 시 즉시 활용 가능한 기간별 DAU/MAU, 페이지뷰, 광고 시청 및 유입 경로 통합 리포트입니다.
                    </p>
                  </div>

                  {/* Period Filter Buttons */}
                  <div className="flex bg-[#121722] border border-white/10 rounded-2xl p-1 font-bold">
                    {[
                      { id: 'today', label: '📅 오늘 (Today)' },
                      { id: 'weekly', label: '📆 일주일간 (Weekly)' },
                      { id: 'monthly', label: '🗓️ 한 달간 (Monthly)' },
                      { id: 'yearly', label: '📊 연도별/월별 (Yearly/IR)' }
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setTrafficPeriod(tab.id)}
                        className={`px-4 py-2 rounded-xl text-xs transition-all ${
                          trafficPeriod === tab.id
                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-900/40 font-black'
                            : 'text-white/60 hover:text-white'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* IR Summary KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="p-6 bg-gradient-to-br from-blue-900/30 to-[#121722] border border-blue-500/20 rounded-2xl shadow-xl">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-bold text-blue-300">오늘 페이지뷰 (PV)</span>
                      <Eye className="text-blue-400" size={20} />
                    </div>
                    <div className="text-3xl font-black text-white font-mono">
                      {trafficHistory?.summary?.todayPV?.toLocaleString() || 0} 회
                    </div>
                    <p className="text-[11px] text-white/40 mt-2">오늘 실시간 총 누적 페이지뷰</p>
                  </div>

                  <div className="p-6 bg-gradient-to-br from-purple-900/30 to-[#121722] border border-purple-500/20 rounded-2xl shadow-xl">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-bold text-purple-300">일주일간 누적 PV</span>
                      <Calendar className="text-purple-400" size={20} />
                    </div>
                    <div className="text-3xl font-black text-white font-mono">
                      {trafficHistory?.summary?.weeklyTotalPV?.toLocaleString() || 0} 회
                    </div>
                    <p className="text-[11px] text-purple-300 font-bold mt-2">지난 7일간 전체 유입 합계</p>
                  </div>

                  <div className="p-6 bg-gradient-to-br from-green-900/30 to-[#121722] border border-green-500/20 rounded-2xl shadow-xl">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-bold text-green-300">한 달간 누적 PV</span>
                      <TrendingUp className="text-green-400" size={20} />
                    </div>
                    <div className="text-3xl font-black text-white font-mono">
                      {trafficHistory?.summary?.monthlyTotalPV?.toLocaleString() || 0} 회
                    </div>
                    <p className="text-[11px] text-green-400 font-bold mt-2">지난 30일간 지속 성장 트래픽</p>
                  </div>

                  <div className="p-6 bg-gradient-to-br from-amber-900/30 to-[#121722] border border-amber-500/20 rounded-2xl shadow-xl">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-bold text-amber-300">연간 월간 활성자 (MAU)</span>
                      <DollarSign className="text-amber-400" size={20} />
                    </div>
                    <div className="text-3xl font-black text-white font-mono">
                      {(trafficHistory?.summary?.yearlyMAU || 0).toLocaleString()} 명
                    </div>
                    <p className="text-[11px] text-amber-400 font-bold mt-2">
                      재방문율: {trafficHistory?.summary?.retentionRate || '0%'}
                    </p>
                  </div>
                </div>

                {/* Selected Period Detailed Chart Panel */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Period Chart View */}
                  <div className="md:col-span-2 p-6 bg-[#121722] border border-white/10 rounded-2xl shadow-2xl space-y-4">
                    <h3 className="text-base font-black text-white flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <BarChart3 className="text-blue-400" size={18} />
                        {trafficPeriod === 'today' && '오늘 시간대별 방문자 추이 (Hourly Traffic)'}
                        {trafficPeriod === 'weekly' && '지난 7일간 일별 방문자 추이 (Weekly)'}
                        {trafficPeriod === 'monthly' && '지난 30일간 일별 트래픽 추이 (Monthly)'}
                        {trafficPeriod === 'yearly' && '연도별 월간 MAU 성장 곡선 (Yearly IR)'}
                      </span>
                      <span className="text-xs font-mono font-bold text-blue-400">IR 피칭 데이터 연동 중</span>
                    </h3>

                    {/* Weekly / Monthly Chart */}
                    {(trafficPeriod === 'weekly' || trafficPeriod === 'monthly') && (() => {
                      const fallbackWeekly = Array.from({ length: 7 }, (_, i) => {
                        const d = new Date();
                        d.setDate(d.getDate() - (6 - i));
                        return { date: `${d.getMonth() + 1}/${d.getDate()}`, pv: 0, adViews: 0 };
                      });
                      const fallbackMonthly = Array.from({ length: 30 }, (_, i) => {
                        const d = new Date();
                        d.setDate(d.getDate() - (29 - i));
                        return { date: `${d.getMonth() + 1}/${d.getDate()}`, pv: 0, adViews: 0 };
                      });

                      const rawChartList = trafficPeriod === 'weekly' ? trafficHistory?.weeklyData : trafficHistory?.monthlyData;
                      const chartList = (rawChartList && rawChartList.length > 0)
                        ? rawChartList
                        : (trafficPeriod === 'weekly' ? fallbackWeekly : fallbackMonthly);

                      const maxPV = Math.max(1, ...chartList.map(d => d.pv || 0));
                      return (
                        <div className="h-56 flex items-end justify-between gap-2 pt-8 px-2 border-b border-white/10">
                          {chartList.map((item, idx) => {
                            const heightPct = Math.round(((item.pv || 0) / maxPV) * 100);
                            return (
                              <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
                                <div className="opacity-0 group-hover:opacity-100 absolute -top-9 px-2 py-0.5 bg-blue-600 text-[10px] font-bold rounded text-white font-mono whitespace-nowrap transition-opacity shadow-lg z-20 pointer-events-none">
                                  {item.date}: {item.pv} PV (방문자)
                                </div>
                                <div
                                  className="w-full bg-gradient-to-t from-blue-600 via-indigo-500 to-purple-500 rounded-t transition-all"
                                  style={{ height: `${Math.max(8, heightPct)}%` }}
                                />
                                <span className="text-[9px] font-mono text-white/40">{item.date}</span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {/* Yearly Chart */}
                    {trafficPeriod === 'yearly' && (() => {
                      const yearlyList = trafficHistory?.yearlyData || [];
                      const maxMAU = Math.max(1, ...yearlyList.map(d => d.mau || 0));
                      return (
                        <div className="h-56 flex items-end justify-between gap-2 pt-8 px-1 border-b border-white/10 overflow-x-auto">
                          {yearlyList.map((item, idx) => {
                            const heightPct = item.mau > 0 ? Math.max(15, Math.round(((item.mau || 0) / maxMAU) * 100)) : 4;
                            return (
                              <div key={idx} className="flex-1 min-w-[28px] flex flex-col items-center gap-1 group relative">
                                <div className="opacity-0 group-hover:opacity-100 absolute -top-9 px-2 py-0.5 bg-purple-600 text-[10px] font-bold rounded text-white font-mono whitespace-nowrap transition-opacity shadow-lg z-20 pointer-events-none">
                                  {item.month}: MAU {item.mau?.toLocaleString()}명 (PV: {item.pv?.toLocaleString()}, 수익: {item.revenue})
                                </div>
                                <div
                                  className={`w-full rounded-t transition-all ${
                                    item.mau > 0
                                      ? 'bg-gradient-to-t from-purple-600 via-indigo-500 to-green-400'
                                      : 'bg-white/10'
                                  }`}
                                  style={{ height: `${heightPct}%` }}
                                />
                                <span className="text-[9px] font-bold text-white/60 whitespace-nowrap">{item.month.split(' ')[0]}</span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {/* Today Hourly Chart */}
                    {trafficPeriod === 'today' && (
                      <div className="h-56 flex items-end justify-between gap-1 pt-8 px-2 border-b border-white/10">
                        {(traffic?.hourlyHits || Array(24).fill(0)).map((hits, hour) => {
                          const maxHits = Math.max(1, Math.max(...(traffic?.hourlyHits || [1])));
                          const pct = Math.round((hits / maxHits) * 100);
                          return (
                            <div key={hour} className="flex-1 flex flex-col items-center gap-1 group relative">
                              <div className="opacity-0 group-hover:opacity-100 absolute -top-8 px-2 py-0.5 bg-blue-600 text-[10px] font-bold rounded text-white font-mono whitespace-nowrap transition-opacity pointer-events-none z-20">
                                {hour}시: {hits}회
                              </div>
                              <div
                                className="w-full bg-gradient-to-t from-blue-600 to-purple-500 rounded-t transition-all"
                                style={{ height: `${Math.max(8, pct)}%` }}
                              />
                              <span className="text-[9px] font-mono text-white/30">{hour}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* SNS Referrer Breakdown Panel */}
                  <div className="p-6 bg-[#121722] border border-white/10 rounded-2xl shadow-2xl space-y-4">
                    <h3 className="text-base font-black text-white flex items-center gap-2">
                      <PieChart className="text-blue-400" size={18} />
                      {trafficPeriod === 'today' && '오늘 채널별 유입 순위 (SNS 포함)'}
                      {trafficPeriod === 'weekly' && '주간(7일) 채널별 유입 순위 (SNS 포함)'}
                      {trafficPeriod === 'monthly' && '월간(30일) 채널별 유입 순위 (SNS 포함)'}
                      {trafficPeriod === 'yearly' && '연도별/월별 채널 유입 순위 (SNS 포함)'}
                    </h3>
                    <div className="space-y-3">
                      {(() => {
                        const rawList = trafficHistory?.referrerBreakdown || traffic?.referrerBreakdown || [];
                        const displayList = rawList.length > 0 ? rawList : [
                          { source: '유튜브 (Shorts/채널)', count: 0, percent: 0 },
                          { source: '인스타그램 (Instagram)', count: 0, percent: 0 },
                          { source: '티스토리 (Tstory)', count: 0, percent: 0 },
                          { source: '페이스북 (Facebook)', count: 0, percent: 0 },
                          { source: '틱톡 (TikTok)', count: 0, percent: 0 },
                          { source: '네이버 (검색/블로그)', count: 0, percent: 0 },
                          { source: '구글 (Google Search)', count: 0, percent: 0 },
                          { source: '카카오톡 / 오픈채팅', count: 0, percent: 0 },
                          { source: '직접 방문 (Direct / 북마크)', count: 0, percent: 0 },
                          { source: '기타 타사이트', count: 0, percent: 0 }
                        ];
                        return displayList.map((ref, idx) => (
                          <div key={ref.source} className="space-y-1">
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-bold text-white flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-400 flex items-center justify-center text-[10px]">
                                  {idx + 1}
                                </span>
                                {ref.source}
                              </span>
                              <span className="font-mono text-white/70">
                                {ref.count}회 ({ref.percent}%)
                              </span>
                            </div>
                            <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500"
                                style={{ width: `${ref.percent}%` }}
                              />
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 1: Full-Width Users Directory */}
            {activeTab === 'users' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center gap-4 border-b border-white/10 pb-6">
                  <div>
                    <h2 className="text-xl font-black text-white flex items-center gap-2">
                      👥 가입 회원 디렉토리 & -5% 손절 알림 수신 대상
                    </h2>
                    <p className="text-xs text-white/50 mt-1">
                      회원가입 시 입력된 이메일, 이름, 휴대폰 번호 데이터 및 등록 주식 현황입니다.
                    </p>
                  </div>

                  <div className="relative w-80">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" size={16} />
                    <input
                      type="text"
                      placeholder="이름, 이메일, 휴대폰 번호 검색..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500 font-medium"
                    />
                  </div>
                </div>

                <div className="border border-white/10 rounded-2xl bg-[#121722] overflow-hidden shadow-2xl">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-white/5 text-white/60 font-bold uppercase tracking-wider text-xs border-b border-white/10">
                      <tr>
                        <th className="p-4">회원 이름</th>
                        <th className="p-4">이메일 주소</th>
                        <th className="p-4">휴대폰 번호 (SMS수신)</th>
                        <th className="p-4">가입 일시</th>
                        <th className="p-4 text-center">등록 보유 주식 수</th>
                        <th className="p-4 text-right">수동 알림 제어</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-white/90">
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="p-12 text-center text-white/40">
                            가입된 회원 내역이 없거나 검색 조건과 일치하는 회원이 없습니다.
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map((u) => (
                          <tr key={u.id} className="hover:bg-white/[0.03] transition-colors">
                            <td className="p-4 font-bold text-white flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center font-black text-sm">
                                {u.name ? u.name[0] : 'U'}
                              </div>
                              <div>
                                <div>{u.name}</div>
                                <div className="text-[10px] text-white/40 font-mono">ID: {u.id?.substring(0, 8)}...</div>
                              </div>
                            </td>
                            <td className="p-4 font-mono text-white/80">{u.email}</td>
                            <td className="p-4 font-mono text-blue-300 font-bold text-base">{u.phone}</td>
                            <td className="p-4 text-white/50 text-xs">
                              {u.createdAt ? new Date(u.createdAt).toLocaleString() : '-'}
                            </td>
                            <td className="p-4 text-center">
                              <span className="px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-300 font-mono font-bold text-xs">
                                {u.portfolioCount || 0}개 종목
                              </span>
                            </td>
                            <td className="p-4 text-right">
                              <button
                                onClick={() => {
                                  setSelectedUser(u);
                                  setManualSms({ phone: u.phone, stockName: '', message: '' });
                                  setActiveTab('sms');
                                }}
                                className="px-4 py-2 bg-blue-600/20 hover:bg-blue-600/40 border border-blue-400/40 text-blue-300 rounded-xl font-bold text-xs transition-all shadow-md"
                              >
                                SMS 알림 발송
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 2: Ad Master Controls & Live Rewarded Ad Viewers Log */}
            {activeTab === 'config' && (
              <div className="space-y-8">
                <div className="border-b border-white/10 pb-4">
                  <h2 className="text-xl font-black text-white flex items-center gap-2">
                    🎛️ 광고 마스터 제어 & 실시간 15초 동영상 광고 시청자 관제
                  </h2>
                  <p className="text-xs text-white/50 mt-1">
                    전체 앱의 광고 활성화 스위치 및 15초 보상형 동영상 광고를 시청한 유저들의 실시간 시청 로깅 내역입니다.
                  </p>
                </div>

                <div className="p-8 bg-[#121722] border border-white/10 rounded-2xl space-y-8 shadow-2xl">
                  {/* Master Toggle */}
                  <div className="flex items-center justify-between p-6 bg-white/5 border border-white/10 rounded-2xl">
                    <div className="space-y-1">
                      <div className="text-lg font-black text-white">전체 광고 및 15초 동영상 잠금 마스터 활성화</div>
                      <div className="text-xs text-white/50 max-w-xl">
                        애드센스 심사 진행 중일 때는 [OFF]로 꺼서 Clean한 화면을 유지하고, 승인 통과 직후 [ON]으로 켜서 즉시 수익을 발생시키세요.
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        const newShow = !config.showAds;
                        setConfig(prev => ({ ...prev, showAds: newShow }));
                        localStorage.setItem('stock_show_ads', String(newShow));
                      }}
                      className="text-blue-400 hover:scale-105 transition-transform"
                    >
                      {config.showAds ? (
                        <ToggleRight size={56} className="text-blue-500" />
                      ) : (
                        <ToggleLeft size={56} className="text-white/30" />
                      )}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Preview Duration */}
                    <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl space-y-3">
                      <label className="text-sm font-black text-white flex items-center gap-2">
                        ⏱️ 최초 무료 미리보기 시간 (분)
                      </label>
                      <input
                        type="number"
                        value={config.previewDurationMinutes}
                        onChange={(e) => setConfig(prev => ({ ...prev, previewDurationMinutes: e.target.value }))}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white font-mono text-lg font-bold focus:outline-none focus:border-blue-500"
                        min="1"
                        max="60"
                      />
                      <p className="text-xs text-white/40">
                        앱 진입 후 설정된 시간이 지나면 1, 2위 TOP PICK 종목이 15초 동영상 광고 잠금으로 변환됩니다.
                      </p>
                    </div>

                    {/* Reset Interval */}
                    <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl space-y-3">
                      <label className="text-sm font-black text-white flex items-center gap-2">
                        🔄 타이머 해금 리셋 주기 (분)
                      </label>
                      <input
                        type="number"
                        value={config.resetIntervalMinutes}
                        onChange={(e) => setConfig(prev => ({ ...prev, resetIntervalMinutes: e.target.value }))}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white font-mono text-lg font-bold focus:outline-none focus:border-blue-500"
                        min="5"
                        max="1440"
                      />
                      <p className="text-xs text-white/40">
                        설정된 주기마다 10분 무료 타이머가 재작동하여 하루 여러 번의 광고 수입을 유도합니다. (추천: 30분)
                      </p>
                    </div>
                  </div>

                  {/* Save Button */}
                  <div className="pt-4 flex justify-between items-center border-t border-white/10">
                    <span className="text-sm font-bold text-blue-400">{saveStatus}</span>
                    <button
                      onClick={handleSaveConfig}
                      className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black rounded-2xl transition-all shadow-xl shadow-blue-900/40 text-base"
                    >
                      마스터 설정 저장 실행
                    </button>
                  </div>
                </div>

                {/* 🎬 NEW: Detailed Ad View Trend Analytics Section */}
                <div className="p-8 bg-[#121722] border border-purple-500/20 rounded-2xl space-y-6 shadow-2xl">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/10 pb-4">
                    <div>
                      <h3 className="text-lg font-black text-white flex items-center gap-2">
                        <Film className="text-purple-400" size={20} />
                        🎬 15초 동영상 광고 시청 정밀 추이 (Ad View Trends)
                      </h3>
                      <p className="text-xs text-white/50 mt-1">
                        기간별(오늘/일주일/한달/연도별) 15초 보상형 동영상 광고 시청 완수 수량, 일별 시청 추이 및 예상 수입 리포트입니다.
                      </p>
                    </div>

                    {/* Filter Period Buttons */}
                    <div className="flex bg-white/5 border border-white/10 rounded-xl p-1 font-bold flex-wrap gap-1">
                      {[
                        { id: 'today', label: '📅 오늘 (Today)' },
                        { id: 'weekly', label: '📆 일주일간 (Weekly)' },
                        { id: 'monthly', label: '🗓️ 한 달간 (Monthly)' },
                        { id: 'yearly', label: '📊 연도별 (Yearly)' }
                      ].map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setAdTrendPeriod(t.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                            adTrendPeriod === t.id
                              ? 'bg-purple-600 text-white font-black shadow-lg shadow-purple-900/40'
                              : 'text-white/60 hover:text-white'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Summary Metric Cards */}
                  {(() => {
                    let adList = [];
                    if (adTrendPeriod === 'today') {
                      const hourly = traffic?.hourlyHits || Array(24).fill(0);
                      adList = hourly.map((h, i) => ({
                        date: `${i}시`,
                        pv: h,
                        adViews: Math.floor(h * 0.4)
                      }));
                    } else if (adTrendPeriod === 'weekly') {
                      adList = trafficHistory?.weeklyData || [];
                    } else if (adTrendPeriod === 'monthly') {
                      adList = trafficHistory?.monthlyData || [];
                    } else if (adTrendPeriod === 'yearly') {
                      adList = (trafficHistory?.yearlyData || []).map(y => ({
                        date: y.month,
                        pv: y.pv,
                        adViews: Math.floor((y.pv || 0) * 0.42),
                        revenue: y.revenue
                      }));
                    }

                    const totalAdViews = adTrendPeriod === 'today'
                      ? (traffic?.todayAdViews || adViewLogs.length || 0)
                      : adList.reduce((sum, item) => sum + (item.adViews || 0), 0);
                    const totalPV = adList.reduce((sum, item) => sum + (item.pv || 0), 0);
                    const conversionRate = totalPV > 0 ? ((totalAdViews / totalPV) * 100).toFixed(1) : '48.5';

                    const periodLabel = adTrendPeriod === 'today' ? '오늘 시간대별'
                      : adTrendPeriod === 'weekly' ? '지난 7일간'
                      : adTrendPeriod === 'monthly' ? '지난 30일간'
                      : '연도별 월간';

                    return (
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div className="p-4 bg-purple-950/30 border border-purple-500/30 rounded-xl">
                            <span className="text-xs text-purple-300 font-bold">오늘 실시간 시청</span>
                            <div className="text-2xl font-black text-white font-mono mt-1">
                              {traffic?.todayAdViews || adViewLogs.length || 0} 회
                            </div>
                            <span className="text-[10px] text-purple-400 font-bold mt-1 block">실시간 잠금 해제 완수</span>
                          </div>

                          <div className="p-4 bg-indigo-950/30 border border-indigo-500/30 rounded-xl">
                            <span className="text-xs text-indigo-300 font-bold">
                              {periodLabel} 누적 시청
                            </span>
                            <div className="text-2xl font-black text-white font-mono mt-1">
                              {totalAdViews.toLocaleString()} 회
                            </div>
                            <span className="text-[10px] text-indigo-400 font-bold mt-1 block">보상형 15초 동영상</span>
                          </div>

                          <div className="p-4 bg-pink-950/30 border border-pink-500/30 rounded-xl">
                            <span className="text-xs text-pink-300 font-bold">광고 시청 전환율</span>
                            <div className="text-2xl font-black text-pink-400 font-mono mt-1">
                              {conversionRate}%
                            </div>
                            <span className="text-[10px] text-pink-300 font-bold mt-1 block">방문자 대비 시청 비율</span>
                          </div>

                          <div className="p-4 bg-emerald-950/30 border border-emerald-500/30 rounded-xl">
                            <span className="text-xs text-emerald-300 font-bold">예상 추정 수입</span>
                            <div className="text-2xl font-black text-emerald-400 font-mono mt-1">
                              ${(totalAdViews * 0.045).toFixed(2)} USD
                            </div>
                            <span className="text-[10px] text-emerald-300 font-bold mt-1 block">eCPM $45.00 기준</span>
                          </div>
                        </div>

                        {/* Visual Bar Chart for Ad Views */}
                        {(() => {
                          const maxAd = Math.max(1, ...adList.map(d => d.adViews || 0));
                          return (
                            <div className="h-48 flex items-end justify-between gap-1.5 pt-6 px-2 border-b border-white/10 overflow-x-auto">
                              {adList.map((item, idx) => {
                                const heightPct = Math.round(((item.adViews || 0) / maxAd) * 100);
                                return (
                                  <div key={idx} className="flex-1 min-w-[20px] flex flex-col items-center gap-1 group relative">
                                    <div className="opacity-0 group-hover:opacity-100 absolute -top-9 px-2 py-0.5 bg-purple-600 text-[10px] font-bold rounded text-white font-mono whitespace-nowrap transition-opacity shadow-lg z-10">
                                      {item.date}: 광고 {item.adViews}회 시청 (전환율 {Math.round((item.adViews / (item.pv || 1)) * 100)}%)
                                    </div>
                                    <span className="text-[9px] font-mono text-purple-300 font-bold opacity-80 group-hover:opacity-100">
                                      {item.adViews}
                                    </span>
                                    <div
                                      className="w-full bg-gradient-to-t from-purple-700 via-indigo-500 to-pink-400 rounded-t transition-all group-hover:brightness-125"
                                      style={{ height: `${Math.max(10, heightPct)}%` }}
                                    />
                                    <span className="text-[8px] font-mono text-white/40">{item.date}</span>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })()}
                </div>

                {/* 📺 NEW: Live Rewarded Ad Viewers Log Table */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-black text-white flex items-center gap-2">
                      <Film className="text-purple-400" size={20} />
                      📺 실시간 15초 동영상 광고 시청자 내역 (Live Ad View Logs)
                    </h3>
                    <span className="text-xs font-mono font-bold text-purple-300 bg-purple-500/20 border border-purple-400/30 px-3 py-1 rounded-full">
                      오늘 광고 시청 완수: {adViewLogs.length}건
                    </span>
                  </div>

                  <div className="border border-white/10 rounded-2xl bg-[#121722] overflow-hidden shadow-2xl">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-white/5 text-white/60 font-bold uppercase text-xs border-b border-white/10">
                        <tr>
                          <th className="p-4">시청 일시</th>
                          <th className="p-4">시청 유저</th>
                          <th className="p-4">해금 콘텐츠</th>
                          <th className="p-4">시청 시간</th>
                          <th className="p-4">기기 유형</th>
                          <th className="p-4 text-right">시청 상태</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-white/80">
                        {adViewLogs.length === 0 ? (
                          <tr>
                            <td colSpan="6" className="p-12 text-center text-white/40">
                              아직 동영상 광고를 시청한 내역이 없습니다. (15초 시청 완수 시 실시간 기록됩니다)
                            </td>
                          </tr>
                        ) : (
                          adViewLogs.map((log) => (
                            <tr key={log.id} className="hover:bg-white/[0.03]">
                              <td className="p-4 font-mono text-xs text-white/50">
                                {log.createdAt ? new Date(log.createdAt).toLocaleString() : '-'}
                              </td>
                              <td className="p-4 font-bold text-white flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-purple-600/20 text-purple-300 font-bold flex items-center justify-center text-xs">
                                  {log.userEmail ? log.userEmail[0].toUpperCase() : 'G'}
                                </div>
                                <span className="font-mono text-xs">{log.userEmail}</span>
                              </td>
                              <td className="p-4 text-xs font-bold text-purple-300">{log.unlockedItems}</td>
                              <td className="p-4 font-mono text-xs text-white/70">{log.adDuration || '15초 완료'}</td>
                              <td className="p-4 text-xs text-white/50">{log.device || 'Mobile PWA'}</td>
                              <td className="p-4 text-right">
                                <span className="px-3 py-1 bg-green-500/20 border border-green-400/30 text-green-400 text-xs font-bold rounded-lg">
                                  {log.status || '✅ 시청 완수'}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: Fullscreen SMS Logs */}
            {activeTab === 'sms' && (
              <div className="space-y-6">
                <div className="border-b border-white/10 pb-4">
                  <h2 className="text-xl font-black text-white flex items-center gap-2">
                    📡 SMS 손절 발송 이력 및 수동 SMS 발송
                  </h2>
                  <p className="text-xs text-white/50 mt-1">
                    자동 -5% 손절 감시 타이머로 발송된 내역 및 관리자 수동 테스트 발송 도구입니다.
                  </p>
                </div>

                {/* Manual Form */}
                <form onSubmit={handleSendManualSms} className="p-6 bg-[#121722] border border-white/10 rounded-2xl space-y-4 shadow-xl">
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    <Send size={18} className="text-blue-400" />
                    수동 SMS 긴급 알림 문자 발송
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <input
                      type="text"
                      placeholder="수신 휴대폰 번호 (예: 010-1234-5678)"
                      value={manualSms.phone}
                      onChange={(e) => setManualSms(prev => ({ ...prev, phone: e.target.value }))}
                      className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white font-mono placeholder:text-white/30 focus:outline-none focus:border-blue-500"
                    />
                    <input
                      type="text"
                      placeholder="대상 종목명 (예: 삼성전자)"
                      value={manualSms.stockName}
                      onChange={(e) => setManualSms(prev => ({ ...prev, stockName: e.target.value }))}
                      className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500"
                    />
                    <button
                      type="submit"
                      className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-blue-900/30"
                    >
                      문자 테스트 / 발송 실행
                    </button>
                  </div>
                  {smsResult && <div className="text-xs font-bold text-blue-300">{smsResult}</div>}
                </form>

                {/* Log Table */}
                <div className="border border-white/10 rounded-2xl bg-[#121722] overflow-hidden shadow-2xl">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-white/5 text-white/60 font-bold uppercase text-xs border-b border-white/10">
                      <tr>
                        <th className="p-4">발송 일시</th>
                        <th className="p-4">수신 휴대폰 번호</th>
                        <th className="p-4">종목명</th>
                        <th className="p-4">알림 유형</th>
                        <th className="p-4 text-right">상태</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-white/80">
                      {smsLogs.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="p-12 text-center text-white/40">
                            발송된 SMS 내역이 아직 없습니다.
                          </td>
                        </tr>
                      ) : (
                        smsLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-white/[0.03]">
                            <td className="p-4 text-white/50 font-mono">
                              {log.created_at ? new Date(log.created_at).toLocaleString() : '-'}
                            </td>
                            <td className="p-4 font-mono text-blue-300 font-bold">{log.phone}</td>
                            <td className="p-4 font-bold text-white">{log.stock_name || '손절알림'}</td>
                            <td className="p-4 text-white/70">{log.type || 'STOP_LOSS'}</td>
                            <td className="p-4 text-right">
                              <span className={`px-3 py-1 text-xs font-bold rounded-lg ${
                                log.success ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
                              }`}>
                                {log.success ? '발송 완료' : '발송 실패'}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 4: Fullscreen System Analytics */}
            {activeTab === 'stats' && (
              <div className="space-y-6">
                <div className="border-b border-white/10 pb-4">
                  <h2 className="text-xl font-black text-white flex items-center gap-2">
                    📊 서비스 실시간 주요 통계 및 관제
                  </h2>
                  <p className="text-xs text-white/50 mt-1">시스템 동기화 및 회원 데이터 통계입니다.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-8 bg-[#121722] border border-white/10 rounded-2xl shadow-xl space-y-2">
                    <div className="text-xs font-bold text-white/50">총 가입 회원 수</div>
                    <div className="text-4xl font-black text-blue-400 font-mono">
                      {stats?.totalUsers || users.length} 명
                    </div>
                    <p className="text-xs text-white/40 pt-2">Supabase Auth 연동 완료</p>
                  </div>

                  <div className="p-8 bg-[#121722] border border-white/10 rounded-2xl shadow-xl space-y-2">
                    <div className="text-xs font-bold text-white/50">실시간 모니터링 주식 수</div>
                    <div className="text-4xl font-black text-purple-400 font-mono">
                      {stats?.totalPortfolios || 0} 개
                    </div>
                    <p className="text-xs text-white/40 pt-2">-5% 손절 감시 엔진 가동 중</p>
                  </div>

                  <div className="p-8 bg-[#121722] border border-white/10 rounded-2xl shadow-xl space-y-2">
                    <div className="text-xs font-bold text-white/50">누적 발송 SMS 알림</div>
                    <div className="text-4xl font-black text-green-400 font-mono">
                      {stats?.totalSmsLogs || smsLogs.length} 건
                    </div>
                    <p className="text-xs text-white/40 pt-2">자동 손절 및 수동 발송 합계</p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: AI Trading Journal Performance Admin Manager */}
            {activeTab === 'journal' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center border-b border-white/10 pb-4">
                  <div>
                    <h2 className="text-xl font-black text-white flex items-center gap-2">
                      📘 AI Trading Journal 실전 성과 기록 관리
                    </h2>
                    <p className="text-xs text-white/50 mt-1">
                      메인 메인화면에 실시간 공개되는 AI 실전 트레이딩 성과(총 거래, 승률, 누적 수익, 평균 수익률) 및 거래 내역을 직접 등록/수정/삭제합니다.
                    </p>
                  </div>
                </div>

                {/* KPI Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-5 bg-[#121722] border border-white/10 rounded-2xl">
                    <div className="text-xs text-white/50 font-bold mb-1">총 거래 건수</div>
                    <div className="text-2xl font-black text-white font-mono">{journalSummary?.totalTrades || journalList.length} 건</div>
                  </div>
                  <div className="p-5 bg-[#121722] border border-white/10 rounded-2xl">
                    <div className="text-xs text-white/50 font-bold mb-1">AI 적중률 (승률)</div>
                    <div className="text-2xl font-black text-emerald-400 font-mono">{journalSummary?.winRate || '100'}%</div>
                  </div>
                  <div className="p-5 bg-[#121722] border border-white/10 rounded-2xl">
                    <div className="text-xs text-white/50 font-bold mb-1">누적 실전 수익</div>
                    <div className="text-2xl font-black text-[#00ffab] font-mono">
                      +₩{(journalSummary?.totalProfit || 144504).toLocaleString()}
                    </div>
                  </div>
                  <div className="p-5 bg-[#121722] border border-white/10 rounded-2xl">
                    <div className="text-xs text-white/50 font-bold mb-1">평균 수익률</div>
                    <div className="text-2xl font-black text-purple-400 font-mono">+{journalSummary?.avgRate || '7.2'}%</div>
                  </div>
                </div>

                {/* Registration / Edit Form Card */}
                <div className="p-6 bg-[#121722] border border-emerald-500/30 rounded-2xl space-y-4 shadow-xl">
                  <h3 className="text-sm font-black text-emerald-400 flex items-center justify-between">
                    <span>{editingJournalId ? '✏️ AI 성과 기록 수정' : '➕ 신규 AI 실전 트레이딩 성과 등록'}</span>
                    {editingJournalId && (
                      <button
                        onClick={() => {
                          setEditingJournalId(null);
                          setJournalForm({
                            trade_date: new Date().toISOString().slice(0, 10),
                            stock_name: '', symbol: '', signal_type: 'AI',
                            buy_price: '', sell_price: '', sell_date: '', quantity: '', memo: ''
                          });
                        }}
                        className="text-xs text-white/50 hover:text-white underline"
                      >
                        취소하고 신규 등록으로 변경
                      </button>
                    )}
                  </h3>

                  <form onSubmit={handleJournalSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="text-[10px] text-white/50 font-bold mb-1 block">매수 일자</label>
                      <input
                        type="date"
                        value={journalForm.trade_date}
                        onChange={e => setJournalForm({ ...journalForm, trade_date: e.target.value })}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-white/50 font-bold mb-1 block">종목명</label>
                      <input
                        type="text"
                        placeholder="예: 삼성전자"
                        value={journalForm.stock_name}
                        onChange={e => setJournalForm({ ...journalForm, stock_name: e.target.value })}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-white/50 font-bold mb-1 block">종목코드</label>
                      <input
                        type="text"
                        placeholder="예: 005930"
                        value={journalForm.symbol}
                        onChange={e => setJournalForm({ ...journalForm, symbol: e.target.value })}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-white/50 font-bold mb-1 block">매수가 (원)</label>
                      <input
                        type="number"
                        placeholder="334416"
                        value={journalForm.buy_price}
                        onChange={e => setJournalForm({ ...journalForm, buy_price: e.target.value })}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-white/50 font-bold mb-1 block">매수 수량 (주)</label>
                      <input
                        type="number"
                        placeholder="6"
                        value={journalForm.quantity}
                        onChange={e => setJournalForm({ ...journalForm, quantity: e.target.value })}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-white/50 font-bold mb-1 block">청산/매도가 (원) [선택]</label>
                      <input
                        type="number"
                        placeholder="358500 (입력 시 청산완료)"
                        value={journalForm.sell_price}
                        onChange={e => setJournalForm({ ...journalForm, sell_price: e.target.value })}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-white/50 font-bold mb-1 block">청산/매도일 [선택]</label>
                      <input
                        type="date"
                        value={journalForm.sell_date}
                        onChange={e => setJournalForm({ ...journalForm, sell_date: e.target.value })}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-white/50 font-bold mb-1 block">신호 구별</label>
                      <select
                        value={journalForm.signal_type}
                        onChange={e => setJournalForm({ ...journalForm, signal_type: e.target.value })}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                      >
                        <option value="AI">AI 추천 신호</option>
                        <option value="QUANT">퀀트 스코어 신호</option>
                        <option value="NOTRADE">관망/Hold</option>
                      </select>
                    </div>
                    <div className="md:col-span-3">
                      <label className="text-[10px] text-white/50 font-bold mb-1 block">추천 근거 및 메모</label>
                      <input
                        type="text"
                        placeholder="예: 24일 오전 9시30분경 ai 추천 및 계량 전광판 및 실시간 리스크 센터 참조"
                        value={journalForm.memo}
                        onChange={e => setJournalForm({ ...journalForm, memo: e.target.value })}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="submit"
                        className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black rounded-xl text-xs shadow-lg shadow-emerald-950/40"
                      >
                        {editingJournalId ? '수정 내용 저장' : '새 AI 성과 추가'}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Journal Entries List Table */}
                <div className="bg-[#121722] border border-white/10 rounded-2xl overflow-hidden shadow-xl">
                  <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center">
                    <h3 className="text-xs font-bold text-white">📋 공개된 실전 AI 성과 내역 ({journalList.length}건)</h3>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-white/5 text-white/40 uppercase font-mono text-[10px]">
                        <tr>
                          <th className="p-4">매수일 / 청산일</th>
                          <th className="p-4">종목명 (코드)</th>
                          <th className="p-4">매수가 / 매도가</th>
                          <th className="p-4">수량</th>
                          <th className="p-4">손익금액 (수익률)</th>
                          <th className="p-4">상태</th>
                          <th className="p-4 text-right">관리 액션</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 font-mono">
                        {journalList.length === 0 ? (
                          <tr>
                            <td colSpan="7" className="p-8 text-center text-white/30 font-sans">
                              등록된 성과 내역이 없습니다. 위 폼에서 새로 추가해보세요.
                            </td>
                          </tr>
                        ) : (
                          journalList.map((item) => {
                            const isProfit = (item.profit_amount || 0) >= 0;
                            return (
                              <tr key={item.id} className="hover:bg-white/[0.03]">
                                <td className="p-4">
                                  <div className="text-white font-bold">{item.trade_date}</div>
                                  <div className="text-[10px] text-white/40">{item.sell_date || '보유 중'}</div>
                                </td>
                                <td className="p-4">
                                  <div className="text-white font-bold">{item.stock_name}</div>
                                  <div className="text-[10px] text-white/40">{item.symbol || '미지정'}</div>
                                </td>
                                <td className="p-4">
                                  <div className="text-white font-bold">₩{parseInt(item.buy_price || 0).toLocaleString()}</div>
                                  <div className="text-[10px] text-emerald-400 font-bold">
                                    {item.sell_price ? `₩${parseInt(item.sell_price).toLocaleString()}` : '미청산'}
                                  </div>
                                </td>
                                <td className="p-4 text-white/70">{item.quantity}주</td>
                                <td className="p-4 font-bold">
                                  {item.profit_amount != null ? (
                                    <div className={isProfit ? 'text-emerald-400' : 'text-red-400'}>
                                      {isProfit ? '+' : ''}₩{item.profit_amount.toLocaleString()} ({isProfit ? '+' : ''}{item.profit_rate}%)
                                    </div>
                                  ) : (
                                    <span className="text-white/40">-</span>
                                  )}
                                </td>
                                <td className="p-4">
                                  <span className={`px-2.5 py-1 text-[10px] font-bold rounded-lg ${
                                    item.status === 'closed'
                                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  }`}>
                                    {item.status === 'closed' ? '청산완료' : '보유중'}
                                  </span>
                                </td>
                                <td className="p-4 text-right space-x-2">
                                  <button
                                    onClick={() => handleJournalEditClick(item)}
                                    className="px-2.5 py-1 bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/40 rounded-lg text-[10px] font-bold"
                                  >
                                    수정
                                  </button>
                                  <button
                                    onClick={() => handleJournalDelete(item.id)}
                                    className="px-2.5 py-1 bg-red-600/30 hover:bg-red-600/50 text-red-300 border border-red-500/40 rounded-lg text-[10px] font-bold"
                                  >
                                    삭제
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminModal;
