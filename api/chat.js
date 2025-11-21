import { GoogleGenAI } from "@google/genai";

export const config = {
  api: {
    bodyParser: true,
  },
};

// ✅ Get API key from environment
const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

// Check model name (Gemini 2.5 Flash Preview)
const MODEL_NAME = "gemini-2.5-flash-preview";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  if (!ai) {
    console.error("API key missing!");
    return res.status(500).json({ error: "Missing GEMINI_API_KEY." });
  }

  const { history, prompt, systemInstruction } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'Missing "prompt" field.' });

  try {
    // Prepare final contents: only system + user
    const contents = [
      {
        role: "system",
        parts: [{ text: systemInstruction || "" }],
      },
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ];

    console.log("Final contents sent to Gemini:", JSON.stringify(contents, null, 2));

    // Call Gemini model
    const result = await ai.models.generateContent(MODEL_NAME, {
      contents,
      generationConfig: { temperature: 0.5 },
    });

    const text =
      result?.candidates?.[0]?.content?.parts?.[0]?.text || "No content generated.";

    return res.status(200).json({ text });
  } catch (e) {
    console.error("Gemini ERROR:", e);
    return res.status(500).json({
      error: "Internal Server Error during model processing.",
      details: e.message,
    });
  }
}
