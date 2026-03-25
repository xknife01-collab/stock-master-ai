import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { aiModel } from './lib/ai.js';
import stockApi from './routes/stockApi.js';
import aiApi from './routes/aiApi.js';
import newsApi from './routes/newsApi.js';
import dashboardApi, { setupDashboardApi } from './routes/dashboardApi.js';
import conditionApi, { setupConditionApi } from './routes/conditionApi.js';
import macroApi from './routes/macroApi.js';
import cron from 'node-cron';
import { executeHourlyPulse } from './routes/aiApi.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// --- Cron Jobs ---
// 1. 매 정각(00분)마다 Hourly Pulse 실행 (AI 시장 분석)
cron.schedule('0 * * * *', async () => {
    console.log('⏰ [Cron] 정각 - Hourly Pulse 자동 실행 시작...');
    try {
        await executeHourlyPulse();
        console.log('✅ [Cron] Hourly Pulse 자동 실행 완료.');
    } catch (e) {
        console.error('❌ [Cron] Hourly Pulse 자동 실행 실패:', e.message);
    }
});

// Middleware
app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Detailed Request logging for Cloud Run logs
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} ${res.statusCode} - ${duration}ms`);
    });
    next();
});

// Health check (Vital for Cloud Run availability)
app.get('/health', (req, res) => res.status(200).send('OK'));

// Routes
// 1. Stock / Detail
app.use('/api/stock', stockApi);
app.use('/api/stock-detail', stockApi); // detail is inside stockApi router

// 2. AI Signal / History
app.use('/api/ai', aiApi);

// 3. News
app.use('/api/news', newsApi);

// 3.1 Macro Indicators
app.use('/api/macro', macroApi);

// 4. Dashboard
app.use('/api/dashboard', setupDashboardApi());

// 5. Condition Search (HTS)
// App.jsx calls: /api/condition-list, /api/condition-search/:seq, /api/condition-alerts
app.use('/api', setupConditionApi(aiModel));

// Server Start
app.listen(PORT, () => {
    console.log(`🚀 Modular Stock Proxy Server running at http://localhost:${PORT}`);
}).on('error', (err) => {
    console.error('❌ Server failed to start:', err.message);
});
