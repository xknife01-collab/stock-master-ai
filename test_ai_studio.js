import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

async function testAiStudio() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    try {
        const result = await model.generateContent('Say "AI Studio Working"');
        console.log('Result:', result.response.text());
    } catch (e) {
        console.error('AI Studio Test Failed:', e.message);
    }
}

testAiStudio();
