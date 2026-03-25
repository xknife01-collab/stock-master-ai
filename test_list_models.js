import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

async function listModels() {
    const key = process.env.GEMINI_API_KEY;
    try {
        const response = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        console.log('Available Models:', response.data.models.map(m => m.name));
    } catch (e) {
        console.error('List Failed:', e.response?.data || e.message);
    }
}

listModels();
