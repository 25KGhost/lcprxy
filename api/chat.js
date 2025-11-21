import { GoogleGenAI } from "@google/genai";

export const config = {
  api: {
    bodyParser: true,
  },
};

// ✅ Safely read API key
const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

// Model to use
const MODEL_NAME = "gemini-2.5-flash-preview";

export default async function handler(req, res) {
  // CORS headers for your mentor HTML
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  if (!ai) {
    console.error("API key missing!");
    return res.status(500).json({ error: "Missing GEMINI_API_KEY." });
  }

  const { history = [], prompt, systemInstruction } = req.body || {};

  if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
    return res.status(400).json({ error: 'Missing or invalid "prompt" field.' });
  }

  // Ensure systemInstruction is defined
  const systemPrompt = systemInstruction && systemInstruction.trim() !== ""
    ? systemInstruction
    : "You are an elite, highly constrained business mentor focused ONLY on providing surgical, tactical advice for founders and executives on business growth, scaling, and operational efficiency. Deliver short, actionable advice only.";

  try {
    // Build contents safely: system, previous assistant messages, user
    const contents = [
      { role: "system", parts: [{ text: systemPrompt }] },
      ...history
        .filter(msg => msg && msg.role && msg.parts && Array.isArray(msg.parts))
        .map(msg => ({
          role: msg.role,
          parts: msg.parts
            .filter(p => p && typeof p.text === "string")
            .map(p => ({ text: p.text }))
        }))
        .filter(msg => msg.parts.length > 0), // skip empty messages
      { role: "user", parts: [{ text: prompt }] }
    ];

    // Final safety check
    if (contents.length === 0) {
      throw new Error("No valid contents to send to Gemini.");
    }

    // Call Gemini safely
    const result = await ai.models.generateContent(MODEL_NAME, { contents, generationConfig: { temperature: 0.5 } });

    // Extract text safely
    const text =
      result?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      "No content generated.";

    return res.status(200).json({ text });

  } catch (err) {
    console.error("Gemini ERROR:", err);
    // Always return JSON with status 500, never crash
    return res.status(500).json({
      error: "Internal Server Error during model processing.",
      details: err.message || "Unknown error",
    });
  }
}
