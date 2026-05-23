import express from 'express';
import { registerUser, loginUser } from '../lib/db.js';

const router = express.Router();

// 1. 회원가입 API
router.post('/register', async (req, res) => {
    const { email, password, phone } = req.body;
    
    if (!email || !password || !phone) {
        return res.status(400).json({ error: '이메일, 비밀번호, 휴대폰 번호를 모두 입력해야 합니다.' });
    }

    try {
        const user = await registerUser(email, password, phone);
        console.log(`👤 [Auth] 신규 가입 완료: ${email}`);
        res.status(201).json({ message: '회원가입이 완료되었습니다.', user });
    } catch (err) {
        console.error('❌ [Auth] 회원가입 실패:', err.message);
        res.status(500).json({ error: err.message || '회원가입에 실패했습니다.' });
    }
});

// 2. 로그인 API
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
