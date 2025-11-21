// api/chat.js
import { GoogleGenAI } from "@google/genai";

// 1. Initialize the GoogleGenAI client
// The API key is securely loaded from the environment variable (VERCEL_ENV_VAR)
const ai = new GoogleGenAI({ 
    apiKey: process.env.GEMINI_API_KEY 
});

// 2. Export the main serverless function
export default async function handler(req, res) {
  // Ensure the request is a POST request
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  // Set necessary headers for cross-origin requests
  res.setHeader('Access-Control-Allow-Origin', '*'); // Allows all origins
  res.setHeader('Content-Type', 'application/json');

  try {
    const { history, prompt } = req.body;

    if (!history || !prompt) {
        return res.status(400).json({ error: 'Missing history or prompt in request body.' });
    }

    // Combine history and new prompt into contents array
    const contents = [...history, { role: "user", parts: [{ text: prompt }] }];
    
    // 3. Make the secure API call
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", // Use the model you need
      contents: contents,
    });

    // 4. Send the response back to the client
    res.status(200).json({
      text: response.text,
      // You can add other response fields if needed
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      error: 'Model request failed on the server.', 
      details: error.message 
    });
  }
}