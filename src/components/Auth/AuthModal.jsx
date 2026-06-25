import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Lock, Mail, Phone, AlertTriangle, CheckCircle2, User } from 'lucide-react';
import { API_URL } from '../../config.js';

const AuthModal = ({ isOpen, onClose, onSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [isResetting, setIsResetting] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // SMS Verification States
  const [authCode, setAuthCode] = useState('');
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    let timer;
    if (isCodeSent && !isVerified && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isCodeSent, isVerified, timeLeft]);

  const [devNotice, setDevNotice] = useState('');

  const handleSendCode = async () => {
    if (!phone) {
      setError('휴대폰 번호를 먼저 입력해주세요.');
      return;
    }
    setError('');
    setDevNotice('');
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/send-sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setIsCodeSent(true);
      setIsVerified(false);
      setTimeLeft(180);

      // 🛠️ 로컬 개발: 서버가 dev_code를 반환하면 자동 입력
      if (data.dev_code) {
        setAuthCode(data.dev_code);
        setDevNotice(`🛠️ 로컬 테스트 모드: SMS 대신 인증번호 [${data.dev_code}]가 자동 입력되었습니다.`);
      } else {
        alert('인증번호가 발송되었습니다. 3분 이내에 입력해주세요.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!authCode) return;
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/verify-sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code: authCode })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setIsVerified(true);
      alert('인증이 완료되었습니다.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!isLogin && !isResetting && !isVerified) {
      setError('휴대폰 본인 인증을 먼저 완료해주세요.');
      return;
    }

    if (isResetting && !isVerified) {
      setError('비밀번호를 변경하려면 휴대폰 인증이 필요합니다.');
      return;
    }

    setLoading(true);

    if (isResetting) {
      try {
        const res = await fetch(`${API_URL}/api/auth/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, phone, newPassword: password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        
        alert('비밀번호가 성공적으로 변경되었습니다. 새 비밀번호로 로그인해주세요.');
        setIsResetting(false);
        setPassword('');
        setIsVerified(false);
        setIsCodeSent(false);
        setAuthCode('');
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
      return;
    }

    const url = isLogin 
      ? `${API_URL}/api/auth/login` 
      : `${API_URL}/api/auth/register`;

    const payload = isLogin 
      ? { email, password } 
      : { email, password, phone, name };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '인증에 실패했습니다.');
      }

      if (isLogin) {
        // 로그인 성공 시 세션 저장
        localStorage.setItem('stock_user_email', data.email);
        localStorage.setItem('stock_user_phone', data.phone || '');
        localStorage.setItem('stock_user_token', data.token);
        onSuccess({ email: data.email, phone: data.phone });
        onClose();
      } else {
        // 회원가입 성공 시 로그인 탭으로 전환
        alert('회원가입이 완료되었습니다. 로그인해 주세요.');
        setIsLogin(true);
        setPassword('');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      {/* Modal Card */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative w-full max-w-md overflow-hidden glass-card border border-blue-500/20 bg-gradient-to-b from-[#161b26] to-[#0c0f17] p-8 rounded-3xl shadow-[0_0_50px_rgba(59,130,246,0.15)]"
      >
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-white/40 hover:text-white hover:bg-white/10 p-1.5 rounded-full transition-all"
        >
          <X size={18} />
        </button>

        {/* Tab Selector */}
        {!isResetting && (
          <div className="flex gap-4 border-b border-white/5 mb-8">
            <button 
              type="button"
              onClick={() => { setIsLogin(true); setError(''); }}
              className={`pb-3 text-sm font-black uppercase tracking-widest transition-all relative ${isLogin ? 'text-blue-400' : 'text-white/40 hover:text-white/60'}`}
            >
              로그인
              {isLogin && (
                <motion.div layoutId="authTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
              )}
            </button>
            <button 
              type="button"
              onClick={() => { setIsLogin(false); setError(''); }}
              className={`pb-3 text-sm font-black uppercase tracking-widest transition-all relative ${!isLogin ? 'text-blue-400' : 'text-white/40 hover:text-white/60'}`}
            >
              회원가입
              {!isLogin && (
                <motion.div layoutId="authTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
              )}
            </button>
          </div>
        )}

        {/* Header Title */}
        <div className="mb-6 relative">
          {isResetting && (
            <button 
              type="button"
              onClick={() => { setIsResetting(false); setError(''); }}
              className="absolute -top-1 right-0 text-[10px] text-white/40 hover:text-white border border-white/10 px-2 py-1 rounded-lg"
            >
              ← 로그인으로 돌아가기
            </button>
          )}
          <h2 className="text-xl font-black italic tracking-tighter text-white uppercase">
            {isResetting ? 'RESET PASSWORD' : (isLogin ? 'QUANT LOGIN' : 'CREATE ACCOUNT')}
          </h2>
          <p className="text-[10px] text-white/30 tracking-widest uppercase font-bold mt-1">
            {isResetting ? 'Verify your phone to reset password' : (isLogin ? 'Enter your credentials to manage holdings' : 'Join to set stop-loss sms notifications')}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 p-3 mb-4 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 font-medium"
          >
            <AlertTriangle size={14} className="shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}

        {/* 🛠️ 로컬 개발 모드 안내 배너 */}
        {devNotice && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-2 p-3 mb-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-xs text-yellow-300 font-medium"
          >
            <span className="shrink-0 mt-0.5">⚠️</span>
            <span>{devNotice}</span>
          </motion.div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[9px] font-black text-white/40 uppercase tracking-widest mb-1.5">이메일 주소</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-3 flex items-center text-white/20">
                <Mail size={14} />
              </span>
              <input 
                type="email" 
                required
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3 pl-10 pr-4 text-xs text-white placeholder-white/20 focus:outline-none focus:border-blue-500/50 transition-all font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-[9px] font-black text-white/40 uppercase tracking-widest mb-1.5">
              {isResetting ? '새 비밀번호' : '비밀번호'}
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-3 flex items-center text-white/20">
                <Lock size={14} />
              </span>
              <input 
                type="password" 
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3 pl-10 pr-4 text-xs text-white placeholder-white/20 focus:outline-none focus:border-blue-500/50 transition-all font-mono"
              />
            </div>
          </div>

          {/* Name & Phone input for Registration or Resetting */}
          {(!isLogin || isResetting) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="overflow-hidden space-y-4 mb-4"
            >
              {!isResetting && (
                <div>
                  <label className="block text-[9px] font-black text-white/40 uppercase tracking-widest mb-1.5">이름 (실명)</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-3 flex items-center text-white/20">
                      <User size={14} />
                    </span>
                    <input 
                      type="text" 
                      required={!isLogin && !isResetting}
                      placeholder="홍길동"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3 pl-10 pr-4 text-xs text-white placeholder-white/20 focus:outline-none focus:border-blue-500/50 transition-all font-mono"
                    />
                  </div>
                </div>
              )}
              <div>
                <label className="block text-[9px] font-black text-white/40 uppercase tracking-widest mb-1.5">휴대폰 번호 (알림용)</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute inset-y-0 left-3 flex items-center text-white/20">
                      <Phone size={14} />
                    </span>
                    <input 
                      type="text" 
                      required={!isLogin || isResetting}
                      disabled={isVerified}
                      placeholder="01012345678 (숫자만)"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3 pl-10 pr-4 text-xs text-white placeholder-white/20 focus:outline-none focus:border-blue-500/50 transition-all font-mono disabled:opacity-50"
                    />
                  </div>
                  <button 
                    type="button"
                    onClick={handleSendCode}
                    disabled={loading || isVerified}
                    className="shrink-0 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl px-4 text-[10px] font-bold uppercase tracking-widest transition-all disabled:opacity-50 flex items-center gap-1"
                  >
                    {isVerified ? <><CheckCircle2 size={12} className="text-green-400" /> 인증완료</> : '인증번호 받기'}
                  </button>
                </div>
              </div>

              {isCodeSent && !isVerified && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white/[0.01] border border-white/5 p-3 rounded-xl"
                >
                  <label className="block text-[9px] font-black text-white/40 uppercase tracking-widest mb-1.5 flex justify-between">
                    <span>인증번호 6자리</span>
                    <span className="text-red-400 font-mono">
                      {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
                    </span>
                  </label>
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      placeholder="123456"
                      value={authCode}
                      onChange={(e) => setAuthCode(e.target.value)}
                      className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-2.5 px-4 text-xs text-white placeholder-white/20 focus:outline-none focus:border-blue-500/50 font-mono text-center tracking-widest"
                    />
                    <button 
                      type="button"
                      onClick={handleVerifyCode}
                      disabled={loading || timeLeft === 0 || !authCode}
                      className="shrink-0 bg-blue-600 hover:bg-blue-500 border border-blue-500/20 text-white rounded-xl px-5 text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                    >
                      확인
                    </button>
                  </div>
                  {timeLeft === 0 && (
                    <p className="text-[9px] text-red-400 mt-2 text-center">인증 시간이 초과되었습니다. 다시 요청해주세요.</p>
                  )}
                </motion.div>
              )}
            </motion.div>
          )}

          {/* Submit Button */}
          <button 
            type="submit" 
            disabled={loading || (!isLogin && !isVerified) || (isResetting && !isVerified)}
            className="w-full bg-blue-600 hover:bg-blue-500 border border-blue-400/30 rounded-xl py-3.5 text-xs font-black uppercase tracking-widest text-white shadow-[0_0_15px_rgba(59,130,246,0.3)] transition-all disabled:opacity-50 mt-2"
          >
            {loading ? '처리 중...' : (isResetting ? '비밀번호 변경' : (isLogin ? '로그인 시그널 가동' : '신규 계정 등록'))}
          </button>

          {isLogin && !isResetting && (
            <div className="text-center mt-4">
              <button
                type="button"
                onClick={() => { setIsResetting(true); setError(''); }}
                className="text-[10px] text-white/40 hover:text-white/80 transition-colors"
              >
                비밀번호를 잊으셨나요?
              </button>
            </div>
          )}
        </form>
      </motion.div>
    </div>
  );
};

export default AuthModal;
