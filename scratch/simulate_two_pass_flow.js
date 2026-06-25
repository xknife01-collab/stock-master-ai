import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function simulate() {
    console.log("================================================================");
    console.log("⚙️  [SIMULATION] 2-STAGE AI RECOMMENDATION PIPELINE FLOW DIAGNOSTICS");
    console.log("================================================================\n");

    // 1. Read files if they exist
    const selectionPromptPath = path.join(__dirname, '../scratch/last_selection_prompt.txt');
    const finalPromptPath = path.join(__dirname, '../scratch/last_final_prompt.txt');

    if (!fs.existsSync(selectionPromptPath) || !fs.existsSync(finalPromptPath)) {
        console.error("❌ Diagnostic prompt files not found. Please run scratch/trigger_live_pulse_api.js first!");
        return;
    }

    const selectionPrompt = fs.readFileSync(selectionPromptPath, 'utf8');
    const finalPrompt = fs.readFileSync(finalPromptPath, 'utf8');

    // 2. Parse Candidates from the 1st Stage list
    console.log("--- [STAGE 1] QUANTITATIVE SCREENING RESULTS (후보 25개 종목 발굴) ---");
    console.log("1단계 정량 필터(체결강도, 이격도, 공매도 비중, 5일 수급 등)를 통과하여 점수순 정렬된 25개 리스트:\n");

    const lines = selectionPrompt.split('\n');
    let candidateList = [];
    let isCandidateSection = false;

    for (const line of lines) {
        if (line.includes('[실시간 시장 포착 후보 종목 및 퀀트 점수표')) {
            isCandidateSection = true;
            continue;
        }
        if (isCandidateSection && line.includes('[최신 뉴스 데이터]')) {
            isCandidateSection = false;
            break;
        }
        if (isCandidateSection) {
            const match = line.match(/\[\d+위\]\s+([가-힣A-Za-z0-9]+)\s*\((\d{6})\).*퀀트 종합점수:\s*(\d+)점/);
            if (match) {
                candidateList.push({
                    rank: candidateList.length + 1,
                    name: match[1],
                    code: match[2],
                    score: parseInt(match[3]),
                    raw: line.trim()
                });
            }
        }
    }

    candidateList.slice(0, 10).forEach(c => {
        console.log(`[${c.rank}위] ${c.name} (${c.code}) - 퀀트 종합점수: ${c.score}점`);
    });
    console.log(`... (총 ${candidateList.length}개 종목 1차 선정 완료) ...\n`);

    // 3. Show how Pass 1 Prompt is structured
    console.log("----------------------------------------------------------------");
    console.log("🧠 [PASS 1] AI INPUT: 1차 선정 프롬프트 (주도 테마 및 1차 타겟 종목 추출)");
    console.log("----------------------------------------------------------------");
    console.log(`이 25개 후보 리스트와 현재 매크로(환율, 금리), 실시간 뉴스를 결합하여 Gemini AI에 전달합니다.`);
    console.log(`\n[Pass 1 프롬프트 핵심 부분 발췌 (삼성전자 기준)]:`);
    
    const samsungLine = candidateList.find(c => c.name === '삼성전자');
    if (samsungLine) {
        console.log(`\n  "${samsungLine.raw}"`);
        // Print next few lines from selectionPrompt showing Samsung's submetrics
        const idx = lines.findIndex(l => l.includes('삼성전자 (005930)'));
        if (idx !== -1) {
            for (let i = 1; i <= 6; i++) {
                if (lines[idx + i]) console.log(`    ${lines[idx + i].trim()}`);
            }
        }
    }
    console.log("\n  ...(중략)...");
    console.log("  [출력 형식 가이드]: { \"theme\": \"주도 테마명\", \"candidates\": [\"삼성전자\", \"셀트리온\"] }\n");

    // 4. Show Pass 1 Output
    console.log("----------------------------------------------------------------");
    console.log("📩 [PASS 1 OUTPUT] 1차 AI 판단 결과");
    console.log("----------------------------------------------------------------");
    console.log(`Gemini AI가 25개 종목 중 매크로/테마 분석을 거쳐 최종 분석 후보 1~3개를 선정해 반환한 결과:`);
    console.log(`{\n  "theme": "글로벌 리스크 온 및 외국인/기관 대형주 순매수",\n  "candidates": ["삼성전자"]\n}\n`);

    // 5. Show Pass 2 Prompt Structure
    console.log("----------------------------------------------------------------");
    console.log("🧠 [PASS 2] AI INPUT: 2차 최종 리포트 및 투자지표 산출 프롬프트");
    console.log("----------------------------------------------------------------");
    console.log(`1차로 압축된 종목(예: 삼성전자)에 대해 상세 실시간 가격, ATR 기반 리스크 지표 등을 추가 주입합니다.`);
    
    const finalLines = finalPrompt.split('\n');
    const targetIdx = finalLines.findIndex(l => l.includes('[최종 심층 분석 대상 종목 데이터]'));
    if (targetIdx !== -1) {
        console.log(`\n[Pass 2 프롬프트에 주입된 최종 심층 데이터]:`);
        for (let i = 0; i < 20; i++) {
            if (finalLines[targetIdx + i]) {
                console.log(`  ${finalLines[targetIdx + i]}`);
            }
        }
    }
    console.log("\n  ...(중략)...");
    console.log("  [지시사항]: 위 데이터를 바탕으로 최종 TOP PICK 1종목을 확정하고 목표가, 손절가, 진입 논리, 리스크 시나리오를 한글로 구체적으로 작성할 것.\n");

    console.log("================================================================");
    console.log("✅ PIPELINE INJECTION FLOW DIAGNOSTIC COMPLETE");
    console.log("================================================================");
}

simulate();
