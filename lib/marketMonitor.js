import axios from 'axios';
import { KIS_BASE_URL, getKisHeaders, ensureToken } from './kisCore.js';

let lastConditionResults = new Map(); // seq -> Set(symbols)

/**
 * 특정 조건식에서 새롭게 포착된 종목들을 반환합니다.
 */
export const getCapturedStocks = async (seq) => {
    try {
        const response = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/condition-search`, {
            params: {
                user_id: process.env.KIS_USER_ID || 'dummy_id',
                seq: seq
            },
            headers: getKisHeaders('FHKST03030001')
        });

        if (response.data.rt_cd !== '0' || !response.data.output) {
            return [];
        }

        const currentStocks = response.data.output;
        const currentCodes = currentStocks.map(it => it.code);
        const prevStocks = lastConditionResults.get(seq) || new Set();
        
        const newStocks = currentStocks.filter(it => !prevStocks.has(it.code));
        
        // 상태 업데이트
        lastConditionResults.set(seq, new Set(currentCodes));
        
        return newStocks;
    } catch (error) {
        console.error(`[Monitor] Condition ${seq} check failed:`, error.message);
        return [];
    }
};

/**
 * 모든 활성 조건식에서 포착된 종목들을 한꺼번에 확인합니다.
 */
export const getAllCapturedStocks = async (seqs = ['0', '1', '2']) => {
    const results = await Promise.all(seqs.map(async seq => {
        const captured = await getCapturedStocks(seq);
        return captured.map(s => ({ ...s, seq }));
    }));
    return results.flat();
};
