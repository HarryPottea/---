import { GoogleGenAI } from "@google/genai";

// In-memory cache (Note: Vercel serverless functions may recycle this, but it helps with immediate bursts)
const store = new Map();

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

async function callGemini(keyword, apiKey, type = "insight") {
  const ai = new GoogleGenAI({ apiKey: apiKey });
  
  let prompt = "";
  if (type === "trending") {
    prompt = "현재 한국에서 영화 기획에 참고할 만한 가장 핫한 트렌드 키워드 8개를 뽑아줘. 콤마(,)로 구분해서 키워드만 출력해줘. 예: 좀비,AI,로맨스,복수";
  } else {
    prompt = `최근 구글 트렌드와 검색 데이터를 바탕으로 '${keyword}'에 대한 대중의 관심도 변화와 특징을 분석해줘. 영화 기획자 관점에서 요약해줘.`;
  }
  
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
  const type = req.query.type || "insight";
  const rawKeyword = req.query.keyword || "AI";
  const keyword = rawKeyword.trim().toLowerCase();
  const today = getToday();
  
  // Cache key depends on type and keyword
  const key = type === "trending" ? `trending_${today}` : `${keyword}_${today}`;

  // 1. Check Cache
  if (store.has(key)) {
    console.log(`Serving from server cache: ${key}`);
    return res.json({
      ok: true,
      source: "cache",
      data: store.get(key)
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

  try {
    console.log(`Generating new ${type} for: ${keyword}`);
    const result = await callGemini(keyword, apiKey, type);

    const data = {
      keyword: type === "trending" ? "trending" : keyword,
      date: today,
      insight: result.text,
      candidates: result.candidates,
      createdAt: Date.now()
    };

    // Save to cache
    store.set(key, data);

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
        error: "무료 호출 제한입니다. 오늘 생성된 데이터가 없습니다. 잠시 후 다시 시도해주세요."
      });
    }

    res.status(500).json({ 
      ok: false,
      error: "Gemini 분석 중 오류가 발생했습니다." 
    });
  }
}
