import dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;

async function listModels() {
  try {
    const response = await fetch(url);
    const data = await response.json();
    console.log('Models Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('List models error:', error);
  }
}

listModels();
