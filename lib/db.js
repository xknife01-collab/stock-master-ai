import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import supabase from './supabaseClient.js';

const LOCAL_DB_PATH = path.resolve('local_db.json');

// --- Helper: 비밀번호 SHA-256 해싱 ---
const hashPassword = (password) => {
    return crypto.createHash('sha256').update(password).digest('hex');
};

// --- Helper: 로컬 JSON 파일 DB 로드/저장 ---
const loadLocalDb = () => {
    if (!fs.existsSync(LOCAL_DB_PATH)) {
        const initial = { users: [], portfolios: [] };
        fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(initial, null, 2), 'utf8');
        return initial;
    }
    try {
        return JSON.parse(fs.readFileSync(LOCAL_DB_PATH, 'utf8'));
    } catch (e) {
        return { users: [], portfolios: [] };
    }
};

const saveLocalDb = (data) => {
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(data, null, 2), 'utf8');
};

// --- DB Operations Adapter ---

/**
 * 1. 회원 가입 (Register)
 */
export const registerUser = async (email, password, phone) => {
    const hashedPassword = hashPassword(password);

    if (supabase) {
        // Supabase Auth + Database Table 회원 등록
        // 1. Supabase Auth 가입
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password
        });
        if (authError) throw authError;

        // 2. 추가 프로필(휴대폰 번호 등) 수동 테이블 기록
        const { error: dbError } = await supabase
            .from('profiles')
            .upsert({ id: authData.user.id, email, phone });
        if (dbError) throw dbError;

        return { email, phone };
    } else {
        // 로컬 DB 처리
        const db = loadLocalDb();
        if (db.users.find(u => u.email === email)) {
            throw new Error('이미 등록된 이메일 주소입니다.');
        }
        db.users.push({ email, password: hashedPassword, phone });
        saveLocalDb(db);
        return { email, phone };
    }
};

/**
 * 2. 로그인 (Login)
 */
export const loginUser = async (email, password) => {
    if (supabase) {
        // Supabase Auth 로그인
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        if (error) throw error;

        // 휴대폰 정보 조회
        const { data: profile } = await supabase
            .from('profiles')
            .select('phone')
            .eq('id', data.user.id)
            .single();

        return { email, phone: profile?.phone || '', token: data.session.access_token };
    } else {
        // 로컬 DB 로그인 검증
        const db = loadLocalDb();
        const user = db.users.find(u => u.email === email);
        if (!user || user.password !== hashPassword(password)) {
            throw new Error('이메일 또는 비밀번호가 일치하지 않습니다.');
        }
        return { email, phone: user.phone, token: 'local-session-mock-token' };
    }
};

/**
 * 3. 사용자 포트폴리오 조회 (Get Portfolio)
 */
export const getPortfolio = async (userId) => {
    if (supabase) {
        const { data, error } = await supabase
            .from('portfolios')
            .select('*')
            .eq('user_id', userId);
        if (error) throw error;
        return data.map(item => ({
            id: item.id,
            symbol: item.symbol,
            name: item.name,
            purchasePrice: item.purchase_price,
            stopLossPrice: item.stop_loss_price,
            isAlerted: item.is_alerted
        }));
    } else {
        const db = loadLocalDb();
        return db.portfolios
            .filter(p => p.userId === userId)
            .map(p => ({
                id: p.id,
                symbol: p.symbol,
                name: p.name,
                purchasePrice: p.purchasePrice,
                stopLossPrice: p.stopLossPrice,
                isAlerted: p.isAlerted
            }));
    }
};

/**
 * 4. 포트폴리오 종목 추가 (Add Stock)
 */
export const addPortfolioItem = async (userId, symbol, name, purchasePrice, stopLossPrice) => {
    if (supabase) {
        const { data, error } = await supabase
            .from('portfolios')
            .insert({
                user_id: userId,
                symbol,
                name,
                purchase_price: purchasePrice,
                stop_loss_price: stopLossPrice,
                is_alerted: false
            })
            .select()
            .single();
        if (error) throw error;
        return data;
    } else {
        const db = loadLocalDb();
        const newItem = {
            id: Date.now().toString(),
            userId,
            symbol,
            name,
            purchasePrice: Number(purchasePrice),
            stopLossPrice: Number(stopLossPrice),
            isAlerted: false,
            createdAt: new Date().toISOString()
        };
        db.portfolios.push(newItem);
        saveLocalDb(db);
        return newItem;
    }
};

/**
 * 5. 손절가 수정 (Update Stop Loss)
 */
export const updateStopLoss = async (itemId, stopLossPrice) => {
    if (supabase) {
        const { data, error } = await supabase
            .from('portfolios')
            .update({ stop_loss_price: stopLossPrice, is_alerted: false }) // 손절가 수정 시 알림 초기화
            .eq('id', itemId)
            .select()
            .single();
        if (error) throw error;
        return data;
    } else {
        const db = loadLocalDb();
        const item = db.portfolios.find(p => p.id === itemId);
        if (!item) throw new Error('해당 보유 주식 내역을 찾을 수 없습니다.');
        item.stopLossPrice = Number(stopLossPrice);
        item.isAlerted = false; // 손절가 변경 시 알림 여부 초기화
        saveLocalDb(db);
        return item;
    }
};

/**
 * 6. 종목 삭제 (Delete Stock)
 */
export const deletePortfolioItem = async (itemId) => {
    if (supabase) {
        const { error } = await supabase
            .from('portfolios')
            .delete()
            .eq('id', itemId);
        if (error) throw error;
        return true;
    } else {
        const db = loadLocalDb();
        const index = db.portfolios.findIndex(p => p.id === itemId);
        if (index === -1) throw new Error('해당 보유 주식 내역을 찾을 수 없습니다.');
        db.portfolios.splice(index, 1);
        saveLocalDb(db);
        return true;
    }
};

/**
 * 7. 백그라운드 모니터링용 전체 포트폴리오 조회
 */
export const getAllPortfoliosForMonitoring = async () => {
    if (supabase) {
        const { data, error } = await supabase
            .from('portfolios')
            .select(`
                id,
                user_id,
                symbol,
                name,
                purchase_price,
                stop_loss_price,
                is_alerted,
                profiles (
                    phone
                )
            `);
        if (error) throw error;
        return data.map(item => ({
            id: item.id,
            userId: item.user_id,
            symbol: item.symbol,
            name: item.name,
            purchasePrice: item.purchase_price,
            stopLossPrice: item.stop_loss_price,
            isAlerted: item.is_alerted,
            phone: item.profiles?.phone || ''
        }));
    } else {
        const db = loadLocalDb();
        return db.portfolios.map(item => {
            const user = db.users.find(u => u.email === item.userId);
            return {
                id: item.id,
                userId: item.userId,
                symbol: item.symbol,
                name: item.name,
                purchasePrice: item.purchasePrice,
                stopLossPrice: item.stopLossPrice,
                isAlerted: item.isAlerted,
                phone: user?.phone || ''
            };
        });
    }
};

/**
 * 8. 알림 전송 플래그 업데이트
 */
export const updateAlertStatus = async (itemId, isAlerted) => {
    if (supabase) {
        const { error } = await supabase
            .from('portfolios')
            .update({ is_alerted: isAlerted })
            .eq('id', itemId);
        if (error) throw error;
        return true;
    } else {
        const db = loadLocalDb();
        const item = db.portfolios.find(p => p.id === itemId);
        if (item) {
            item.isAlerted = isAlerted;
            saveLocalDb(db);
        }
        return true;
    }
};
