import { aiModel } from '../lib/ai.js';

console.log("Calling Gemini API...");
const start = Date.now();
aiModel.generateContent({
    contents: [{ role: 'user', parts: [{ text: "Say hello!" }] }]
})
.then(res => {
    console.log("✅ Gemini Success! Response:", res.response.text().trim());
    console.log(`Latency: ${(Date.now() - start) / 1000}s`);
})
.catch(err => {
    console.error("❌ Gemini Failed:", err.message);
});
