import dotenv from 'dotenv';
dotenv.config();
import supabase from '../lib/supabaseClient.js';

const mockStocks = [
    {
        symbol: '005930', // 삼성전자
        fundamental: {
            price: 75000,
            per: '12.5',
            pbr: '1.4',
            roe: '18.5',
            debtRatio: '35.2',
            yield: '2.8',
            consensus: [{ date: '2026-06-16', target: '95000', opinion: '매수' }],
            finance: [
                { year: '202312', revenue: 2580000, profit: 65000 },
                { year: '202412', revenue: 2620000, profit: 145000 },
                { year: '202512', revenue: 2780000, profit: 350000 }
            ]
        },
        advanced: {
            strength: '118.5',
            disparity5: '101.2',
            disparity20: '101.5',
            shortRatio: '1.2',
            creditBalance: '0.35',
            investor: {
                foreign1D: 550000,
                organ1D: 350000,
                personal1D: -900000,
                foreign5D: 2500000,
                organ5D: 1200000,
                personal5D: -3700000,
                isRealtime: true,
                isTodayData: true
            },
            atr: 1500,
            atrPercent: 2.0,
            technical: {
                rsi: 58.5,
                ma5: 74200,
                ma20: 73500,
                ma60: 71000,
                maAlignment: '정배열 (강력한 추세 상승)',
                bollinger: {
                    upper: 76500,
                    middle: 73500,
                    lower: 70500,
                    positionPercent: 75.0,
                    interpretation: '밴드 안정 구간'
                },
                disparity5: 101.2,
                disparity20: 102.0
            },
            chartHistory: {
                '1Y': [
                    { date: '26.06', price: 75000, vol: 12000000 },
                    { date: '26.05', price: 74000, vol: 11000000 },
                    { date: '26.04', price: 73000, vol: 13000000 }
                ]
            }
        }
    },
    {
        symbol: '000270', // 기아
        fundamental: {
            price: 120000,
            per: '6.2',
            pbr: '1.1',
            roe: '22.8',
            debtRatio: '42.5',
            yield: '4.5',
            consensus: [{ date: '2026-06-16', target: '155000', opinion: '매수' }],
            finance: [
                { year: '202312', revenue: 998000, profit: 116000 },
                { year: '202412', revenue: 1020000, profit: 124000 },
                { year: '202512', revenue: 1150000, profit: 138000 }
            ]
        },
        advanced: {
            strength: '124.2',
            disparity5: '102.1',
            disparity20: '102.5',
            shortRatio: '0.8',
            creditBalance: '0.18',
            investor: {
                foreign1D: 280000,
                organ1D: 150000,
                personal1D: -430000,
                foreign5D: 1100000,
                organ5D: 850000,
                personal5D: -1950000,
                isRealtime: true,
                isTodayData: true
            },
            atr: 3200,
            atrPercent: 2.67,
            technical: {
                rsi: 62.3,
                ma5: 118000,
                ma20: 115000,
                ma60: 111000,
                maAlignment: '정배열 (강력한 추세 상승)',
                bollinger: {
                    upper: 122000,
                    middle: 115000,
                    lower: 108000,
                    positionPercent: 85.7,
                    interpretation: '상한선 접근 (추격 매수 부담 구간)'
                },
                disparity5: 101.7,
                disparity20: 104.3
            },
            chartHistory: {
                '1Y': [
                    { date: '26.06', price: 120000, vol: 2000000 },
                    { date: '26.05', price: 117000, vol: 1800000 },
                    { date: '26.04', price: 114000, vol: 2200000 }
                ]
            }
        }
    },
    {
        symbol: '005380', // 현대차
        fundamental: {
            price: 260000,
            per: '5.8',
            pbr: '0.85',
            roe: '16.2',
            debtRatio: '68.4',
            yield: '4.8',
            consensus: [{ date: '2026-06-16', target: '330000', opinion: '매수' }],
            finance: [
                { year: '202312', revenue: 1620000, profit: 151000 },
                { year: '202412', revenue: 1680000, profit: 162000 },
                { year: '202512', revenue: 1750000, profit: 185000 }
            ]
        },
        advanced: {
            strength: '112.8',
            disparity5: '100.8',
            disparity20: '101.2',
            shortRatio: '1.5',
            creditBalance: '0.22',
            investor: {
                foreign1D: 150000,
                organ1D: 120000,
                personal1D: -270000,
                foreign5D: 780000,
                organ5D: 550000,
                personal5D: -1330000,
                isRealtime: true,
                isTodayData: true
            },
            atr: 6500,
            atrPercent: 2.5,
            technical: {
                rsi: 54.1,
                ma5: 258000,
                ma20: 254000,
                ma60: 248000,
                maAlignment: '정배열 (강력한 추세 상승)',
                bollinger: {
                    upper: 268000,
                    middle: 254000,
                    lower: 240000,
                    positionPercent: 71.4,
                    interpretation: '밴드 안정 구간'
                },
                disparity5: 100.8,
                disparity20: 102.4
            },
            chartHistory: {
                '1Y': [
                    { date: '26.06', price: 260000, vol: 800000 },
                    { date: '26.05', price: 255000, vol: 750000 },
                    { date: '26.04', price: 250000, vol: 900000 }
                ]
            }
        }
    }
];

async function run() {
    console.log("⚡ Supabase 모의 완벽 데이터 주입 시작...");
    for (const mock of mockStocks) {
        const { error } = await supabase
            .from('stock_detail_cache')
            .upsert({
                symbol: mock.symbol,
                fundamental: mock.fundamental,
                advanced: mock.advanced,
                updated_at: new Date().toISOString()
            }, { onConflict: 'symbol' });

        if (error) {
            console.error(`❌ 주입 실패: ${mock.symbol}`, error.message);
        } else {
            console.log(`✅ 주입 성공: ${mock.symbol}`);
        }
    }
    console.log("✨ 주입 완료!");
}

run();
