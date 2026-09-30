import fs from 'fs';
import path from 'path';
import supabase from './supabaseClient.js';

const TRAFFIC_FILE = path.join(process.cwd(), 'traffic_history.json');

const defaultReferrers = () => ({
    '유튜브 (Shorts/채널)': 0,
    '인스타그램 (Instagram)': 0,
    '티스토리 (Tstory)': 0,
    '페이스북 (Facebook)': 0,
    '틱톡 (TikTok)': 0,
    '네이버 (검색/블로그)': 0,
    '구글 (Google Search)': 0,
    '카카오톡 / 오픈채팅': 0,
    '직접 방문 (Direct / 북마크)': 0,
    '기타 타사이트': 0
});

const defaultDevices = () => ({
    '모바일 PWA (Mobile)': 0,
    '데스크톱 PC (Desktop)': 0
});

const getKSTDateString = (dateObj = new Date()) => {
    const utc = dateObj.getTime() + (dateObj.getTimezoneOffset() * 60000);
    const kstDate = new Date(utc + (9 * 60 * 60 * 1000));
    const yyyy = kstDate.getFullYear();
    const mm = String(kstDate.getMonth() + 1).padStart(2, '0');
    const dd = String(kstDate.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

const getKSTHour = (dateObj = new Date()) => {
    const utc = dateObj.getTime() + (dateObj.getTimezoneOffset() * 60000);
    const kstDate = new Date(utc + (9 * 60 * 60 * 1000));
    return kstDate.getHours();
};

class TrafficManager {
    constructor() {
        this.trafficHistoryStore = this.loadLocalStore();
        this.todayKey = getKSTDateString();
        this.todayHist = this.trafficHistoryStore[this.todayKey] || {};
        this.trafficStore = {
            date: this.todayKey,
            todayPV: this.todayHist.pv || 0,
            todayUV: this.todayHist.uv || (this.todayHist.visitorIds ? this.todayHist.visitorIds.length : (this.todayHist.pv > 0 ? 1 : 0)),
            visitorIds: new Set(this.todayHist.visitorIds || []),
            todayAdViews: this.todayHist.adViews || 0,
            referrers: this.todayHist.referrers ? { ...defaultReferrers(), ...this.todayHist.referrers } : defaultReferrers(),
            devices: this.todayHist.devices ? { ...defaultDevices(), ...this.todayHist.devices } : defaultDevices(),
            hourly: this.todayHist.hourly || Array(24).fill(0)
        };
        this.adViewLogs = [];

        // 초기 Supabase 연동
        this.syncFromSupabase();
    }

    loadLocalStore() {
        try {
            if (fs.existsSync(TRAFFIC_FILE)) {
                return JSON.parse(fs.readFileSync(TRAFFIC_FILE, 'utf8'));
            }
        } catch (e) {
            console.warn('⚠️ [TrafficManager] Could not load local traffic_history.json:', e.message);
        }
        return {};
    }

    saveLocalStore() {
        try {
            const serialized = {};
            for (const [k, v] of Object.entries(this.trafficHistoryStore)) {
                serialized[k] = {
                    ...v,
                    visitorIds: Array.isArray(v.visitorIds) ? v.visitorIds : (v.visitorIds instanceof Set ? Array.from(v.visitorIds) : [])
                };
            }
            fs.writeFileSync(TRAFFIC_FILE, JSON.stringify(serialized, null, 2), 'utf8');
        } catch (e) {
            console.error('❌ [TrafficManager] Failed saving traffic_history.json:', e.message);
        }
    }

    async syncFromSupabase() {
        if (!supabase) return;
        try {
            const { data, error } = await supabase
                .from('stock_master_map')
                .select('code')
                .eq('name', '__traffic_history__')
                .maybeSingle();

            if (data && data.code) {
                const cloudStore = JSON.parse(data.code);
                // Merge cloud store with local store
                for (const [k, v] of Object.entries(cloudStore)) {
                    if (!this.trafficHistoryStore[k] || (v.pv || 0) >= (this.trafficHistoryStore[k].pv || 0)) {
                        this.trafficHistoryStore[k] = {
                            ...v,
                            visitorIds: v.visitorIds || []
                        };
                    }
                }
                const currentToday = this.trafficHistoryStore[this.todayKey];
                if (currentToday) {
                    this.trafficStore.todayPV = Math.max(this.trafficStore.todayPV, currentToday.pv || 0);
                    if (currentToday.visitorIds && Array.isArray(currentToday.visitorIds)) {
                        currentToday.visitorIds.forEach(id => this.trafficStore.visitorIds.add(id));
                    }
                    this.trafficStore.todayUV = Math.max(this.trafficStore.visitorIds.size, currentToday.uv || (this.trafficStore.todayPV > 0 ? 1 : 0));
                    this.trafficStore.todayAdViews = Math.max(this.trafficStore.todayAdViews, currentToday.adViews || 0);
                    if (currentToday.referrers) {
                        this.trafficStore.referrers = { ...defaultReferrers(), ...currentToday.referrers };
                    }
                    if (currentToday.devices) {
                        this.trafficStore.devices = { ...defaultDevices(), ...currentToday.devices };
                    }
                    if (currentToday.hourly) {
                        this.trafficStore.hourly = [...currentToday.hourly];
                    }
                }
                console.log('⚡ [TrafficManager] Supabase 최신 트래픽 동기화 완료.');
            }
        } catch (err) {
            console.warn('⚠️ [TrafficManager] Supabase syncFromSupabase error:', err.message);
        }
    }

    resetTrafficIfNeeded() {
        const today = getKSTDateString();
        if (this.trafficStore.date !== today) {
            this.syncTodayHistory();
            this.todayKey = today;
            this.trafficStore.date = today;
            const existing = this.trafficHistoryStore[today] || {};
            this.trafficStore.todayPV = existing.pv || 0;
            this.trafficStore.visitorIds = new Set(existing.visitorIds || []);
            this.trafficStore.todayUV = this.trafficStore.visitorIds.size || existing.uv || 0;
            this.trafficStore.todayAdViews = existing.adViews || 0;
            this.trafficStore.referrers = existing.referrers ? { ...existing.referrers } : defaultReferrers();
            this.trafficStore.devices = existing.devices ? { ...existing.devices } : defaultDevices();
            this.trafficStore.hourly = existing.hourly ? [...existing.hourly] : Array(24).fill(0);
        }
    }

    async syncTodayHistory() {
        try {
            const today = this.trafficStore.date || getKSTDateString();
            const devices = this.trafficStore.devices || defaultDevices();
            const referrers = this.trafficStore.referrers || defaultReferrers();
            const hourly = Array.isArray(this.trafficStore.hourly) ? this.trafficStore.hourly : Array(24).fill(0);
            const todayPV = this.trafficStore.todayPV || 0;
            const visitorIdsArr = Array.from(this.trafficStore.visitorIds || []);
            const todayUV = Math.max(visitorIdsArr.length, this.trafficStore.todayUV || (todayPV > 0 ? 1 : 0));
            const todayAdViews = this.trafficStore.todayAdViews || 0;

            this.trafficHistoryStore[today] = {
                date: today,
                pv: todayPV,
                uv: todayUV,
                visitorIds: visitorIdsArr,
                adViews: todayAdViews,
                dau: todayUV,
                referrers: { ...referrers },
                devices: { ...devices },
                hourly: [...hourly]
            };

            this.saveLocalStore();

            if (supabase) {
                const serialized = {};
                for (const [k, v] of Object.entries(this.trafficHistoryStore)) {
                    serialized[k] = {
                        ...v,
                        visitorIds: Array.isArray(v.visitorIds) ? v.visitorIds : (v.visitorIds instanceof Set ? Array.from(v.visitorIds) : [])
                    };
                }
                supabase.from('stock_master_map')
                    .upsert({ name: '__traffic_history__', code: JSON.stringify(serialized) }, { onConflict: 'name' })
                    .then(({ error }) => {
                        if (error) console.error('❌ Supabase traffic sync error:', error.message);
                    })
                    .catch(err => console.error('❌ Supabase traffic sync catch:', err.message));
            }
        } catch (err) {
            console.error('❌ Error in syncTodayHistory:', err.message);
        }
    }

    recordVisit({ referrer, utmSource, userAgent, isMobile, visitorId, isAdView }) {
        this.resetTrafficIfNeeded();
        const currentHour = getKSTHour();

        if (isAdView) {
            this.trafficStore.todayAdViews++;
        } else {
            this.trafficStore.todayPV++;
            this.trafficStore.hourly[currentHour]++;

            // UV (Unique Visitor) Deduplication
            if (visitorId) {
                this.trafficStore.visitorIds.add(visitorId);
            }
            this.trafficStore.todayUV = Math.max(this.trafficStore.visitorIds.size, this.trafficStore.todayPV > 0 ? 1 : 0);

            // 기기 구분
            if (isMobile) {
                this.trafficStore.devices['모바일 PWA (Mobile)']++;
            } else {
                this.trafficStore.devices['데스크톱 PC (Desktop)']++;
            }

            // Referrer Parsing
            const ref = (referrer || '').toLowerCase();
            const utm = (utmSource || '').toLowerCase();
            const ua = (userAgent || '').toLowerCase();

            if (utm.includes('youtube') || utm.includes('shorts') || ref.includes('youtube.com') || ref.includes('youtu.be')) {
                this.trafficStore.referrers['유튜브 (Shorts/채널)']++;
            } else if (utm.includes('instagram') || utm.includes('insta') || utm.includes('ig') || ref.includes('instagram.com') || ref.includes('ig.me') || ua.includes('instagram')) {
                this.trafficStore.referrers['인스타그램 (Instagram)']++;
            } else if (utm.includes('facebook') || utm.includes('fb') || ref.includes('facebook.com') || ref.includes('fb.com') || ref.includes('m.facebook.com') || ua.includes('fb_iab') || ua.includes('fban') || ua.includes('fbav')) {
                this.trafficStore.referrers['페이스북 (Facebook)']++;
            } else if (utm.includes('tiktok') || ref.includes('tiktok.com') || ua.includes('tiktok')) {
                this.trafficStore.referrers['틱톡 (TikTok)']++;
            } else if (utm.includes('tstory') || utm.includes('tistory') || ref.includes('tistory.com') || ref.includes('tstory.com') || ref.includes('daum.net') || utm.includes('daum')) {
                this.trafficStore.referrers['티스토리 (Tstory)']++;
            } else if (utm.includes('naver') || utm.includes('blog.naver') || ref.includes('naver.com') || ref.includes('blog.naver.com') || ref.includes('m.blog.naver.com') || ua.includes('naver')) {
                this.trafficStore.referrers['네이버 (검색/블로그)']++;
            } else if (utm.includes('google') || ref.includes('google.com') || ref.includes('google.co.kr')) {
                this.trafficStore.referrers['구글 (Google Search)']++;
            } else if (utm.includes('kakao') || utm.includes('kakaotalk') || ref.includes('kakao.com') || ref.includes('kakaotalk') || ua.includes('kakaotalk')) {
                this.trafficStore.referrers['카카오톡 / 오픈채팅']++;
            } else if (!ref || ref === 'direct' || ref.includes('stockmaster-ai.vercel.app') || ref.includes('localhost')) {
                this.trafficStore.referrers['직접 방문 (Direct / 북마크)']++;
            } else {
                this.trafficStore.referrers['기타 타사이트']++;
            }
        }

        this.syncTodayHistory();
    }

    recordAdView({ userEmail, unlockedItems, device }) {
        this.resetTrafficIfNeeded();
        this.trafficStore.todayAdViews++;

        const logEntry = {
            id: `ad_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            createdAt: new Date().toISOString(),
            userEmail: userEmail || '손님 (Guest/비회원)',
            unlockedItems: unlockedItems || 'AI 1위, 2위 TOP PICK 종목 (30분 해금)',
            adDuration: '15초 완료',
            status: '✅ 시청 완수',
            device: device || 'Mobile PWA'
        };

        this.adViewLogs.unshift(logEntry);
        if (this.adViewLogs.length > 100) this.adViewLogs.pop();

        this.syncTodayHistory();
        return logEntry;
    }

    async getTrafficSnapshot() {
        await this.syncFromSupabase();
        this.resetTrafficIfNeeded();

        const todayPV = this.trafficStore.todayPV || 0;
        const todayUV = Math.max(this.trafficStore.visitorIds.size, this.trafficStore.todayUV || (todayPV > 0 ? 1 : 0));
        const totalPV = Math.max(1, todayPV);
        const devices = this.trafficStore.devices || defaultDevices();
        const referrers = this.trafficStore.referrers || defaultReferrers();
        const totalDev = Math.max(1, Object.values(devices).reduce((a, b) => a + b, 0));

        const referrerBreakdown = Object.entries(referrers).map(([source, count]) => ({
            source,
            count: count || 0,
            percent: Math.round(((count || 0) / totalPV) * 100)
        })).sort((a, b) => b.count - a.count);

        const deviceBreakdown = Object.entries(devices).map(([device, count]) => ({
            device,
            count: count || 0,
            percent: Math.round(((count || 0) / totalDev) * 100)
        }));

        return {
            date: this.trafficStore.date || getKSTDateString(),
            todayPV,
            todayUV,
            todayAdViews: this.trafficStore.todayAdViews || 0,
            referrerBreakdown,
            deviceBreakdown,
            hourlyHits: this.trafficStore.hourly || Array(24).fill(0)
        };
    }

    async getTrafficHistory(period = 'weekly') {
        await this.syncFromSupabase();
        this.resetTrafficIfNeeded();

        const kstNowString = getKSTDateString();
        const [currY, currM, currD] = kstNowString.split('-').map(Number);
        const now = new Date(currY, currM - 1, currD);

        // 지난 7일 (Weekly)
        const weeklyData = [];
        const weeklyReferrers = defaultReferrers();
        let weeklyUVSet = new Set();

        for (let i = 6; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(now.getDate() - i);
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            const dateKey = `${yyyy}-${mm}-${dd}`;
            const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;

            const rec = (dateKey === this.trafficStore.date)
                ? {
                    pv: this.trafficStore.todayPV,
                    uv: Math.max(this.trafficStore.visitorIds.size, this.trafficStore.todayUV || (this.trafficStore.todayPV > 0 ? 1 : 0)),
                    visitorIds: Array.from(this.trafficStore.visitorIds),
                    adViews: this.trafficStore.todayAdViews,
                    referrers: this.trafficStore.referrers
                }
                : (this.trafficHistoryStore[dateKey] || { pv: 0, uv: 0, visitorIds: [], adViews: 0, referrers: {} });

            if (rec.referrers) {
                Object.entries(rec.referrers).forEach(([k, v]) => {
                    if (weeklyReferrers[k] !== undefined) weeklyReferrers[k] += (v || 0);
                });
            }

            if (rec.visitorIds && Array.isArray(rec.visitorIds)) {
                rec.visitorIds.forEach(id => weeklyUVSet.add(id));
            }

            const dayPV = rec.pv || 0;
            const dayUV = rec.uv || (rec.visitorIds ? rec.visitorIds.length : (dayPV > 0 ? 1 : 0));

            weeklyData.push({
                date: dateStr,
                pv: dayPV,
                uv: dayUV,
                adViews: rec.adViews || 0,
                dau: dayUV
            });
        }

        // 지난 30일 (Monthly)
        const monthlyData = [];
        const monthlyReferrers = defaultReferrers();
        let monthlyUVSet = new Set();

        for (let i = 29; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(now.getDate() - i);
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            const dateKey = `${yyyy}-${mm}-${dd}`;
            const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;

            const rec = (dateKey === this.trafficStore.date)
                ? {
                    pv: this.trafficStore.todayPV,
                    uv: Math.max(this.trafficStore.visitorIds.size, this.trafficStore.todayUV || (this.trafficStore.todayPV > 0 ? 1 : 0)),
                    visitorIds: Array.from(this.trafficStore.visitorIds),
                    adViews: this.trafficStore.todayAdViews,
                    referrers: this.trafficStore.referrers
                }
                : (this.trafficHistoryStore[dateKey] || { pv: 0, uv: 0, visitorIds: [], adViews: 0, referrers: {} });

            if (rec.referrers) {
                Object.entries(rec.referrers).forEach(([k, v]) => {
                    if (monthlyReferrers[k] !== undefined) monthlyReferrers[k] += (v || 0);
                });
            }

            if (rec.visitorIds && Array.isArray(rec.visitorIds)) {
                rec.visitorIds.forEach(id => monthlyUVSet.add(id));
            }

            const dayPV = rec.pv || 0;
            const dayUV = rec.uv || (rec.visitorIds ? rec.visitorIds.length : (dayPV > 0 ? 1 : 0));

            monthlyData.push({
                date: dateStr,
                pv: dayPV,
                uv: dayUV,
                adViews: rec.adViews || 0,
                dau: dayUV
            });
        }

        // 연도별/월별 (Yearly)
        const yearlyData = [];
        const yearlyReferrers = defaultReferrers();

        for (let m = 1; m <= 12; m++) {
            const monthPrefix = `${currY}-${String(m).padStart(2, '0')}`;
            let monthPV = 0;
            let monthUVSet = new Set();
            let monthAdViews = 0;

            Object.entries(this.trafficHistoryStore).forEach(([dKey, item]) => {
                if (dKey.startsWith(monthPrefix)) {
                    monthPV += (item.pv || 0);
                    monthAdViews += (item.adViews || 0);
                    if (item.visitorIds && Array.isArray(item.visitorIds)) {
                        item.visitorIds.forEach(id => monthUVSet.add(id));
                    }
                    if (item.referrers) {
                        Object.entries(item.referrers).forEach(([rk, rv]) => {
                            if (yearlyReferrers[rk] !== undefined) yearlyReferrers[rk] += (rv || 0);
                        });
                    }
                }
            });

            if (this.trafficStore.date.startsWith(monthPrefix) && !this.trafficHistoryStore[this.trafficStore.date]) {
                monthPV += this.trafficStore.todayPV;
                monthAdViews += this.trafficStore.todayAdViews;
                this.trafficStore.visitorIds.forEach(id => monthUVSet.add(id));
                Object.entries(this.trafficStore.referrers).forEach(([rk, rv]) => {
                    if (yearlyReferrers[rk] !== undefined) yearlyReferrers[rk] += (rv || 0);
                });
            }

            const isCurrentMonth = m === currM;
            const monthUV = Math.max(monthUVSet.size, monthPV > 0 ? Math.max(1, Math.floor(monthPV * 0.7)) : 0);

            yearlyData.push({
                month: `${m}월${isCurrentMonth ? ' (현재)' : ''}`,
                mau: monthUV,
                pv: monthPV,
                uv: monthUV,
                adViews: monthAdViews,
                revenue: `$${(monthAdViews * 0.045).toFixed(2)}`
            });
        }

        const monthlySumPV = monthlyData.reduce((sum, item) => sum + item.pv, 0);
        const monthlySumUV = Math.max(monthlyUVSet.size, monthlyData.reduce((sum, item) => sum + item.uv, 0));
        const weeklySumPV = weeklyData.reduce((sum, item) => sum + item.pv, 0);
        const weeklySumUV = Math.max(weeklyUVSet.size, weeklyData.reduce((sum, item) => sum + item.uv, 0));

        let activeReferrers = this.trafficStore.referrers;
        if (period === 'weekly') activeReferrers = weeklyReferrers;
        else if (period === 'monthly') activeReferrers = monthlyReferrers;
        else if (period === 'yearly') activeReferrers = yearlyReferrers;

        const totalPeriodPV = Math.max(1, Object.values(activeReferrers).reduce((a, b) => a + b, 0));
        const referrerBreakdown = Object.entries(activeReferrers).map(([source, count]) => ({
            source,
            count,
            percent: Math.round((count / totalPeriodPV) * 100)
        })).sort((a, b) => b.count - a.count);

        const todayPV = this.trafficStore.todayPV;
        const todayUV = Math.max(this.trafficStore.visitorIds.size, this.trafficStore.todayUV || (todayPV > 0 ? 1 : 0));

        return {
            period,
            summary: {
                todayPV,
                todayUV,
                todayAdViews: this.trafficStore.todayAdViews,
                weeklyTotalPV: weeklySumPV,
                weeklyTotalUV: weeklySumUV,
                monthlyTotalPV: monthlySumPV,
                monthlyTotalUV: monthlySumUV,
                yearlyMAU: Math.max(1, monthlySumUV || Math.floor(monthlySumPV * 0.7)),
                retentionRate: '100%'
            },
            weeklyData,
            monthlyData,
            yearlyData,
            referrerBreakdown
        };
    }
}

export const trafficManager = new TrafficManager();
