import express from 'express';
import { registerUser, loginUser, resetUserPassword } from '../lib/db.js';
import { sendAuthCodeSMS } from '../lib/notifier.js';

const router = express.Router();

// 임시 인증번호 저장소 (메모리 방식: phone -> { code, expiresAt, verified })
const authCodeStore = new Map();

// [신규] 인증번호 발송 API
router.post('/send-sms', async (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: '휴대폰 번호를 입력해주세요.' });

    const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6자리 난수
    const expiresAt = Date.now() + 3 * 60 * 1000; // 3분 유효

    authCodeStore.set(phone, { code, expiresAt, verified: false });

    try {
        await sendAuthCodeSMS(phone, code);
        res.json({ message: '인증번호가 발송되었습니다.' });
    } catch (err) {
        console.error('❌ [Auth] 인증문자 발송 실패:', err);
        res.status(500).json({ error: '인증번호 발송에 실패했습니다.' });
    }
});

// [신규] 인증번호 검증 API
router.post('/verify-sms', (req, res) => {
    const { phone, code } = req.body;
    if (!phone || !code) return res.status(400).json({ error: '휴대폰 번호와 인증번호를 입력해주세요.' });

    const storedData = authCodeStore.get(phone);
    if (!storedData) return res.status(400).json({ error: '인증번호 발송 내역이 없습니다.' });

    if (Date.now() > storedData.expiresAt) {
        authCodeStore.delete(phone);
        return res.status(400).json({ error: '인증번호 유효시간(3분)이 초과되었습니다.' });
    }

    if (storedData.code !== code) {
        return res.status(400).json({ error: '인증번호가 일치하지 않습니다.' });
    }

    // 인증 성공 처리 (가입까지 30분 유예)
    authCodeStore.set(phone, { verified: true, expiresAt: Date.now() + 30 * 60 * 1000 });
    res.json({ message: '인증이 완료되었습니다.' });
});

// 1. 회원가입 API
router.post('/register', async (req, res) => {
    const { email, password, phone, name } = req.body;
    
    if (!email || !password || !phone || !name) {
        return res.status(400).json({ error: '이메일, 비밀번호, 이름, 휴대폰 번호를 모두 입력해야 합니다.' });
    }

    // 인증 완료 여부 체크
    const storedData = authCodeStore.get(phone);
    if (!storedData || !storedData.verified) {
        return res.status(400).json({ error: '휴대폰 본인 인증을 먼저 완료해주세요.' });
    }

    if (Date.now() > storedData.expiresAt) {
        authCodeStore.delete(phone);
        return res.status(400).json({ error: '인증 세션이 만료되었습니다. 다시 인증해주세요.' });
    }

    try {
        const user = await registerUser(email, password, phone, name);
        console.log(`👤 [Auth] 신규 가입 완료: ${email} (${name})`);
        res.status(201).json({ message: '회원가입이 완료되었습니다.', user });
    } catch (err) {
        console.error('❌ [Auth] 회원가입 실패:', err.message);
        res.status(500).json({ error: err.message || '회원가입에 실패했습니다.' });
    }
});

// 2. 비밀번호 재설정 API
router.post('/reset-password', async (req, res) => {
    const { email, phone, newPassword } = req.body;
    
    if (!email || !phone || !newPassword) {
        return res.status(400).json({ error: '이메일, 휴대폰 번호, 새 비밀번호를 모두 입력해야 합니다.' });
    }

    // 인증 완료 여부 체크
    const storedData = authCodeStore.get(phone);
    if (!storedData || !storedData.verified) {
        return res.status(400).json({ error: '휴대폰 본인 인증을 먼저 완료해주세요.' });
    }

    if (Date.now() > storedData.expiresAt) {
        authCodeStore.delete(phone);
        return res.status(400).json({ error: '인증 세션이 만료되었습니다. 다시 인증해주세요.' });
    }

    try {
        await resetUserPassword(email, phone, newPassword);
        console.log(`🔑 [Auth] 비밀번호 재설정 완료: ${email}`);
        
        // 사용된 인증 세션 즉시 만료
        authCodeStore.delete(phone);
        
        res.json({ message: '비밀번호가 성공적으로 변경되었습니다.' });
    } catch (err) {
        console.error('❌ [Auth] 비밀번호 재설정 실패:', err.message);
        res.status(500).json({ error: err.message || '비밀번호 변경에 실패했습니다.' });
    }
});

// 3. 로그인 API
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: '이메일과 비밀번호를 입력해주세요.' });
    }

    try {
        const result = await loginUser(email, password);
        console.log(`🔓 [Auth] 로그인 성공: ${email}`);
        res.json({ message: '로그인에 성공했습니다.', ...result });
    } catch (err) {
        console.error('❌ [Auth] 로그인 실패:', err.message);
        res.status(401).json({ error: err.message || '아이디 또는 비밀번호가 틀렸습니다.' });
    }
});

// 3. 세션 검증 API
router.get('/verify', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: '로그인 정보가 유효하지 않습니다.' });
    }
    // 간단 세션 검증 (모의 세션 또는 토큰 유효성)
    res.json({ valid: true });
});

export default router;
