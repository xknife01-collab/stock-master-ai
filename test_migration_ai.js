import { VertexAI } from '@google-cloud/vertexai';
import dotenv from 'dotenv';
dotenv.config();

async function testNewProject() {
  const vertexAI = new VertexAI({
    project: process.env.GOOGLE_CLOUD_PROJECT,
    location: process.env.GOOGLE_CLOUD_REGION,
  });

  const model = vertexAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
  });

  try {
    const result = await model.generateContent('Say "Migration Successful"');
    console.log('Result:', result.response.candidates[0].content.parts[0].text);
  } catch (e) {
    console.error('Migration Test Failed:', e.message);
  }
}

testNewProject();
