import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

/**
 * 🚀 [Gemini Dual-Key & Multi-Model Cascade Engine]
 * - 복수의 유료 API Key 풀 지원 (1번 Key 실패/한도 초과 시 2번 Key로 즉시 자동 전환)
 * - 모델 캐스케이드 지원 (gemini-flash-latest ➡️ gemini-3.1-flash-lite ➡️ gemini-3.5-flash ➡️ gemini-3.7-flash)
 * - 100% 무중단 순수 실시간 AI 추천 및 리포트 생성 보장
 */

export const SUPPORTED_GEMINI_MODELS = [
    'gemini-flash-latest',
    'gemini-3.1-flash-lite',
    'gemini-3.5-flash',
    'gemini-3.7-flash'
];

export const getGeminiApiKeys = () => {
    const rawKeys = [
        process.env.GEMINI_API_KEY_1,
        process.env.GEMINI_API_KEY_2,
        process.env.GEMINI_API_KEY
    ];

    const keySet = new Set();
    rawKeys.forEach(k => {
        if (!k || typeof k !== 'string') return;
        // 쉼표나 세미콜론으로 구분된 다중 키 파싱 지원
        const parts = k.split(/[,;]+/).map(s => s.trim()).filter(Boolean);
        parts.forEach(p => {
            if (p.length > 10) keySet.add(p);
        });
    });

    return Array.from(keySet);
};

export const executeGeminiRequest = async (prompt, options = { responseMimeType: 'application/json' }) => {
    const keys = getGeminiApiKeys();
    if (keys.length === 0) {
        throw new Error('❌ [Gemini Engine] 등록된 유효한 GEMINI_API_KEY가 없습니다.');
    }

    let lastError = null;

    for (let keyIdx = 0; keyIdx < keys.length; keyIdx++) {
        const apiKey = keys[keyIdx];
        const keyLabel = `Key #${keyIdx + 1} (${apiKey.slice(0, 8)}...)`;
        const genAI = new GoogleGenerativeAI(apiKey);

        for (let modelIdx = 0; modelIdx < SUPPORTED_GEMINI_MODELS.length; modelIdx++) {
            const modelName = SUPPORTED_GEMINI_MODELS[modelIdx];
            try {
                const model = genAI.getGenerativeModel({
                    model: modelName,
                    generationConfig: options.responseMimeType ? { responseMimeType: options.responseMimeType } : undefined
                });

                const t0 = Date.now();
                const result = await model.generateContent(prompt);
                const elapsed = Date.now() - t0;
                const rawText = result.response.text ? result.response.text().trim() : result.response.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

                if (!rawText) {
                    throw new Error(`Empty response returned from model '${modelName}'`);
                }

                console.log(`✅ [Gemini Engine] ${keyLabel} - 모델 '${modelName}' 분석 성공 (${elapsed}ms)`);

                if (options.responseMimeType === 'application/json') {
                    try {
                        const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
                        return JSON.parse(cleaned);
                    } catch (jsonErr) {
                        console.warn(`⚠️ [Gemini Engine] JSON 파싱 실패, 원문 반환:`, rawText.slice(0, 100));
                        return rawText;
                    }
                }

                return rawText;
            } catch (err) {
                lastError = err;
                const isRateLimit = err.status === 429 || err.message?.includes('429') || err.message?.includes('quota') || err.message?.includes('Quota');
                console.warn(`⚠️ [Gemini Engine] ${keyLabel} - 모델 '${modelName}' 실패: ${err.message?.slice(0, 120)} ${isRateLimit ? '➡️ [429 한도 초과: 다음 모델/키로 자동 전환]' : ''}`);
            }
        }
        console.warn(`🔄 [Gemini Engine] ${keyLabel}의 모든 모델 시도 실패 ➡️ 다음 Key #${keyIdx + 2}로 전환합니다.`);
    }

    throw new Error(`모든 Gemini Key 및 모델 호출 실패. 최후 에러: ${lastError?.message}`);
};

/**
 * 기존 코드와의 100% 호환성을 위한 Proxy 래퍼 객체
 */
export const createCompatibleModelWrapper = () => {
    return {
        generateContent: async (requestPayload) => {
            let promptText = '';
            let isJson = true;

            if (typeof requestPayload === 'string') {
                promptText = requestPayload;
                isJson = false;
            } else if (requestPayload?.contents) {
                const parts = requestPayload.contents[0]?.parts;
                if (Array.isArray(parts)) {
                    promptText = parts.map(p => p.text || '').join('\n');
                }
                isJson = requestPayload?.generationConfig?.responseMimeType === 'application/json';
            }

            const res = await executeGeminiRequest(promptText, { responseMimeType: isJson ? 'application/json' : undefined });
            
            const rawOutput = typeof res === 'object' ? JSON.stringify(res) : String(res);
            return {
                response: {
                    text: () => rawOutput,
                    candidates: [{
                        content: {
                            parts: [{ text: rawOutput }]
                        }
                    }]
                }
            };
        }
    };
};
