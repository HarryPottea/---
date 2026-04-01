import { GoogleGenAI } from "@google/genai";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { prompt, config } = req.body;
  
  // Debugging logs for environment variables
  console.log("GEMINI_API_KEY exists:", !!process.env.GEMINI_API_KEY);
  console.log("GOOGLE_API_KEY exists:", !!process.env.GOOGLE_API_KEY);

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    console.error("Gemini API Key missing in environment");
    return res.status(500).json({ 
      error: "Gemini API Key is not configured on the server." 
    });
  }

  console.log(`Gemini Request: prompt=${prompt?.substring(0, 50)}...`);

  try {
    const ai = new GoogleGenAI({ apiKey: apiKey });
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
