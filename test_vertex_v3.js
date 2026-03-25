import { VertexAI } from '@google-cloud/vertexai';
import dotenv from 'dotenv';
dotenv.config();

async function testVertex() {
  console.log("Testing Vertex AI with morning settings...");
  console.log("Project:", process.env.GOOGLE_CLOUD_PROJECT);
  console.log("Region:", process.env.GOOGLE_CLOUD_REGION);
  console.log("Credentials Path:", process.env.GOOGLE_APPLICATION_CREDENTIALS);

  try {
    const vertexAI = new VertexAI({
        project: process.env.GOOGLE_CLOUD_PROJECT,
        location: process.env.GOOGLE_CLOUD_REGION
    });
    const model = vertexAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    
    const result = await model.generateContent("Hi");
    console.log("✅ Vertex AI Success!");
    console.log(JSON.stringify(result.response, null, 2));
  } catch (error) {
    console.error("❌ Vertex AI Fail:", error.message);
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Data:", JSON.stringify(error.response.data, null, 2));
    }
  }
}

testVertex();
