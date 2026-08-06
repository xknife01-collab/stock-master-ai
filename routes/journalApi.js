import express from 'express';
import supabase from '../lib/supabaseClient.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const JOURNAL_STORE_PATH = path.join(__dirname, '../trading_journal.json');

const router = express.Router();

const defaultEntries = [
  {
    id: 'journal-default-1',
    trade_date: '2026-06-24',
    stock_name: '삼성전자',
    symbol: '005930',
    signal_type: 'AI',
    buy_price: 334416,
    sell_price: 358500,
    sell_date: '2026-06-25',
    quantity: 6,
    profit_amount: 144504,
    profit_rate: 7.2,
    status: 'closed',
    memo: '24일 오전 9시30분경 ai 추천 및 계량 전광판 및 실시간 리스크 센터 참조'
  }
];

function loadLocalJournal() {
  try {
    if (fs.existsSync(JOURNAL_STORE_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(JOURNAL_STORE_PATH, 'utf8'));
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {}
  saveLocalJournal(defaultEntries);
  return defaultEntries;
}

function saveLocalJournal(data) {
  try {
    fs.writeFileSync(JOURNAL_STORE_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {}
}

// 1. 트레이딩 일지 전체 조회
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('trading_journal')
      .select('*')
      .order('trade_date', { ascending: false })
      .limit(100);
    if (error || !data || data.length === 0) {
      return res.json(loadLocalJournal());
    }
    res.json(data);
  } catch (err) {
    res.json(loadLocalJournal());
  }
});

// 2. 트레이딩 일지 등록
router.post('/', async (req, res) => {
  const { trade_date, stock_name, symbol, signal_type, buy_price, sell_price, sell_date, quantity, ai_signal, memo } = req.body;
  const isNoTrade = signal_type === 'NOTRADE' || signal_type === 'VETO';
  
  if (!trade_date || !stock_name) {
    return res.status(400).json({ error: '필수 필드(일자, 종목명) 누락' });
  }

  const finalBuyPrice = isNoTrade ? 0 : parseFloat(buy_price || 0);
  const finalQuantity = isNoTrade ? 0 : parseInt(quantity || 1);
  const buyTotal = finalBuyPrice * finalQuantity;
  const sellTotal = (sell_price && !isNoTrade) ? parseFloat(sell_price) * finalQuantity : null;
  const profit_amount = (sellTotal !== null && !isNoTrade) ? Math.round(sellTotal - buyTotal) : null;
  const profit_rate = (sellTotal !== null && buyTotal > 0 && !isNoTrade)
    ? parseFloat(((sellTotal - buyTotal) / buyTotal * 100).toFixed(2))
    : null;
  const status = isNoTrade ? 'closed' : (sell_price ? 'closed' : 'open');

  const newEntry = {
    id: `journal-${Date.now()}`,
    trade_date,
    stock_name,
    symbol: symbol || '',
    signal_type: signal_type || 'AI',
    buy_price: finalBuyPrice,
    sell_price: (sell_price && !isNoTrade) ? parseFloat(sell_price) : null,
    sell_date: (sell_price && sell_date && sell_date.trim() !== '' && !isNoTrade) ? sell_date : null,
    quantity: finalQuantity,
    profit_amount,
    profit_rate,
    status,
    ai_signal: ai_signal || null,
    memo: memo || ''
  };

  // Try Supabase first
  try {
    const { data, error } = await supabase
      .from('trading_journal')
      .insert(newEntry)
      .select()
      .single();
    if (!error && data) {
      const local = loadLocalJournal();
      local.unshift(data);
      saveLocalJournal(local);
      return res.status(201).json(data);
    }
  } catch (err) {}

  // Fallback local
  const local = loadLocalJournal();
  local.unshift(newEntry);
  saveLocalJournal(local);
  res.status(201).json(newEntry);
});

// 3. 매도가 업데이트 (청산 처리)
router.put('/:id/close', async (req, res) => {
  const { id } = req.params;
  const { sell_price, sell_date } = req.body;
  if (!sell_price) return res.status(400).json({ error: '매도가 필요' });

  // Update Local Store
  const local = loadLocalJournal();
  const index = local.findIndex(item => String(item.id) === String(id));
  if (index !== -1) {
    const existing = local[index];
    const buyTotal = (existing.buy_price || 0) * (existing.quantity || 1);
    const sellTotal = parseFloat(sell_price) * (existing.quantity || 1);
    const profit_amount = Math.round(sellTotal - buyTotal);
    const profit_rate = buyTotal > 0 ? parseFloat(((sellTotal - buyTotal) / buyTotal * 100).toFixed(2)) : 0;

    local[index] = {
      ...existing,
      sell_price: parseFloat(sell_price),
      sell_date: sell_date || new Date().toISOString().slice(0, 10),
      profit_amount,
      profit_rate,
      status: 'closed'
    };
    saveLocalJournal(local);
    return res.json(local[index]);
  }

  res.status(404).json({ error: '항목을 찾을 수 없습니다.' });
});

// 4. 거래 기록 전체 수정 (PUT)
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { trade_date, stock_name, symbol, signal_type, buy_price, quantity, sell_price, sell_date, memo } = req.body;
  const isNoTrade = signal_type === 'NOTRADE' || signal_type === 'VETO';
  
  const finalBuyPrice = isNoTrade ? 0 : parseFloat(buy_price || 0);
  const finalQuantity = isNoTrade ? 0 : parseInt(quantity || 1);
  const buyTotal = finalBuyPrice * finalQuantity;
  const sellTotal = (sell_price && !isNoTrade) ? parseFloat(sell_price) * finalQuantity : null;
  const profit_amount = (sellTotal !== null && !isNoTrade) ? Math.round(sellTotal - buyTotal) : null;
  const profit_rate = (sellTotal !== null && buyTotal > 0 && !isNoTrade)
    ? parseFloat(((sellTotal - buyTotal) / buyTotal * 100).toFixed(2))
    : null;
  const status = isNoTrade ? 'closed' : (sell_price ? 'closed' : 'open');

  const updatedItem = {
    id,
    trade_date,
    stock_name,
    symbol: symbol || '',
    signal_type: signal_type || 'AI',
    buy_price: finalBuyPrice,
    sell_price: (sell_price && !isNoTrade) ? parseFloat(sell_price) : null,
    sell_date: (sell_price && sell_date && sell_date.trim() !== '' && !isNoTrade) ? sell_date : null,
    quantity: finalQuantity,
    profit_amount,
    profit_rate,
    status,
    memo: memo || ''
  };

  const local = loadLocalJournal();
  const index = local.findIndex(item => String(item.id) === String(id));
  if (index !== -1) {
    local[index] = { ...local[index], ...updatedItem };
    saveLocalJournal(local);
    return res.json(local[index]);
  }

  res.status(404).json({ error: '항목을 찾을 수 없습니다.' });
});

// 5. 삭제 (DELETE)
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const local = loadLocalJournal();
  const filtered = local.filter(item => String(item.id) !== String(id));
  saveLocalJournal(filtered);
  res.json({ success: true });
});

// 6. 성과 요약 (Summary)
router.get('/summary', async (req, res) => {
  const local = loadLocalJournal();
  const closed = local.filter(d => d.status === 'closed' && (d.quantity || 0) > 0 && d.signal_type !== 'NOTRADE' && d.signal_type !== 'VETO');
  const totalTrades = closed.length;
  const winTrades = closed.filter(d => (d.profit_amount || 0) > 0).length;
  const totalProfit = closed.reduce((sum, d) => sum + (d.profit_amount || 0), 0);
  const avgRate = totalTrades > 0
    ? parseFloat((closed.reduce((sum, d) => sum + (d.profit_rate || 0), 0) / totalTrades).toFixed(2))
    : 0;
  const winRate = totalTrades > 0 ? parseFloat(((winTrades / totalTrades) * 100).toFixed(1)) : 0;

  res.json({ totalTrades, winTrades, winRate, totalProfit, avgRate });
});

export default router;
