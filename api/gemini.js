import { GoogleGenAI } from "@google/genai";
import store from './store.js';

async function callGemini(keyword, apiKey) {
  const ai = new GoogleGenAI({ apiKey: apiKey });
  
  const prompt = `최근 구글 트렌드와 검색 데이터를 바탕으로 '${keyword}'에 대한 대중의 관심도 변화와 특징을 분석해줘. 영화 기획자 관점에서 요약해줘.`;
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }]
    }
  });

  return {
    text: response.text,
    candidates: response.candidates
  };
}

export default async function handler(req, res) {
  console.log("[GEMINI] function started");
  
  try {
    // Debug GET check
    if (req.method === "GET" && req.query?.debug === "1") {
      return res.status(200).json({
        ok: true,
        route: "gemini",
        debug: {
          hasApiKey: !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)
        }
      });
    }

    const rawKeyword = req.query.keyword || "AI";
    const keyword = rawKeyword.trim().toLowerCase();
    
    console.log(`[GEMINI] Request: keyword=${keyword}`);

    // 1. Check Firestore Cache
    try {
      const cachedInsight = await store.getGeminiInsight(keyword);
      if (cachedInsight) {
        console.log(`[GEMINI] Serving from Firestore cache: ${keyword}`);
        return res.status(200).json({
          ok: true,
          source: "cache",
          data: cachedInsight
        });
      }
    } catch (cacheError) {
      console.error("[GEMINI] Cache read error:", cacheError.message);
    }

    // 2. Gemini Call
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    console.log("[GEMINI] has API Key:", !!apiKey);

    if (!apiKey) {
      return res.status(500).json({ 
        ok: false,
        error: "Gemini API Key is not configured on the server." 
      });
    }

    console.log(`[GEMINI] Generating new insight for: ${keyword}`);
    const result = await callGemini(keyword, apiKey);

    // Extract grounding URLs
    let urls = [];
    const chunks = result.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (chunks) {
      urls = chunks
        .filter((c) => c.web)
        .map((c) => ({ title: c.web.title || '출처', uri: c.web.uri }));
    }

    const data = {
      keyword: keyword,
      insight: result.text,
      urls: urls,
      candidates: result.candidates,
      updatedAt: new Date().toISOString()
    };

    // Save to Firestore cache
    try {
      await store.setGeminiInsight(keyword, result.text, urls);
    } catch (cacheWriteError) {
      console.error("[GEMINI] Cache write error:", cacheWriteError.message);
    }

    return res.status(200).json({
      ok: true,
      source: "gemini",
      data
    });
  } catch (error) {
    console.error("[GEMINI] Internal API error:", error.message);
    
    // Handle Rate Limit (429)
    if (error.message?.includes("429") || error.message?.includes("RESOURCE_EXHAUSTED")) {
      return res.status(429).json({
        ok: false,
        error: "무료 호출 제한입니다. 10분 뒤에 다시 시도해주세요.",
        detail: error.message
      });
    }

    return res.status(500).json({
      ok: false,
      error: "Internal API error",
      detail: error?.message || String(error)
    });
  }
}
