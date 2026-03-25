import { GoogleGenerativeAI } from '@google/generative-ai';
import { VertexAI } from '@google-cloud/vertexai';
import dotenv from 'dotenv';
dotenv.config();

// Google Gemini API (API Studio) Setup
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
export const aiModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// Google Vertex AI (Cloud) Setup
const vertexAI = new VertexAI({
    project: process.env.GOOGLE_CLOUD_PROJECT,
    location: process.env.GOOGLE_CLOUD_REGION
});
export const vertexModel = vertexAI.getGenerativeModel({ model: "gemini-2.5-flash" });
