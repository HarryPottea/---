import { GoogleGenAI } from "@google/genai";
import store from './store.js';

async function callGemini(keyword, apiKey) {
  const ai = new GoogleGenAI({ apiKey: apiKey });

  const prompt = `키워드 '${keyword}'가 대중의 현재 관심사로 떠오를 때, 이것이 시사하는 감정·욕망·사회 분위기를 콘텐츠 기획 관점에서 한국어로 500자 이내로 정리해줘.

출력 규칙:
- '**' 같은 마크다운 강조를 쓰지 말 것
- 아래 3개 섹션을 이모지 제목으로 시작할 것
- 각 섹션은 1~2문장으로 짧고 선명하게 쓸 것

형식:
👀 왜 반응하는가
...

🎬 기획 포인트
...

🎭 장르/톤 제안
...

과장 없이, 뉴스 해설이 아니라 기획 인사이트 중심으로 써줘.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt
  });

  return {
    text: response.text,
    candidates: response.candidates
  };
}

export default async function handler(req, res) {
  console.log("[GEMINI] function started");
  
  try {
    // Health check
    if (req.query?.health === "1") {
      return res.status(200).json({
        ok: true,
        route: "gemini"
      });
    }

    const rawKeyword = req.query.keyword || "AI";
    const keyword = String(rawKeyword).trim().toLowerCase();

    console.log(`[GEMINI] Request: keyword=${keyword}`);

    const cached = await store.getGeminiInsight(keyword);
    if (cached?.insight) {
      console.log(`[GEMINI] Cache hit for: ${keyword}`);
      return res.status(200).json({
        ok: true,
        source: "cache",
        data: cached
      });
    }

    // 2. Gemini Call (Cache miss)
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    console.log("[GEMINI] has API Key:", !!apiKey);
    if (apiKey) {
      console.log("[GEMINI] API Key length:", apiKey.length);
      console.log("[GEMINI] API Key starts with:", apiKey.substring(0, 5));
    }

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

    await store.setGeminiInsight(keyword, data.insight, data.urls);

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
