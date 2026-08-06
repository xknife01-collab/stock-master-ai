import { VertexAI } from '@google-cloud/vertexai';
import dotenv from 'dotenv';
dotenv.config();

async function testMultiple() {
  const regions = ['us-central1', 'asia-northeast3'];
  const models = ['gemini-1.5-flash', 'gemini-1.0-pro'];

  for (const region of regions) {
    for (const modelName of models) {
      console.log(`--- Testing ${modelName} in ${region} ---`);
      const vertexAI = new VertexAI({
        project: process.env.GOOGLE_CLOUD_PROJECT,
        location: region,
      });

      const model = vertexAI.getGenerativeModel({
        model: modelName,
      });

      try {
        const result = await model.generateContent('Hi');
        console.log(`✅ Success in ${region} with ${modelName}`);
        return;
      } catch (e) {
        console.error(`❌ Failed: ${e.message}`);
      }
    }
  }
}

testMultiple();
