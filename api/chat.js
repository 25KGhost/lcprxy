import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

const MODEL_NAME = "gemini-2.5-flash-preview";

export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    if (req.method !== "POST") {
        return res.status(405).send("Method Not Allowed. Only POST accepted.");
    }

    if (!ai) {
        console.error("Missing GEMINI_API_KEY");
        return res.status(500).json({ error: "Missing API key on server." });
    }

    let data;
    try {
        data = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    } catch (err) {
        return res.status(400).json({ error: "Invalid JSON body." });
    }

    const { history, prompt, systemInstruction } = data;

    if (!prompt) {
        return res.status(400).json({ error: 'Missing "prompt" field.' });
    }

    try {
        const contents = [
            ...(history || []),
            {
                role: "user",
                parts: [{ text: prompt }],
            },
        ];

        const result = await ai.models.generateContent({
            model: MODEL_NAME,
            contents,
            config: {
                systemInstruction: systemInstruction || "",
                temperature: 0.5,
            },
        });

        // ⭐ Correct extraction of model output ⭐
        const output =
            result?.candidates?.[0]?.content?.parts?.[0]?.text ||
            "No response generated.";

        return res.status(200).json({ text: output });

    } catch (err) {
        console.error("Gemini API Error:", err);
        return res.status(500).json({
            error: "Internal Server Error during model processing.",
            details: err.message,
        });
    }
}
