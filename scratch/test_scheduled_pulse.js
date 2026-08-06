import { getScheduledPulseInfo } from '../routes/aiApi.js';

// Mock Date with specific KST hour/minute
const createMockKstDate = (year, month, date, hour, minute) => {
    const dateUtc = new Date(Date.UTC(year, month - 1, date, hour, minute));
    return new Date(dateUtc.getTime() - 9 * 60 * 60 * 1000);
};

const runTests = () => {
    const testCases = [
        { time: "09:05 KST", date: createMockKstDate(2026, 7, 4, 9, 5) },
        { time: "09:14 KST", date: createMockKstDate(2026, 7, 4, 9, 14) },
        { time: "09:15 KST", date: createMockKstDate(2026, 7, 4, 9, 15) },
        { time: "09:29 KST", date: createMockKstDate(2026, 7, 4, 9, 29) },
        { time: "09:30 KST", date: createMockKstDate(2026, 7, 4, 9, 30) },
        { time: "10:00 KST", date: createMockKstDate(2026, 7, 4, 10, 0) },
        { time: "10:29 KST", date: createMockKstDate(2026, 7, 4, 10, 29) },
        { time: "10:30 KST", date: createMockKstDate(2026, 7, 4, 10, 30) },
        { time: "10:45 KST", date: createMockKstDate(2026, 7, 4, 10, 45) },
        { time: "11:00 KST", date: createMockKstDate(2026, 7, 4, 11, 0) },
        { time: "15:29 KST", date: createMockKstDate(2026, 7, 4, 15, 29) },
        { time: "15:30 KST", date: createMockKstDate(2026, 7, 4, 15, 30) },
        { time: "15:45 KST", date: createMockKstDate(2026, 7, 4, 15, 45) }
    ];

    console.log("=== Testing getScheduledPulseInfo mapping ===");
    testCases.forEach(tc => {
        // Since executeHourlyPulse adds 9 hours to the input Date, we simulate that date:
        const nowKst = tc.date;
        const result = getScheduledPulseInfo(new Date(nowKst.getTime() + 9 * 60 * 60 * 1000));
        console.log(`Current KST: ${tc.time} | mapped pulseKey: ${result.pulseKey} | displayTime: "${result.displayTime}" | isBeforeFirstPulse: ${result.isBeforeFirstPulse}`);
    });
};

runTests();
