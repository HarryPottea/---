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
  const rawKeyword = req.query.keyword || "AI";
  const keyword = rawKeyword.trim().toLowerCase();
  
  try {
    // 1. Check Firestore Cache
    const cachedInsight = await store.getGeminiInsight(keyword);
    if (cachedInsight) {
      console.log(`Serving from Firestore cache: ${keyword}`);
      return res.json({
        ok: true,
        source: "cache",
        data: cachedInsight
      });
    }

    // 2. Gemini Call
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    if (!apiKey) {
      console.error("Gemini API Key missing in environment");
      return res.status(500).json({ 
        ok: false,
        error: "Gemini API Key is not configured on the server." 
      });
    }

    console.log(`Generating new insight for: ${keyword}`);
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
    await store.setGeminiInsight(keyword, result.text, urls);

    return res.json({
      ok: true,
      source: "gemini",
      data
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
