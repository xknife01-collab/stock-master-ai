import express from 'express';
import supabase from '../lib/supabaseClient.js';

const router = express.Router();

// 1. 트레이딩 일지 전체 조회 (공개 성과 포함)
router.get('/', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('trading_journal')
            .select('*')
            .order('trade_date', { ascending: false })
            .limit(100);
        if (error) throw error;
        res.json(data || []);
    } catch (err) {
        console.error('❌ [Journal] 조회 실패:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// 2. 트레이딩 일지 등록
router.post('/', async (req, res) => {
    const { trade_date, stock_name, symbol, signal_type, buy_price, sell_price, quantity, ai_signal, memo } = req.body;
    const isNoTrade = signal_type === 'NOTRADE' || signal_type === 'VETO';
    
    if (!trade_date || !stock_name || 
        (!isNoTrade && (!buy_price || !quantity)) || 
        (isNoTrade && (buy_price === undefined || quantity === undefined))) {
        return res.status(400).json({ error: '필수 필드 누락' });
    }

    const finalBuyPrice = isNoTrade ? 0 : parseFloat(buy_price);
    const finalQuantity = isNoTrade ? 0 : parseInt(quantity);
    const buyTotal = finalBuyPrice * finalQuantity;
    const sellTotal = (sell_price && !isNoTrade) ? parseFloat(sell_price) * finalQuantity : null;
    const profit_amount = (sellTotal !== null && !isNoTrade) ? Math.round(sellTotal - buyTotal) : null;
    const profit_rate = (sellTotal !== null && buyTotal > 0 && !isNoTrade)
        ? parseFloat(((sellTotal - buyTotal) / buyTotal * 100).toFixed(2))
        : null;
    const status = isNoTrade ? 'closed' : (sell_price ? 'closed' : 'open');

    try {
        const { data, error } = await supabase
            .from('trading_journal')
            .insert({
                trade_date,
                stock_name,
                symbol: symbol || null,
                signal_type: signal_type || 'AI',
                buy_price: finalBuyPrice,
                sell_price: (sell_price && !isNoTrade) ? parseFloat(sell_price) : null,
                quantity: finalQuantity,
                profit_amount,
                profit_rate,
                status,
                ai_signal: ai_signal || null,
                memo: memo || null
            })
            .select()
            .single();
        if (error) throw error;
        res.status(201).json(data);
    } catch (err) {
        console.error('❌ [Journal] 등록 실패:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// 3. 매도가 업데이트 (청산 처리)
router.put('/:id/close', async (req, res) => {
    const { id } = req.params;
    const { sell_price, sell_date } = req.body;
    if (!sell_price) return res.status(400).json({ error: '매도가 필요' });

    try {
        const { data: existing, error: fetchErr } = await supabase
            .from('trading_journal')
            .select('buy_price, quantity')
            .eq('id', id)
            .single();
        if (fetchErr) throw fetchErr;

        const buyTotal = existing.buy_price * existing.quantity;
        const sellTotal = parseFloat(sell_price) * existing.quantity;
        const profit_amount = Math.round(sellTotal - buyTotal);
        const profit_rate = parseFloat(((sellTotal - buyTotal) / buyTotal * 100).toFixed(2));

        const updateFields = {
            sell_price: parseFloat(sell_price),
            profit_amount,
            profit_rate,
            status: 'closed'
        };
        if (sell_date) updateFields.sell_date = sell_date;

        const { data, error } = await supabase
            .from('trading_journal')
            .update(updateFields)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('❌ [Journal] 청산 처리 실패:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// 4-1. 거래 기록 수정 (PUT)
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { trade_date, stock_name, symbol, buy_price, quantity, sell_price, memo } = req.body;
    try {
        const buyTotal = parseFloat(buy_price) * parseInt(quantity);
        const sellTotal = sell_price && parseFloat(sell_price) > 0
            ? parseFloat(sell_price) * parseInt(quantity)
            : null;
        const profit_amount = sellTotal !== null ? Math.round(sellTotal - buyTotal) : null;
        const profit_rate = (sellTotal !== null && buyTotal > 0)
            ? parseFloat(((sellTotal - buyTotal) / buyTotal * 100).toFixed(2))
            : null;
        const status = sellTotal !== null ? 'closed' : 'open';

        const { data, error } = await supabase
            .from('trading_journal')
            .update({
                trade_date,
                stock_name,
                symbol: symbol || null,
                buy_price: parseFloat(buy_price),
                sell_price: sellTotal !== null ? parseFloat(sell_price) : null,
                quantity: parseInt(quantity),
                memo: memo || null,
                profit_amount,
                profit_rate,
                status
            })
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('❌ [Journal] 수정 실패:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// 4-2. 삭제
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const { error } = await supabase.from('trading_journal').delete().eq('id', id);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. 성과 요약 (공개 대시보드용)
router.get('/summary', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('trading_journal')
            .select('profit_amount, profit_rate, status, trade_date, quantity, signal_type')
            .eq('status', 'closed');
        if (error) throw error;

        // 실제 매수한 거래만 통계에 포함 (관망 및 VETO 차단 거래 제외)
        const closed = (data || []).filter(d => d.quantity > 0 && d.signal_type !== 'NOTRADE' && d.signal_type !== 'VETO');
        const totalTrades = closed.length;
        const winTrades = closed.filter(d => (d.profit_amount || 0) > 0).length;
        const totalProfit = closed.reduce((sum, d) => sum + (d.profit_amount || 0), 0);
        const avgRate = totalTrades > 0
            ? parseFloat((closed.reduce((sum, d) => sum + (d.profit_rate || 0), 0) / totalTrades).toFixed(2))
            : 0;
        const winRate = totalTrades > 0 ? parseFloat(((winTrades / totalTrades) * 100).toFixed(1)) : 0;

        res.json({ totalTrades, winTrades, winRate, totalProfit, avgRate });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
