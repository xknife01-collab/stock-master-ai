import { GoogleGenerativeAI } from '@google/generative-ai';
import { VertexAI } from '@google-cloud/vertexai';
import dotenv from 'dotenv';
dotenv.config();

// Google Gemini API (API Studio) Setup
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
export const aiModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// Google Vertex AI (Cloud) Setup
let vertexAIInstance = null;
let vertexModelInstance = null;

if (process.env.GOOGLE_CLOUD_PROJECT && process.env.GOOGLE_CLOUD_REGION) {
    try {
        vertexAIInstance = new VertexAI({
            project: process.env.GOOGLE_CLOUD_PROJECT,
            location: process.env.GOOGLE_CLOUD_REGION
        });
        vertexModelInstance = vertexAIInstance.getGenerativeModel({ model: "gemini-2.5-flash" });
        console.log("✅ Vertex AI initialized successfully.");
    } catch (e) {
        console.warn("⚠️ Vertex AI initialization failed (using Gemini API Studio fallback):", e.message);
    }
} else {
    console.log("ℹ️ Vertex AI env variables not configured. Using Gemini API Studio only.");
}

export const vertexModel = vertexModelInstance;

