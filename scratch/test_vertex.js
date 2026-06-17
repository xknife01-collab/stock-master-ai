import { vertexModel } from '../lib/ai.js';

console.log("Calling Vertex AI API...");
const start = Date.now();
if (!vertexModel) {
    console.error("❌ Vertex Model is not initialized!");
    process.exit(1);
}
vertexModel.generateContent({
    contents: [{ role: 'user', parts: [{ text: "Say hello!" }] }]
})
.then(res => {
    console.log("✅ Vertex Success! Response:", res.response.candidates[0].content.parts[0].text.trim());
    console.log(`Latency: ${(Date.now() - start) / 1000}s`);
})
.catch(err => {
    console.error("❌ Vertex Failed:", err.message);
});
