import { GoogleGenAI } from "@google/genai";

export const config = {
  api: {
    bodyParser: true,
  },
};

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

const MODEL_NAME = "gemini-2.5-flash-preview-09-2025";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).send("Method Not Allowed");

  if (!ai) {
    console.error("API key missing!");
    return res.status(500).json({ error: "Missing GEMINI_API_KEY." });
  }

  const { history, prompt, systemInstruction } = req.body || {};
  if (!prompt)
    return res.status(400).json({ error: 'Missing "prompt" field.' });

  try {
    // Fix: ensure every history item has a parts array
    const contents = [
      ...(history || []).map(item => ({
        role: item.role,
        parts: item.parts || [{ text: item.text || "" }],
      })),
      { role: "user", parts: [{ text: prompt }] },
    ];

    const result = await ai.models.generateContent(MODEL_NAME, {
      contents,
      systemInstruction,
      generationConfig: {
        temperature: 0.5,
      },
    });

    const text =
      result?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "No content generated.";

    return res.status(200).json({ text });
  } catch (e) {
    console.error("Gemini ERROR:", e);
    return res.status(500).json({
      error: "Internal Server Error during model processing.",
      details: e.message,
    });
  }
}
