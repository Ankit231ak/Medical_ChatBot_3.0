import dotenv from 'dotenv';
dotenv.config();

async function run() {
  try {
    const key = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
    const data = await response.json();
    if (data.models) {
      console.log('Available models:', data.models.map(m => m.name).join('\n'));
    } else {
      console.log('Unexpected response:', data);
    }
  } catch (e) {
    console.log("Error:", e.message);
  }
}
run();
