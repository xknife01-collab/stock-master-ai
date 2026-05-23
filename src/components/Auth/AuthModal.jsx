import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Lock, Mail, Phone, AlertTriangle } from 'lucide-react';

const AuthModal = ({ isOpen, onClose, onSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const url = isLogin 
      ? 'http://localhost:5000/api/auth/login' 
      : 'http://localhost:5000/api/auth/register';

    const payload = isLogin 
      ? { email, password } 
      : { email, password, phone };

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
        <div className="flex gap-4 border-b border-white/5 mb-8">
          <button 
            onClick={() => { setIsLogin(true); setError(''); }}
            className={`pb-3 text-sm font-black uppercase tracking-widest transition-all relative ${isLogin ? 'text-blue-400' : 'text-white/40 hover:text-white/60'}`}
          >
            로그인
            {isLogin && (
              <motion.div layoutId="authTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
            )}
          </button>
          <button 
            onClick={() => { setIsLogin(false); setError(''); }}
            className={`pb-3 text-sm font-black uppercase tracking-widest transition-all relative ${!isLogin ? 'text-blue-400' : 'text-white/40 hover:text-white/60'}`}
          >
            회원가입
            {!isLogin && (
              <motion.div layoutId="authTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
            )}
          </button>
        </div>

        {/* Header Title */}
        <div className="mb-6">
          <h2 className="text-xl font-black italic tracking-tighter text-white uppercase">
            {isLogin ? 'QUANT LOGIN' : 'CREATE ACCOUNT'}
          </h2>
          <p className="text-[10px] text-white/30 tracking-widest uppercase font-bold mt-1">
            {isLogin ? 'Enter your credentials to manage holdings' : 'Join to set stop-loss sms notifications'}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 p-3 mb-6 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 font-medium"
          >
            <AlertTriangle size={14} className="shrink-0" />
            <span>{error}</span>
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
            <label className="block text-[9px] font-black text-white/40 uppercase tracking-widest mb-1.5">비밀번호</label>
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

          {/* Phone input for Registration */}
          {!isLogin && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="overflow-hidden"
            >
              <label className="block text-[9px] font-black text-white/40 uppercase tracking-widest mb-1.5">휴대폰 번호 (알림용)</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center text-white/20">
                  <Phone size={14} />
                </span>
                <input 
                  type="text" 
                  required={!isLogin}
                  placeholder="01012345678 (숫자만)"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3 pl-10 pr-4 text-xs text-white placeholder-white/20 focus:outline-none focus:border-blue-500/50 transition-all font-mono"
                />
              </div>
            </motion.div>
          )}

          {/* Submit Button */}
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 border border-blue-400/30 rounded-xl py-3.5 text-xs font-black uppercase tracking-widest text-white shadow-[0_0_15px_rgba(59,130,246,0.3)] transition-all disabled:opacity-50"
          >
            {loading ? '처리 중...' : (isLogin ? '로그인 시그널 가동' : '신규 계정 등록')}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

export default AuthModal;
