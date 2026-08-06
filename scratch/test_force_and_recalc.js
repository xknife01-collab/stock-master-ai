import assert from 'assert';

// Mocking the recalculation logic from kisCore.js to test it locally
function testRecalculation() {
    console.log("🧪 Testing streak recalculation logic...");

    const mockPrice = 160000;
    const mockDailyHistory = [
        { date: '20260703', foreign: 150000, organ: 90000, personal: -240000 }, // Friday (buying for foreign/organ, selling for personal)
        { date: '20260702', foreign: 50000, organ: 100000, personal: -150000 },  // Thursday (buying for foreign/organ, selling for personal)
        { date: '20260701', foreign: -20000, organ: -10000, personal: 30000 }    // Wednesday (selling for foreign/organ, buying for personal)
    ];

    // Scenario 1: Today is a buying day for foreigners and organ, selling day for personal
    // Today's real-time values: foreign +172000, organ -12000, personal -160000
    let investorStats = {
        isTodayData: false,
        foreign1D: 172000,
        organ1D: -12000,
        personal1D: -160000,
        dailyHistory: JSON.parse(JSON.stringify(mockDailyHistory))
    };

    const todayStr = '20260706'; // Monday
    const historyWithoutToday = (investorStats.dailyHistory || []).filter(h => h.date !== todayStr);
    const fullHistory = [
        {
            date: todayStr,
            foreign: investorStats.foreign1D || 0,
            organ: investorStats.organ1D || 0,
            personal: investorStats.personal1D || 0
        },
        ...historyWithoutToday
    ];

    // 5일 및 20일 누적 수량 재계산
    let foreign5D = 0; let organ5D = 0; let personal5D = 0;
    for (let i = 0; i < Math.min(5, fullHistory.length); i++) {
        foreign5D += fullHistory[i].foreign;
        organ5D += fullHistory[i].organ;
        personal5D += fullHistory[i].personal;
    }

    // 연속 순매수 일수/거래량 재계산
    let foreignConsecutiveDays = 0;
    let foreignConsecutiveVolume = 0;
    for (let i = 0; i < fullHistory.length; i++) {
        const qty = fullHistory[i].foreign;
        if (qty > 0) {
            foreignConsecutiveDays++;
            foreignConsecutiveVolume += qty;
        } else break;
    }

    let organConsecutiveDays = 0;
    let organConsecutiveVolume = 0;
    for (let i = 0; i < fullHistory.length; i++) {
        const qty = fullHistory[i].organ;
        if (qty > 0) {
            organConsecutiveDays++;
            organConsecutiveVolume += qty;
        } else break;
    }

    let personalConsecutiveDays = 0;
    let personalConsecutiveVolume = 0;
    for (let i = 0; i < fullHistory.length; i++) {
        const qty = fullHistory[i].personal;
        if (qty > 0) {
            personalConsecutiveDays++;
            personalConsecutiveVolume += qty;
        } else break;
    }

    // Assertions for Scenario 1
    // Foreigners: Today +172000 (buy), Friday +150000 (buy), Thursday +50000 (buy), Wednesday -20000 (sell)
    // Streak: 3 days. Total Volume: 172000 + 150000 + 50000 = 372000
    assert.strictEqual(foreignConsecutiveDays, 3);
    assert.strictEqual(foreignConsecutiveVolume, 372000);

    // Organ: Today -12000 (sell) -> breaks streak immediately.
    // Streak: 0 days.
    assert.strictEqual(organConsecutiveDays, 0);

    // Personal: Today -160000 (sell) -> breaks streak immediately.
    // Streak: 0 days.
    assert.strictEqual(personalConsecutiveDays, 0);

    console.log("✅ Scenario 1 (Recalculation with Buying Today) passed!");

    // Scenario 2: Today is a selling day for foreigners, but they were buying before.
    // Today: foreign -50000, organ +8000, personal +42000
    investorStats = {
        isTodayData: false,
        foreign1D: -50000,
        organ1D: 8000,
        personal1D: 42000,
        dailyHistory: JSON.parse(JSON.stringify(mockDailyHistory))
    };

    const fullHistory2 = [
        {
            date: todayStr,
            foreign: investorStats.foreign1D || 0,
            organ: investorStats.organ1D || 0,
            personal: investorStats.personal1D || 0
        },
        ...historyWithoutToday
    ];

    let foreignConsecutiveDays2 = 0;
    for (let i = 0; i < fullHistory2.length; i++) {
        const qty = fullHistory2[i].foreign;
        if (qty > 0) foreignConsecutiveDays2++; else break;
    }

    let personalConsecutiveDays2 = 0;
    let personalConsecutiveVolume2 = 0;
    for (let i = 0; i < fullHistory2.length; i++) {
        const qty = fullHistory2[i].personal;
        if (qty > 0) {
            personalConsecutiveDays2++;
            personalConsecutiveVolume2 += qty;
        } else break;
    }

    // Assertions for Scenario 2
    // Foreigners: Today -50000 (sell) -> streak is 0.
    assert.strictEqual(foreignConsecutiveDays2, 0);

    // Personal: Today +42000 (buy), Friday -240000 (sell) -> streak is 1. Total volume: 42000
    assert.strictEqual(personalConsecutiveDays2, 1);
    assert.strictEqual(personalConsecutiveVolume2, 42000);

    console.log("✅ Scenario 2 (Recalculation with Selling Today) passed!");
    console.log("🎉 All recalculation assertions passed!");
}

testRecalculation();
