import { GoogleAuth } from 'google-auth-library';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let googleAuthInstance = null;

const getGoogleAuth = () => {
    if (googleAuthInstance) return googleAuthInstance;

    // 1. Check if GOOGLE_CREDENTIALS_JSON env variable is passed
    if (process.env.GOOGLE_CREDENTIALS_JSON) {
        try {
            const tempCredPath = path.join(os.tmpdir(), 'vertex-credentials.json');
            fs.writeFileSync(tempCredPath, process.env.GOOGLE_CREDENTIALS_JSON, 'utf8');
            process.env.GOOGLE_APPLICATION_CREDENTIALS = tempCredPath;
        } catch (e) {
            console.error("❌ [Vertex REST] Failed to write GOOGLE_CREDENTIALS_JSON:", e.message);
        }
    } 
    // 2. Check if local root service account file exists
    else {
        const localJsonPath = path.join(__dirname, '../stock-ai-22968-fb038f8d1e7f.json');
        if (fs.existsSync(localJsonPath)) {
            process.env.GOOGLE_APPLICATION_CREDENTIALS = localJsonPath;
        }
    }

    try {
        googleAuthInstance = new GoogleAuth({
            keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
            scopes: [
                'https://www.googleapis.com/auth/cloud-platform',
                'https://www.googleapis.com/auth/generative-language'
            ]
        });
        return googleAuthInstance;
    } catch (e) {

        console.error("❌ [Vertex REST] GoogleAuth initialization failed:", e.message);
        return null;
    }
};

/**
 * Executes a Gemini model call via direct Google Cloud Vertex AI REST API
 * Bypasses deprecated SDK bugs and API Studio free tier quota limits.
 * 
 * @param {string} prompt - Text prompt for Gemini
 * @param {string} modelName - Model name (e.g., 'gemini-2.5-flash', 'gemini-2.0-flash')
 * @returns {Promise<any|null>} - Parsed JSON or string response
 */
export const callVertexAiRest = async (prompt, modelName = 'gemini-flash-latest') => {


    const auth = getGoogleAuth();
    if (!auth) {
        console.warn("⚠️ [Vertex REST] Auth instance unavailable, skipping REST call.");
        return null;
    }

    try {
        const client = await auth.getClient();
        const tokenRes = await client.getAccessToken();
        const accessToken = tokenRes.token;

        if (!accessToken) {
            console.warn("⚠️ [Vertex REST] Failed to obtain OAuth access token.");
            return null;
        }

        const project = process.env.GOOGLE_CLOUD_PROJECT || "stock-ai-22968";
        const region = process.env.GOOGLE_CLOUD_REGION || "us-central1";

        const url = `https://${region}-aiplatform.googleapis.com/v1/projects/${project}/locations/${region}/publishers/google/models/${modelName}:generateContent`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: {
                    responseMimeType: "application/json"
                }
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            console.warn(`⚠️ [Vertex REST] HTTP ${response.status} for model '${modelName}': ${errText.slice(0, 200)}`);
            return null;
        }

        const data = await response.json();
        const candidate = data.candidates?.[0];
        const rawText = candidate?.content?.parts?.[0]?.text;

        if (!rawText) {
            console.warn("⚠️ [Vertex REST] Empty output received from Vertex AI.");
            return null;
        }

        try {
            return JSON.parse(rawText.trim());
        } catch (jsonErr) {
            console.log("ℹ️ [Vertex REST] Output is plain text or partial JSON:", rawText.slice(0, 100));
            return rawText.trim();
        }
    } catch (err) {
        console.error("❌ [Vertex REST] Request exception:", err.message);
        return null;
    }
};
