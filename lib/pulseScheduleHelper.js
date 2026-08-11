/**
 * 펄스 스케줄 키 계산 헬퍼 (계량 전광판 10분 / AI 추천종목 30분 이원화)
 */
export const getScheduledPulseInfoHelper = (nowKst) => {
    const year = nowKst.getUTCFullYear();
    const month = nowKst.getUTCMonth() + 1;
    const date = nowKst.getUTCDate();
    const hour = nowKst.getUTCHours();
    const minutes = nowKst.getUTCMinutes();
    
    const timeVal = hour * 60 + minutes;
    
    // 10분 스케줄 (계량 전광판 퀀트 점수 갱신용: 09:10 ~ 15:30)
    const schedules10 = [];
    for (let m = 550; m <= 590; m += 10) schedules10.push(m);
    for (let m = 600; m <= 930; m += 10) schedules10.push(m);

    // 30분 스케줄 (Gemini AI 추천종목 리포트 갱신용: 09:30, 10:00, 10:30 ... 15:30)
    const schedules30 = [570, 600, 630, 660, 690, 720, 750, 780, 810, 840, 870, 900, 930];

    // 현재 시각보다 작거나 같은 가장 최근 10분 스케줄
    let last10 = null;
    for (let i = schedules10.length - 1; i >= 0; i--) {
        if (schedules10[i] <= timeVal) {
            last10 = schedules10[i];
            break;
        }
    }

    // 현재 시각보다 작거나 같은 가장 최근 30분 스케줄
    let last30 = null;
    for (let i = schedules30.length - 1; i >= 0; i--) {
        if (schedules30[i] <= timeVal) {
            last30 = schedules30[i];
            break;
        }
    }
    
    let pulseKeyTime = "";
    let halfHourKeyTime = "";
    let isBeforeFirstPulse = false;
    let targetDateStr = `${year}-${month}-${date}`;
    
    if (last10 === null) {
        // 첫 펄스 시각(09:10) 이전에는 전일 마지막 펄스(15:30) 키 매핑
        isBeforeFirstPulse = true;
        const prevDay = new Date(nowKst.getTime() - 24 * 60 * 60 * 1000);
        targetDateStr = `${prevDay.getUTCFullYear()}-${prevDay.getUTCMonth() + 1}-${prevDay.getUTCDate()}`;
        pulseKeyTime = "15:30";
        halfHourKeyTime = "15:30";
    } else {
        const h10 = Math.floor(last10 / 60);
        const m10 = last10 % 60;
        pulseKeyTime = `${h10.toString().padStart(2, '0')}:${m10.toString().padStart(2, '0')}`;

        if (last30 === null) {
            halfHourKeyTime = "09:00";
        } else {
            const h30 = Math.floor(last30 / 60);
            const m30 = last30 % 60;
            halfHourKeyTime = `${h30.toString().padStart(2, '0')}:${m30.toString().padStart(2, '0')}`;
        }
    }
    
    const pulseKey = `${targetDateStr}-${pulseKeyTime}`;
    const halfHourKey = `${targetDateStr}-${halfHourKeyTime}`;
    const mmStr = String(month).padStart(2, '0');
    const ddStr = String(date).padStart(2, '0');
    const displayTime = isBeforeFirstPulse ? "" : `${mmStr}.${ddStr} ${pulseKeyTime}`;
    
    return {
        pulseKey,
        halfHourKey,
        displayTime,
        isBeforeFirstPulse,
        pulseKeyTime
    };
};
