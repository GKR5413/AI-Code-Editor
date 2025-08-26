import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function testGeminiFormats() {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  const chat = model.startChat({});
  
  console.log('Testing different sendMessage formats...\n');
  
  // Test 1: String format
  try {
    console.log('Test 1: String format');
    const result1 = await chat.sendMessage('Hello');
    console.log('✅ String format works');
    console.log('Response:', result1.response.text());
  } catch (error) {
    console.log('❌ String format failed:', error.message);
  }
  
  // Test 2: Array of parts format
  try {
    console.log('\nTest 2: Array of parts format');
    const result2 = await chat.sendMessage([{ text: 'What is 2+2?' }]);
    console.log('✅ Array of parts format works');
    console.log('Response:', result2.response.text());
  } catch (error) {
    console.log('❌ Array of parts format failed:', error.message);
  }
  
  // Test 3: Current incorrect format (what's failing)
  try {
    console.log('\nTest 3: Current incorrect format');
    const result3 = await chat.sendMessage([
      { role: 'user', parts: [{ text: 'What is 3+3?' }] }
    ]);
    console.log('✅ Incorrect format somehow works');
  } catch (error) {
    console.log('❌ Incorrect format failed:', error.message);
  }
}

testGeminiFormats().catch(console.error);