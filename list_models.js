import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

async function listModels() {
  try {
    const result = await genAI.listModels();
    console.log('Available models:');
    result.models.forEach((model) => {
      console.log(`${model.name} (${model.supportedGenerationMethods})`);
    });
  } catch (error) {
    console.error('Error listing models:', error);
  }
}

listModels();
