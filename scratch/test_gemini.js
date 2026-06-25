import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

console.log("Using API Key:", process.env.GEMINI_API_KEY ? "Present (starts with " + process.env.GEMINI_API_KEY.slice(0, 5) + ")" : "Missing");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const start = Date.now();
console.log("Calling Gemini API...");

model.generateContent({
    contents: [{ role: 'user', parts: [{ text: "Hello! Reply with OK if you receive this." }] }],
    generationConfig: { responseMimeType: "text/plain" }
})
.then(result => {
    const duration = ((Date.now() - start) / 1000).toFixed(2);
    console.log(`✅ Success in ${duration} seconds!`);
    console.log("Response text:", result.response.text().trim());
})
.catch(err => {
    console.error("❌ Failed:", err.message);
});
