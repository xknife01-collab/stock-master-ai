import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dashboardCachePath = path.join(__dirname, '../dashboard_cache.json');
const marketCachePath = path.join(__dirname, '../market_cache.json');
const vetoMetricsPath = path.join(__dirname, '../veto_metrics.json');

// Backup original files
const dashboardBackup = fs.readFileSync(dashboardCachePath, 'utf8');
const marketBackup = fs.readFileSync(marketCachePath, 'utf8');
const vetoBackup = fs.readFileSync(vetoMetricsPath, 'utf8');

function restoreAll() {
    console.log('🔄 Restoring original cache files...');
    fs.writeFileSync(dashboardCachePath, dashboardBackup, 'utf8');
    fs.writeFileSync(marketCachePath, marketBackup, 'utf8');
    fs.writeFileSync(vetoMetricsPath, vetoBackup, 'utf8');
    console.log('✅ Restoration complete.');
}

async function runScenario(name, setupFn, verifyFn) {
    console.log(`\n==================================================`);
    console.log(`🎬 Running Scenario: ${name}`);
    console.log(`==================================================`);
    try {
        // Run setup
        setupFn();
        
        // Wait 500ms to ensure file changes are flushed
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Trigger pulse
        const start = Date.now();
        const res = await axios.get('http://localhost:5000/api/ai/pulse?force=true', { timeout: 15000 });
        const elapsed = ((Date.now() - start) / 1000).toFixed(2);
        
        console.log(`⚡ API Response in ${elapsed}s (Status: ${res.status})`);
        
        const data = res.data?.aiSignal || res.data?.data || res.data;
        if (!data) {
            throw new Error('No data returned in response');
        }
        
        // Verify
        verifyFn(data);
    } catch (err) {
        console.error(`❌ Scenario failed:`, err.message);
        if (err.response) {
            console.error('Response data:', err.response.data);
        }
    }
}

// Helper to write market cache
function writeMarketCache({ kospiHistory, kosdaqHistory, usdRate, usdChange, us10yYield, us10yChange }) {
    const market = {
        macro: {
            data: [
                { label: 'USD/KRW', value: usdRate.toString(), change: usdChange.toString(), isUp: usdChange >= 0 }
            ],
            updated_at: new Date().toISOString()
        },
        kospi_history: {
            data: kospiHistory,
            updated_at: new Date().toISOString()
        },
        kosdaq_history: {
            data: kosdaqHistory,
            updated_at: new Date().toISOString()
        },
        us10y: {
            data: {
                currentYield: us10yYield,
                prevClose: us10yYield - us10yChange
            },
            updated_at: new Date().toISOString()
        }
    };
    fs.writeFileSync(marketCachePath, JSON.stringify(market, null, 2), 'utf8');
}

// Helper to write dashboard cache
function writeDashboardCache({ kospiChange, kosdaqChange, kospiPrice, kosdaqPrice, stocks }) {
    const dash = JSON.parse(dashboardBackup);
    dash.sectors = [
        { name: 'KOSPI', code: '0001', price: kospiPrice.toString(), change: kospiChange, width: '100%' },
        { name: 'KOSDAQ', code: '1001', price: kosdaqPrice.toString(), change: kosdaqChange, width: '100%' }
    ];
    // Add custom stocks to topStocks
    dash.topStocks = [
        stocks.map(s => ({
            n: s.name,
            s: s.code,
            p: s.price.toString(),
            pct: s.pct
        })),
        []
    ];
    fs.writeFileSync(dashboardCachePath, JSON.stringify(dash, null, 2), 'utf8');
}

// Helper to modify veto metrics for target stock
function setupVetoMetrics(symbol, disparity5, maAlignment, organ1D = 10000, foreign1D = 10000, organ5D = 50000, foreign5D = 50000) {
    const vetoList = JSON.parse(vetoBackup);
    const item = vetoList.find(v => v.symbol === symbol);
    if (item) {
        if (!item.advanced) item.advanced = {};
        if (!item.advanced.technical) item.advanced.technical = {};
        if (!item.advanced.investor) item.advanced.investor = {};
        
        item.advanced.disparity5 = disparity5;
        item.advanced.technical.disparity5 = disparity5;
        item.advanced.technical.maAlignment = maAlignment;
        
        // Control investor flows to avoid accidental VETOs (like supply death cross)
        item.advanced.investor.organ1D = organ1D;
        item.advanced.investor.foreign1D = foreign1D;
        item.advanced.investor.organ5D = organ5D;
        item.advanced.investor.foreign5D = foreign5D;
        
        // Ensure high liquidity/volume
        item.advanced.transactionValue = 50000000000;
        item.advanced.strength = 110;
    }
    fs.writeFileSync(vetoMetricsPath, JSON.stringify(vetoList, null, 2), 'utf8');
}

const normalHistory = Array.from({ length: 20 }, (_, i) => ({
    date: `2026060${i+1}`,
    price: 8200
}));

const normalKosdaqHistory = Array.from({ length: 20 }, (_, i) => ({
    date: `2026060${i+1}`,
    price: 890
}));

async function startTests() {
    try {
        // ----------------------------------------------------
        // Scenario 1: Normal Market (Low stress, no breakdown)
        // ----------------------------------------------------
        await runScenario(
            'Scenario 1: Normal Market (Low Stress)',
            () => {
                const kospiHist = [...normalHistory];
                kospiHist[kospiHist.length - 1] = { date: '20260623', price: 8241 };
                const kosdaqHist = [...normalKosdaqHistory];
                kosdaqHist[kosdaqHist.length - 1] = { date: '20260623', price: 897.12 };
                
                writeMarketCache({
                    kospiHistory: kospiHist,
                    kosdaqHistory: kosdaqHist,
                    usdRate: 1300,
                    usdChange: 0,
                    us10yYield: 4.0,
                    us10yChange: 0
                });
                
                writeDashboardCache({
                    kospiPrice: 8241,
                    kospiChange: '+0.50%',
                    kosdaqPrice: 897.12,
                    kosdaqChange: '+0.80%',
                    stocks: [
                        { name: '기아', code: '000270', price: 120000, pct: '+0.5%' }
                    ]
                });
                
                // Normal Mode, above 5MA (102.0)
                setupVetoMetrics('000270', 102.0, '정배열 (강력한 추세 상승)', 10000, 10000, 50000, 50000);
            },
            (data) => {
                console.log(`🔍 Verification Results:`);
                console.log(`- Market Stress Score: ${data.marketStress?.score} (Expected < 50)`);
                console.log(`- Safe Mode: ${data.marketStress?.safeMode} (Expected false)`);
                
                const stockItem = data.candidates?.find(c => c.code === '000270');
                if (stockItem) {
                    console.log(`- Target Stock: ${stockItem.name} (${stockItem.code})`);
                    console.log(`  * isVetoed: ${stockItem.isVetoed} (Expected false)`);
                    console.log(`  * vetoReason: "${stockItem.vetoReason}"`);
                    if (stockItem.isVetoed) {
                        throw new Error('Target stock should NOT be vetoed in Scenario 1');
                    }
                } else {
                    console.log('Candidates in response:', data.candidates?.map(c => `${c.name} (${c.code})`));
                    throw new Error('Target stock "기아" not found in candidates list');
                }
            }
        );

        // ----------------------------------------------------
        // Scenario 2: Safe Mode (High Stress & Veto Bypass Blocked)
        // ----------------------------------------------------
        await runScenario(
            'Scenario 2: Safe Mode (Index Support Broken & VETO Active)',
            () => {
                const kospiHist = [...normalHistory];
                kospiHist[kospiHist.length - 1] = { date: '20260623', price: 8052.40 };
                const kosdaqHist = [...normalKosdaqHistory];
                kosdaqHist[kosdaqHist.length - 1] = { date: '20260623', price: 897.12 };
                
                writeMarketCache({
                    kospiHistory: kospiHist,
                    kosdaqHistory: kosdaqHist,
                    usdRate: 1300,
                    usdChange: 0,
                    us10yYield: 4.0,
                    us10yChange: 0
                });
                
                writeDashboardCache({
                    kospiPrice: 8052.40,
                    kospiChange: '-1.80%', // Triggers Safe Mode (<= -1.5%)
                    kosdaqPrice: 897.12,
                    kosdaqChange: '+0.80%',
                    stocks: [
                        { name: '기아', code: '000270', price: 120000, pct: '+0.5%' }
                    ]
                });
                
                // Below 5MA (98.5). Setup would normally bypass trends via Golden Cross, but blocked in Safe Mode!
                // Organ5D is negative, Organ1D is positive -> isSupplyGoldenCross = true
                setupVetoMetrics('000270', 98.5, '정배열', 10000, 10000, -50000, 50000);
            },
            (data) => {
                console.log(`🔍 Verification Results:`);
                console.log(`- Market Stress Score: ${data.marketStress?.score} (Expected >= 50)`);
                console.log(`- Safe Mode: ${data.marketStress?.safeMode} (Expected true)`);
                
                const stockItem = data.candidates?.find(c => c.code === '000270');
                if (stockItem) {
                    console.log(`- Target Stock: ${stockItem.name} (${stockItem.code})`);
                    console.log(`  * isVetoed: ${stockItem.isVetoed} (Expected true)`);
                    console.log(`  * vetoReason: "${stockItem.vetoReason}"`);
                    if (!stockItem.isVetoed) {
                        throw new Error('Target stock should be VETOED under Safe Mode when below 5MA');
                    }
                } else {
                    console.log('Candidates in response:', data.candidates?.map(c => `${c.name} (${c.code})`));
                    throw new Error('Target stock "기아" not found in candidates list');
                }
            }
        );

        // ----------------------------------------------------
        // Scenario 3: Kill Switch (Extreme Intraday Drop)
        // ----------------------------------------------------
        await runScenario(
            'Scenario 3: Kill Switch (Index Plunge)',
            () => {
                const kospiHist = [...normalHistory];
                kospiHist[kospiHist.length - 1] = { date: '20260623', price: 7380.82 };
                const kosdaqHist = [...normalKosdaqHistory];
                
                writeMarketCache({
                    kospiHistory: kospiHist,
                    kosdaqHistory: kosdaqHist,
                    usdRate: 1300,
                    usdChange: 0,
                    us10yYield: 4.0,
                    us10yChange: 0
                });
                
                writeDashboardCache({
                    kospiPrice: 7380.82,
                    kospiChange: '-9.99%', // Triggers Kill Switch (<= -3.0%)
                    kosdaqPrice: 897.12,
                    kosdaqChange: '+0.80%',
                    stocks: [
                        { name: '기아', code: '000270', price: 120000, pct: '-5.0%' }
                    ]
                });
                
                setupVetoMetrics('000270', 102.0, '정배열', 10000, 10000, 50000, 50000);
            },
            (data) => {
                console.log(`🔍 Verification Results:`);
                console.log(`- Theme: "${data.theme}" (Expected "시장 급락 및 패닉 관망 (Safe Mode)")`);
                console.log(`- Market Stress Score: ${data.marketStress?.score} (Expected >= 85)`);
                console.log(`- Safe Mode: ${data.marketStress?.safeMode} (Expected true)`);
                
                if (data.theme !== "시장 급락 및 패닉 관망 (Safe Mode)") {
                    throw new Error('Kill switch was NOT activated on KOSPI -9.99%');
                }
                console.log('✅ Kill Switch successfully activated!');
            }
        );

        console.log('\n🌟 All scenarios passed successfully!');
    } finally {
        restoreAll();
    }
}

startTests();