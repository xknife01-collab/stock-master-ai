import { GoogleGenerativeAI } from '@google/generative-ai';
import { VertexAI } from '@google-cloud/vertexai';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🔧 [Vertex AI Credentials Auto-resolution]
// 1. Check if credential JSON contents are passed via env variable (best practice for cloud like Render)
if (process.env.GOOGLE_CREDENTIALS_JSON) {
    try {
        const tempCredPath = path.join(os.tmpdir(), 'vertex-credentials.json');
        fs.writeFileSync(tempCredPath, process.env.GOOGLE_CREDENTIALS_JSON, 'utf8');
        process.env.GOOGLE_APPLICATION_CREDENTIALS = tempCredPath;
        console.log(`🔑 Set Vertex Credentials from GOOGLE_CREDENTIALS_JSON -> ${tempCredPath}`);
    } catch (e) {
        console.error("❌ Failed to write GOOGLE_CREDENTIALS_JSON:", e.message);
    }
} 
// 2. Check if the credential JSON file exists in the root folder
else {
    const localJsonPath = path.join(__dirname, '../stock-ai-22968-fb038f8d1e7f.json');
    if (fs.existsSync(localJsonPath)) {
        process.env.GOOGLE_APPLICATION_CREDENTIALS = localJsonPath;
        console.log(`🔑 Set Vertex Credentials from local root file -> ${localJsonPath}`);
    } else {
        console.warn("⚠️ Vertex AI credentials file not found in root.");
    }
}

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

