import express from 'express';
import { 
    getPortfolio, 
    addPortfolioItem, 
    updateStopLoss, 
    deletePortfolioItem 
} from '../lib/db.js';

const router = express.Router();

// 1. 보유 주식 목록 조회
router.get('/', async (req, res) => {
    const { userId } = req.query;
    if (!userId) {
        return res.status(400).json({ error: '로그인된 사용자 아이디(이메일)가 필요합니다.' });
    }
    try {
        const portfolio = await getPortfolio(userId);
        res.json(portfolio);
    } catch (err) {
        console.error('❌ [Portfolio] 목록 조회 실패:', err.message);
        res.status(500).json({ error: '목록 조회에 실패했습니다.' });
    }
});

// 2. 보유 주식 등록
router.post('/', async (req, res) => {
    const { userId, symbol, name, purchasePrice, stopLossPrice } = req.body;
    if (!userId || !symbol || !name || !purchasePrice || !stopLossPrice) {
        return res.status(400).json({ error: '필수 등록 필드가 누락되었습니다.' });
    }
    try {
        const item = await addPortfolioItem(userId, symbol, name, purchasePrice, stopLossPrice);
        console.log(`📈 [Portfolio] 종목 등록 완료: ${name}(${symbol}) for ${userId}`);
        res.status(201).json(item);
    } catch (err) {
        console.error('❌ [Portfolio] 종목 등록 실패:', err.message);
        res.status(500).json({ error: '종목 등록에 실패했습니다.' });
    }
});

// 3. 손절가 수정
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { stopLossPrice } = req.body;
    if (stopLossPrice === undefined || isNaN(Number(stopLossPrice))) {
        return res.status(400).json({ error: '올바른 손절가 금액을 입력하세요.' });
    }
    try {
        const updated = await updateStopLoss(id, stopLossPrice);
        console.log(`🔧 [Portfolio] 손절가 변경 완료: ID ${id} -> ₩${stopLossPrice}`);
        res.json(updated);
    } catch (err) {
        console.error('❌ [Portfolio] 손절가 변경 실패:', err.message);
        res.status(500).json({ error: err.message || '손절가 변경에 실패했습니다.' });
    }
});

// 4. 종목 삭제
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await deletePortfolioItem(id);
        console.log(`🗑️ [Portfolio] 종목 삭제 완료: ID ${id}`);
        res.json({ success: true, message: '종목이 포트폴리오에서 제거되었습니다.' });
    } catch (err) {
        console.error('❌ [Portfolio] 종목 삭제 실패:', err.message);
        res.status(500).json({ error: '종목 삭제에 실패했습니다.' });
    }
});

export default router;
