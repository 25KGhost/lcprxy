import { GoogleGenAI } from "@google/genai";

export const config = {
  api: {
    bodyParser: true,
  },
};

const apiKey = process.env.GEMINI_API_KEY;
console.log("API key exists:", !!apiKey);

const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

// Use a stable / supported model name — you may adjust to the correct Gemini model version:
const MODEL_NAME = "gemini-2.5-flash-preview-09-2025";

export default async function handler(req, res) {
  // CORS headers to allow cross-origin from your front-end
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  if (!ai) {
    console.error("API key missing or AI client not initialized");
    return res.status(500).json({ error: "Missing GEMINI_API_KEY or AI client not initialized." });
  }

  const { history, prompt, systemInstruction } = req.body || {};

  if (typeof prompt !== "string" || prompt.trim() === "") {
    return res.status(400).json({ error: 'Invalid or missing "prompt" field.' });
  }

  // Defensive building of contents
  const safeHistory = Array.isArray(history)
    ? history.map((item, index) => {
        // Ensure item is an object
        const role = (item && typeof item.role === "string") ? item.role : "user";
        // Normalize parts
        let parts;
        if (Array.isArray(item.parts)) {
          parts = item.parts.map(p => {
            return { text: typeof (p && p.text) === "string" ? p.text : "" };
          });
        } else if (typeof item.text === "string") {
          parts = [{ text: item.text }];
        } else {
          parts = [{ text: "" }];
        }
        return { role, parts };
      })
    : [];

  // Always include the user's current prompt as the final part
  const userContent = { role: "user", parts: [{ text: prompt }] };

  // Optional systemInstruction normalization
  let safeSystemInstruction = null;
  if (systemInstruction) {
    // systemInstruction might be string or object with parts
    if (typeof systemInstruction === "string") {
      safeSystemInstruction = { role: "system", parts: [{ text: systemInstruction }] };
    } else if (typeof systemInstruction === "object") {
      const sysParts = Array.isArray(systemInstruction.parts)
        ? systemInstruction.parts.map(p => ({ text: typeof p.text === "string" ? p.text : "" }))
        : [{ text: typeof systemInstruction.text === "string" ? systemInstruction.text : "" }];
      safeSystemInstruction = { role: systemInstruction.role || "system", parts: sysParts };
    }
  }

  const contents = safeSystemInstruction
    ? [safeSystemInstruction, ...safeHistory, userContent]
    : [...safeHistory, userContent];

  // Log the final contents so we can debug if something is off
  console.log("Final contents sent to Gemini:", JSON.stringify(contents, null, 2));

  try {
    const result = await ai.models.generateContent(MODEL_NAME, {
      contents,
      systemInstruction: undefined, // already included in contents if provided
      generationConfig: {
        temperature: 0.5,
        // You can add additional config like maxOutputTokens, topP, etc.
      },
    });

    // Verify result structure safely
    const text =
      result &&
      Array.isArray(result.candidates) &&
      result.candidates[0] &&
      result.candidates[0].content &&
      Array.isArray(result.candidates[0].content.parts) &&
      typeof result.candidates[0].content.parts[0].text === "string"
        ? result.candidates[0].content.parts[0].text
        : null;

    if (text === null) {
      console.error("Invalid response structure from Gemini:", JSON.stringify(result));
      return res.status(500).json({ error: "Invalid response from model.", details: result });
    }

    return res.status(200).json({ text });
  } catch (e) {
    console.error("Gemini ERROR:", e);
    return res.status(500).json({
      error: "Internal Server Error during model processing.",
      details: e.message || String(e),
    });
  }
}
