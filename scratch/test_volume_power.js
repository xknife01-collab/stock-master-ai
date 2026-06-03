import { fetchStockInvestorTrend } from '../lib/kisCore.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const testInvestorTrend = async () => {
    const symbol = '005935'; // 삼성전자우
    console.log(`🔍 [Test] 삼성전자우(${symbol}) 실시간 투자자 동향 조회 중...`);
    
    const result = await fetchStockInvestorTrend(symbol);
    console.log(`결과 요약 (rawSummary):`, result.rawSummary);
    console.log(`결과 수치 (stats):`, JSON.stringify(result.stats, null, 2));
};

testInvestorTrend();
