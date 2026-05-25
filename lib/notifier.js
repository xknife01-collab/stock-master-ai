import fs from 'fs';
import path from 'path';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const LOG_FILE_PATH = path.resolve('notification_logs.json');

// --- Helper: 로컬 알림 로그 저장 (시뮬레이터용) ---
const saveMockNotification = (phone, text) => {
    let logs = [];
    if (fs.existsSync(LOG_FILE_PATH)) {
        try {
            logs = JSON.parse(fs.readFileSync(LOG_FILE_PATH, 'utf8'));
        } catch (e) {
            logs = [];
        }
    }
    const logItem = {
        time: new Date().toISOString(),
        phone,
        message: text,
        mode: 'MOCK_SIMULATOR'
    };
    logs.unshift(logItem);
    if (logs.length > 200) logs.pop();
    fs.writeFileSync(LOG_FILE_PATH, JSON.stringify(logs, null, 2), 'utf8');

    console.log('\n==================================================');
    console.log('🚨 [MOCK NOTIFIER] 알리고 문자 발송 시뮬레이션');
    console.log(`📱 수신번호: ${phone}`);
    console.log(`✉️ 발송내용:\n${text}`);
    console.log('==================================================\n');
};

/**
 * 손절가 감시 알림 발송 함수 (알리고 SMS/LMS API 사용)
 * @param {string} phone 수신 전화번호
 * @param {string} stockName 주식 종목명
 * @param {number} currentPrice 현재가
 * @param {number} stopLossPrice 설정 손절가
 */
export const sendStopLossAlert = async (phone, stockName, currentPrice, stopLossPrice) => {
    const cleanPhone = phone ? phone.replace(/[^0-9]/g, '') : '';
    if (!cleanPhone) {
        console.warn(`⚠️ [Notifier] 수신 전화번호가 누락되어 알림을 건너뜁니다.`);
        return false;
    }

    const messageText = `[Stock AI] 손절 경보!\n보유 종목 [${stockName}]의 현재가가 설정하신 손절가 이하로 하락했습니다.\n\n- 현재가: ₩${currentPrice.toLocaleString()}\n- 손절가: ₩${stopLossPrice.toLocaleString()}\n\n* 리스크 관리를 위해 차트를 확인하고 매매를 결정하세요.`;

    const apiKey = process.env.ALIGO_API_KEY;
    const userId = process.env.ALIGO_USER_ID;
    const senderNumber = process.env.ALIGO_SENDER; // 알리고에 사전 등록된 발신번호

    // 알리고 API 설정이 존재할 경우 실발송 진행
    if (apiKey && userId && senderNumber) {
        try {
            console.log(`📡 [Notifier] 알리고(Aligo) API를 통해 문자(LMS) 발송을 시도합니다...`);
            
            // 알리고는 x-www-form-urlencoded 형식을 요구하므로 URLSearchParams를 사용합니다.
            const params = new URLSearchParams();
            params.append('key', apiKey);
            params.append('userid', userId);
            params.append('sender', senderNumber.replace(/[^0-9]/g, ''));
            params.append('receiver', cleanPhone);
            params.append('msg', messageText);
            params.append('title', 'Stock AI 손절 경보');
            params.append('msg_type', 'LMS'); // 장문 메시지

            const response = await axios.post('https://apis.aligo.in/send/', params, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            // 알리고 결과코드 1은 성공을 나타냅니다.
            if (response.data && (response.data.result_code === '1' || response.data.result_code === 1)) {
                console.log(`✅ [Notifier] 알리고 문자 발송 성공! (MsgID: ${response.data.msg_id})`);
                
                // 로컬 로그에 실전송 성공 기록 남김
                let logs = [];
                if (fs.existsSync(LOG_FILE_PATH)) {
                    try { logs = JSON.parse(fs.readFileSync(LOG_FILE_PATH, 'utf8')); } catch (e) {}
                }
                logs.unshift({
                    time: new Date().toISOString(),
                    phone: cleanPhone,
                    message: messageText,
                    mode: 'ALIGO_REAL_SMS',
                    msgId: response.data.msg_id
                });
                fs.writeFileSync(LOG_FILE_PATH, JSON.stringify(logs, null, 2), 'utf8');
                return true;
            } else {
                throw new Error(response.data.message || `알리고 응답 에러 (코드: ${response.data.result_code})`);
            }
        } catch (error) {
            console.error('❌ [Notifier] 알리고 문자 발송 실패 (모의 발송 모드로 폴백):', error.message);
            saveMockNotification(cleanPhone, messageText);
            return false;
        }
    } else {
        // API 설정 누락 시 모의 발송 로그 저장
        saveMockNotification(cleanPhone, messageText);
        return true;
    }
};

/**
 * 회원가입 인증번호 발송 함수 (알리고 SMS API 사용)
 * @param {string} phone 수신 전화번호
 * @param {string} code 6자리 인증번호
 */
export const sendAuthCodeSMS = async (phone, code) => {
    const cleanPhone = phone ? phone.replace(/[^0-9]/g, '') : '';
    if (!cleanPhone) return false;

    const messageText = `[Stock AI] 인증번호는 [${code}] 입니다. 3분 이내에 입력해주세요.`;

    const apiKey = process.env.ALIGO_API_KEY;
    const userId = process.env.ALIGO_USER_ID;
    const senderNumber = process.env.ALIGO_SENDER;

    if (apiKey && userId && senderNumber) {
        try {
            console.log(`📡 [Notifier] 알리고(Aligo) API를 통해 인증번호(SMS) 발송을 시도합니다...`);
            
            const params = new URLSearchParams();
            params.append('key', apiKey);
            params.append('userid', userId);
            params.append('sender', senderNumber.replace(/[^0-9]/g, ''));
            params.append('receiver', cleanPhone);
            params.append('msg', messageText);
            params.append('title', 'Stock AI 인증번호');
            params.append('msg_type', 'SMS'); 

            const response = await axios.post('https://apis.aligo.in/send/', params, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            if (response.data && (response.data.result_code === '1' || response.data.result_code === 1)) {
                console.log(`✅ [Notifier] 인증번호 발송 성공! (MsgID: ${response.data.msg_id})`);
                
                let logs = [];
                if (fs.existsSync(LOG_FILE_PATH)) {
                    try { logs = JSON.parse(fs.readFileSync(LOG_FILE_PATH, 'utf8')); } catch (e) {}
                }
                logs.unshift({
                    time: new Date().toISOString(),
                    phone: cleanPhone,
                    message: messageText,
                    mode: 'ALIGO_REAL_SMS',
                    msgId: response.data.msg_id
                });
                fs.writeFileSync(LOG_FILE_PATH, JSON.stringify(logs, null, 2), 'utf8');
                return true;
            } else {
                throw new Error(response.data.message || `알리고 응답 에러 (코드: ${response.data.result_code})`);
            }
        } catch (error) {
            console.error('❌ [Notifier] 인증번호 발송 실패 (모의 발송 모드로 폴백):', error.message);
            saveMockNotification(cleanPhone, messageText);
            return true;
        }
    } else {
        saveMockNotification(cleanPhone, messageText);
        return true;
    }
};
