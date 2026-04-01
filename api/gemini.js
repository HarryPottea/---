import { GoogleGenAI } from "@google/genai";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { prompt, config } = req.body;
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

  if (!GEMINI_API_KEY) {
    console.error("Gemini API Key missing in environment");
    return res.status(500).json({ error: 'Gemini API Key is not configured on the server.' });
  }

  console.log(`Gemini Request: prompt=${prompt.substring(0, 50)}...`);

  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: config
    });
    
    res.status(200).json({ 
      text: response.text,
      candidates: response.candidates 
    });
  } catch (error) {
    console.error("Gemini Error:", error.message);
    res.status(500).json({ error: error.message });
  }
}
