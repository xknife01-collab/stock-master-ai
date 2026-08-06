import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

async function listModels() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    try {
        // We can't easily list models with the SDK without a direct fetch or specific method
        // But we can try the most common names
        const names = ['gemini-1.5-flash', 'gemini-1.5-flash-latest', 'gemini-1.0-pro'];
        for (const name of names) {
            try {
                const model = genAI.getGenerativeModel({ model: name });
                const result = await model.generateContent('Hi');
                console.log(`✅ ${name} works!`);
                return;
            } catch (e) {
                console.log(`❌ ${name} failed: ${e.message}`);
            }
        }
    } catch (e) {
        console.error('List failed:', e.message);
    }
}

listModels();
