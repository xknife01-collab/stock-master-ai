import express from 'express';
import fs from 'fs';
import path from 'path';
import supabase from '../lib/supabaseClient.js';
import { getAllPortfoliosForMonitoring } from '../lib/db.js';
import { sendStopLossAlert } from '../lib/notifier.js';
import { trafficManager } from '../lib/trafficManager.js';

const router = express.Router();

// 0. 방문 / 광고 시청 트래킹 API (UV & PV 분리 집계 및 Supabase 실시간 동기화)
router.post('/track-visit', (req, res) => {
    const { referrer, utmSource, userAgent, isMobile, visitorId, isAdView } = req.body;
    trafficManager.recordVisit({ referrer, utmSource, userAgent, isMobile, visitorId, isAdView });
    res.json({ success: true });
});

// 📺 0-1. 15초 동영상 광고 시청 완수 기록 API
router.post('/track-ad-view', (req, res) => {
    const { userEmail, unlockedItems, device } = req.body;
    const log = trafficManager.recordAdView({ userEmail, unlockedItems, device });
    res.json({ success: true, log });
});

// 📺 0-2. 실시간 광고 시청자 로그 목록 조회 API
router.get('/ad-view-logs', (req, res) => {
    res.json({
        success: true,
        todayAdViews: trafficManager.trafficStore.todayAdViews,
        logs: trafficManager.adViewLogs
    });
});

// 1. 유입 분석 데이터 조회 API (오늘 기준 실시간 Supabase 동기화)
router.get('/traffic', async (req, res) => {
    try {
        const traffic = await trafficManager.getTrafficSnapshot();
        res.json({
            success: true,
            traffic
        });
    } catch (err) {
        console.error('❌ Error in /traffic endpoint:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 📊 IR 피칭용 기간별 정밀 분석 API (실제 트래킹 데이터 및 Supabase 실시간 연동)
router.get('/traffic-history', async (req, res) => {
    try {
        const period = req.query.period || 'weekly';
        const data = await trafficManager.getTrafficHistory(period);
        res.json({
            success: true,
            ...data
        });
    } catch (err) {
        console.error('❌ Error in /traffic-history endpoint:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 2. 전체 회원 및 알림 대상 목록 조회 API
router.get('/users', async (req, res) => {
    try {
        let usersList = [];

        if (supabase) {
            const { data: profiles, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false });

            if (profileError) throw profileError;

            const { data: portfolios, error: portError } = await supabase
                .from('portfolios')
                .select('id, user_id, symbol, name, purchase_price, stop_loss_price, is_alerted');

            if (portError) throw portError;

            usersList = (profiles || []).map(p => {
                const userPorts = (portfolios || []).filter(item => item.user_id === p.id);
                return {
                    id: p.id,
                    email: p.email,
                    phone: p.phone || '미등록',
                    name: p.name || '무명 회원',
                    createdAt: p.created_at,
                    portfolioCount: userPorts.length,
                    portfolios: userPorts
                };
            });
        } else {
            const allPortfolios = await getAllPortfoliosForMonitoring();
            const userMap = {};
            allPortfolios.forEach(item => {
                const uId = item.userId || item.phone || 'unknown';
                if (!userMap[uId]) {
                    userMap[uId] = {
                        id: uId,
                        email: uId,
                        phone: item.phone || '미등록',
                        name: '회원 (' + uId + ')',
                        createdAt: new Date().toISOString(),
                        portfolioCount: 0,
                        portfolios: []
                    };
                }
                userMap[uId].portfolioCount++;
                userMap[uId].portfolios.push(item);
            });
            usersList = Object.values(userMap);
        }

        res.json({ success: true, users: usersList });
    } catch (err) {
        console.error('❌ [Admin API] Get users failed:', err.message);
        res.status(500).json({ error: err.message || '회원 목록을 가져오지 못했습니다.' });
    }
});

// 3. 관리자 통계 요약 API
router.get('/stats', async (req, res) => {
    try {
        let totalUsers = 0;
        let totalPortfolios = 0;
        let totalSmsLogs = 0;

        if (supabase) {
            const { count: userCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
            const { count: portCount } = await supabase.from('portfolios').select('*', { count: 'exact', head: true });
            const { count: smsCount } = await supabase.from('sms_logs').select('*', { count: 'exact', head: true });

            totalUsers = userCount || 0;
            totalPortfolios = portCount || 0;
            totalSmsLogs = smsCount || 0;
        } else {
            const ports = await getAllPortfoliosForMonitoring();
            totalPortfolios = ports.length;
            totalUsers = new Set(ports.map(p => p.userId)).size;
        }

        res.json({
            success: true,
            stats: {
                totalUsers,
                totalPortfolios,
                totalSmsLogs,
                systemStatus: '정상 작동 (Live Active)',
                lastSynced: new Date().toISOString()
            }
        });
    } catch (err) {
        console.error('❌ [Admin API] Get stats failed:', err.message);
        res.status(500).json({ error: err.message });
    }
});

const AD_CONFIG_FILE = path.join(process.cwd(), 'ad_config.json');

let inMemoryAdConfig = {
    showAds: false,
    previewDurationMinutes: 10,
    resetIntervalMinutes: 30,
    updatedAt: new Date().toISOString()
};

// Load initial config from local file if exists
try {
    if (fs.existsSync(AD_CONFIG_FILE)) {
        const savedFile = fs.readFileSync(AD_CONFIG_FILE, 'utf8');
        const parsed = JSON.parse(savedFile);
        inMemoryAdConfig = {
            ...inMemoryAdConfig,
            ...parsed,
            showAds: parsed.showAds === true || parsed.showAds === 'true'
        };
    }
} catch (e) {}

// 4. 광고 마스터 스위치 및 타이머 설정 조회/수정 API
router.get('/config', async (req, res) => {
    try {
        if (supabase) {
            const { data, error } = await supabase
                .from('admin_config')
                .select('value')
                .eq('key', 'ad_settings')
                .maybeSingle();

            if (!error && data && data.value) {
                inMemoryAdConfig = {
                    ...inMemoryAdConfig,
                    ...data.value,
                    showAds: data.value.showAds === true || data.value.showAds === 'true'
                };
            }
        }
    } catch (err) {}

    // Ensure showAds is strictly a boolean
    inMemoryAdConfig.showAds = inMemoryAdConfig.showAds === true || inMemoryAdConfig.showAds === 'true';
    res.json({ success: true, config: inMemoryAdConfig });
});

router.post('/config', async (req, res) => {
    try {
        const { showAds, previewDurationMinutes, resetIntervalMinutes } = req.body;
        const isShowAds = showAds === true || showAds === 'true';
        
        inMemoryAdConfig = {
            showAds: isShowAds,
            previewDurationMinutes: Number(previewDurationMinutes || 10),
            resetIntervalMinutes: Number(resetIntervalMinutes || 30),
            updatedAt: new Date().toISOString()
        };

        try {
            fs.writeFileSync(AD_CONFIG_FILE, JSON.stringify(inMemoryAdConfig, null, 2), 'utf8');
        } catch (fileErr) {
            console.warn('⚠️ [Admin API] Local ad_config.json save skipped:', fileErr.message);
        }

        if (supabase) {
            try {
                await supabase
                    .from('admin_config')
                    .upsert({
                        key: 'ad_settings',
                        value: inMemoryAdConfig,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'key' });
            } catch (spErr) {
                console.warn('⚠️ [Admin API] Supabase config sync skipped:', spErr.message);
            }
        }

        console.log('🎛️ [Admin API] 광고 마스터 설정 저장 성공:', inMemoryAdConfig);
        res.json({ success: true, message: '광고 마스터 설정이 성공적으로 저장되었습니다.', config: inMemoryAdConfig });
    } catch (err) {
        console.error('❌ [Admin API] Save config failed:', err.message);
        res.json({ success: true, message: '광고 설정이 저장되었습니다.', config: inMemoryAdConfig });
    }
});

// 5. SMS 손절/시황 발송 이력 및 수동 SMS 발송 API
router.get('/sms-logs', async (req, res) => {
    try {
        let logs = [];
        if (supabase) {
            const { data, error } = await supabase
                .from('sms_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50);
            if (!error && data) logs = data;
        }
        res.json({ success: true, logs });
    } catch (err) {
        res.json({ success: true, logs: [] });
    }
});

router.post('/send-sms', async (req, res) => {
    const { phone, stockName, message, type } = req.body;

    if (!phone) return res.status(400).json({ error: '수신자 휴대폰 번호가 필요합니다.' });

    try {
        console.log(`📡 [Admin SMS] 수동 SMS 발송 요청: ${phone} -> ${stockName || '긴급알림'}`);
        const success = await sendStopLossAlert(phone, stockName || '알림', 0, 0);

        if (supabase) {
            await supabase.from('sms_logs').insert({
                phone,
                stock_name: stockName || '관리자 수동알림',
                type: type || 'ADMIN_MANUAL',
                message: message || '관리자 수동 발송 메시지',
                success: !!success
            });
        }

        res.json({
            success: !!success,
            message: success ? '문자가 성공적으로 발송되었습니다.' : '문자 발송 실패 (SMS 게이트웨이 확인 필요)'
        });
    } catch (err) {
        console.error('❌ [Admin SMS Send Error]:', err.message);
        res.status(500).json({ error: err.message });
    }
});

export default router;
