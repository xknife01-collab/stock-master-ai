import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { aiModel } from './lib/ai.js';
import stockApi from './routes/stockApi.js';
import aiApi from './routes/aiApi.js';
import newsApi from './routes/newsApi.js';
import dashboardApi, { setupDashboardApi, startDashboardSync } from './routes/dashboardApi.js';
import conditionApi, { setupConditionApi } from './routes/conditionApi.js';
import macroApi from './routes/macroApi.js';
import authApi from './routes/authApi.js';
import portfolioApi from './routes/portfolioApi.js';
import cron from 'node-cron';
import { executeHourlyPulse } from './routes/aiApi.js';
import { runStopLossMonitor } from './lib/marketMonitor.js';
import { startStockSync } from './lib/stockSync.js';
import { runStartupGuard, startStartupGuardDaemon } from './lib/startupGuard.js';


dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// --- Cron Jobs ---
// 1. 장중 시간(KST 09:00 - 15:50) 월~금요일 매 10분마다 Pulse 실행 (AI 시장 분석)
// 서버의 로컬 타임존 설정에 영향을 받지 않도록 Asia/Seoul 타임존을 명시적으로 지정하여 스케줄링합니다.
cron.schedule('*/10 9-15 * * 1-5', async () => {
    console.log('⏰ [Cron] 장중 시간(KST) - Pulse 자동 실행 시작...');
    try {
        await executeHourlyPulse();
        console.log('✅ [Cron] Pulse 자동 실행 완료.');
    } catch (e) {
        console.error('❌ [Cron] Pulse 자동 실행 실패:', e.message);
    }
}, {
    scheduled: true,
    timezone: "Asia/Seoul"
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

// 6. User Authentication & Portfolios
app.use('/api/auth', authApi);
app.use('/api/portfolio', portfolioApi);

// 7. 실시간 손절 감시 타이머 시작 (30초 간격)
setInterval(runStopLossMonitor, 30000);
// 서버 시작 후 5초 뒤 최초 1회 실행
setTimeout(runStopLossMonitor, 5000);

// Server Start
app.listen(PORT, async () => {
    console.log(`🚀 Modular Stock Proxy Server running at http://localhost:${PORT}`);
    
    // 1. 백그라운드 대시보드 실시간 동기화 데몬 가동 (캐시 즉시 로드 및 동기화 시작)
    try {
        startDashboardSync();
    } catch (dbSyncErr) {
        console.error('❌ Failed to start dashboard background sync:', dbSyncErr.message);
    }

    // 2. 백그라운드 실시간 KIS 캐시 동기화 엔진 가동
    try {
        startStockSync();
    } catch (syncErr) {
        console.error('❌ Failed to start stock background sync:', syncErr.message);
    }

    // 3. KIS API 규격 및 정합성 자가진단(Startup Guard) 실행 (비차단 비동기 실행)
    console.log('🛡️ [Startup Guard] Initiating KIS API and Data Integrity self-test in background...');
    runStartupGuard()
        .then(() => {
            startStartupGuardDaemon();
        })
        .catch(err => {
            console.error('❌ Startup Guard self-test failed:', err.message);
        });
}).on('error', (err) => {
    console.error('❌ Server failed to start:', err.message);
});

