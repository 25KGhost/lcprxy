import { GoogleGenAI } from "@google/genai";

// 1. Initialize the GoogleGenAI client
// The API key is securely loaded from the environment variable (VERCEL_ENV_VAR)
const apiKey = process.env.GEMINI_API_KEY; 

// Initialize AI client only if the key is available
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;
// --- FINAL FIX APPLIED HERE: USING THE FULL, STABLE MODEL STRING ---
const MODEL_NAME = "gemini-2.5-flash-preview-09-2025"; 

// 2. Export the main serverless function
export default async function (req, res) {
    // 3. Set necessary headers for cross-origin requests
    res.setHeader('Access-Control-Allow-Origin', '*'); // Allows ALL domains
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

    const method = req.method ? req.method.toUpperCase() : 'UNKNOWN';

    // Handle preflight OPTIONS request
    if (method === 'OPTIONS') {
        return res.status(200).end();
    }

    // 4. Enforce POST Method (Case-insensitive check)
    if (method !== 'POST') {
        return res.status(405).send('Method Not Allowed. Only POST is accepted.');
    }
    
    // 5. API Key Check
    if (!ai) {
        console.error("Missing GEMINI_API_KEY. AI client not initialized.");
        return res.status(500).json({ error: 'Server configuration error: Missing API key.' });
    }

    // 6. Parse Request Body
    let data;
    try {
        const body = req.body || {};
        data = typeof body === 'string' ? JSON.parse(body) : body; 
    } catch (e) {
        return res.status(400).json({ error: 'Invalid JSON payload received.' });
    }
    
    // We expect history (array), prompt (string), and systemInstruction (string)
    const { history, prompt, systemInstruction } = data;

    if (!prompt) {
        return res.status(400).json({ error: 'Missing "prompt" field in the request body.' });
    }

    try {
        // 7. Construct the full Gemini payload
        const contents = [
            ...(history || []),
            { role: "user", parts: [{ text: prompt }] }
        ];

        // 8. Make the secure API call
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: contents,
            config: {
                systemInstruction: systemInstruction || "", 
                temperature: 0.5 
            },
        });

        // 9. Send the response back to the client
        res.status(200).json({
            text: response.text,
        });

    } catch (error) {
        console.error("Gemini API Error (POST failure):", error);
        // Log the exact error for future debugging, but send a user-friendly error to the client
        res.status(500).json({ 
            error: 'Internal Server Error during model processing.', 
            details: error.message 
        });
    }
}
