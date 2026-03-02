import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });
const apiKey = process.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
    console.error('Missing key');
    process.exit(1);
}

const ai = new GoogleGenerativeAI(apiKey);

async function testSingleModel(modelName: string) {
    console.log(`Testing model: ${modelName}`);
    try {
        const model = ai.getGenerativeModel({ model: modelName });
        const result = await model.generateContent('Hi');
        console.log(`✅ Success! Response: ${result.response.text()}`);
    } catch (e: any) {
        console.log(`❌ Error: ${e.message}`);
    }
}

async function run() {
    await testSingleModel('gemini-2.5-pro');
    await testSingleModel('gemini-2.5-flash');
    await testSingleModel('gemini-1.5-flash');
    await testSingleModel('gemini-1.5-pro');
}

run();
