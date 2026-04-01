import { GoogleGenAI } from "@google/genai";

// In-memory cache (Note: Vercel serverless functions may recycle this, but it helps with immediate bursts)
const cache = new Map();
const CACHE_DURATION = 600000; // 10 minutes

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  const { prompt, config } = req.body;
  const now = Date.now();

  // Check cache
  const cacheKey = JSON.stringify({ prompt, config });
  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    if (now - cached.timestamp < CACHE_DURATION) {
      console.log("Serving from server cache");
      return res.status(200).json({
        ok: true,
        source: "cache",
        ...cached.data
      });
    } else {
      cache.delete(cacheKey);
    }
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    console.error("Gemini API Key missing in environment");
    return res.status(500).json({ 
      ok: false,
      error: "Gemini API Key is not configured on the server." 
    });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: config
    });
    
    const result = {
      text: response.text,
      candidates: response.candidates 
    };

    // Save to cache
    cache.set(cacheKey, {
      timestamp: now,
      data: result
    });

    res.status(200).json({ 
      ok: true,
      source: "gemini",
      ...result
    });
  } catch (error) {
    console.error("Gemini Error:", error.message);
    
    // Handle Rate Limit (429)
    if (error.message?.includes("429") || error.message?.includes("RESOURCE_EXHAUSTED")) {
      return res.status(429).json({
        ok: false,
        error: "무료 호출 제한입니다. 10분 뒤에 다시 시도해주세요."
      });
    }

    res.status(500).json({ 
      ok: false,
      error: "Gemini 분석 중 오류가 발생했습니다." 
    });
  }
}
