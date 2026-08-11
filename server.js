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
import journalApi from './routes/journalApi.js';
import adminApi from './routes/adminApi.js';
import cron from 'node-cron';
import { executeHourlyPulse } from './routes/aiApi.js';
import { runStopLossMonitor } from './lib/marketMonitor.js';
import { startStockSync } from './lib/stockSync.js';
import { runStartupGuard, startStartupGuardDaemon } from './lib/startupGuard.js';


dotenv.config();
process.env.MOCK_GEMINI = 'false';

const app = express();
const PORT = process.env.PORT || 5000;

// --- Cron Jobs ---
// ⚠️ [Render 주의] Render 무료/기본 플랜은 요청 없을 시 Sleep 전환 → node-cron 정지됨
// 반드시 Render 대시보드 > Cron Jobs 에서 별도 /api/ai/pulse?force=true 호출을 설정할 것
// 1. 장중 시간(KST 09:10 - 15:30) 월~금요일 매 10분마다 Pulse 실행 (AI 시장 분석)
const runCronPulse = async () => {
    console.log('⏰ [Cron] 장중 시간(KST) - Pulse 자동 실행 시작...');
    try {
        await executeHourlyPulse();
        console.log('✅ [Cron] Pulse 자동 실행 완료.');
    } catch (e) {
        console.error('❌ [Cron] Pulse 자동 실행 실패:', e.message);
    }
};

import { globalStockCache, globalChartCache, globalDetailCache } from './lib/boundedCache.js';

// 장중 전 시간대 (09:10 ~ 15:30 KST) 매 10분 실행
// 09시: 10,20,30,40,50분
cron.schedule('10,20,30,40,50 9 * * 1-5', runCronPulse, { scheduled: true, timezone: "Asia/Seoul" });
// 10시~14시: 0,10,20,30,40,50분
cron.schedule('0,10,20,30,40,50 10-14 * * 1-5', runCronPulse, { scheduled: true, timezone: "Asia/Seoul" });
// 15시: 0,10,20,30분 (15:30 장마감)
cron.schedule('0,10,20,30 15 * * 1-5', runCronPulse, { scheduled: true, timezone: "Asia/Seoul" });

// 🧹 매일 자정 00:00 (KST) 메모리 대청소 크론 (Garbage Collection & Bounded Cache Purge)
cron.schedule('0 0 * * *', () => {
    console.log('🧹 [Midnight GC] 자정 백그라운드 메모리 대청소 시작...');
    const stockCleaned = globalStockCache.clear();
    const chartCleaned = globalChartCache.clear();
    const detailCleaned = globalDetailCache.clear();

    if (global.gc) {
        try {
            global.gc();
            console.log('✅ [GC] V8 가비지 컬렉션(GC) 강제 실행으로 임시 찌꺼기 메모리 회수 완료.');
        } catch (gcErr) {
            console.error('⚠️ [GC] 가비지 컬렉션 실행 중 경고:', gcErr.message);
        }
    }

    const heapMB = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
    console.log(`📊 [Memory Status] 자정 대청소 완료 (캐시 ${stockCleaned + chartCleaned + detailCleaned}개 정리). 현재 힙 사용량: ${heapMB} MB`);
}, { scheduled: true, timezone: "Asia/Seoul" });

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
app.use('/api/journal', journalApi);
app.use('/api/admin', adminApi);

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
    process.exit(1);
});

