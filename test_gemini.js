import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

async function testGeneration() {
  try {
    const result = await model.generateContent("Hello, who are you?");
    console.log('Result:', result.response.text());
  } catch (error) {
    console.error('Error during generation:', error);
  }
}

testGeneration();
