import { GoogleGenAI } from "@google/genai";
import store from './store.js';

function inferKeywordCategory(keyword) {
  const map = [
    { category: '사회·세대', keywords: ['입시', '취업', '육아', '세대', '가족', '교육'] },
    { category: '장르·정서', keywords: ['공포', '추리', '로맨스', '스릴러', '코미디', '감동'] },
    { category: '기술·미래', keywords: ['메타버스', '감시사회', 'ai', '인공지능', '로봇', '우주'] },
    { category: '라이프스타일', keywords: ['캠핑', '반려동물', '여행', '다이어트', '운동', '패션'] },
    { category: '사회 이슈', keywords: ['전쟁', '정치', '범죄', '재난', '갈등'] }
  ];

  const normalized = String(keyword || '').toLowerCase();
  const found = map.find(item => item.keywords.some(entry => normalized.includes(entry)));
  return found?.category || '일반 관심사';
}

function buildFallbackInsight(keyword) {
  const category = inferKeywordCategory(keyword);

  const whyMap = {
    '사회·세대': '불확실한 현실에서 삶의 방향과 생존 전략을 찾으려는 심리가 커질 때 반응하는 키워드입니다. 개인의 선택이 미래를 바꿀 수 있다는 기대와 압박이 함께 작동합니다.',
    '장르·정서': '익숙한 현실에서 벗어나 강한 감정 자극을 얻고 싶을 때 주목도가 올라가는 흐름입니다. 긴장감, 몰입감, 감정 해소 욕구가 동시에 반영됩니다.',
    '기술·미래': '다가올 변화에 대한 기대와 불안을 동시에 건드리는 키워드라 반응이 큽니다. 사람들은 기술 자체보다 그것이 내 삶을 어떻게 바꿀지에 더 민감하게 반응합니다.',
    '라이프스타일': '일상의 질을 조금이라도 개선하고 싶은 욕구가 선명할 때 힘을 받는 관심사입니다. 취향 소비와 자기관리, 작은 행복에 대한 니즈가 같이 읽힙니다.',
    '사회 이슈': '현실 불안과 집단적 긴장이 높아질수록 즉각적으로 관심이 커지는 유형입니다. 정보 확인 욕구뿐 아니라 감정적 해석과 의견 표출 욕구도 함께 붙습니다.',
    '일반 관심사': '최근 대중의 시선이 모이는 이유는 지금의 감정 흐름과 맞닿아 있기 때문입니다. 단순 정보보다 자기 삶과 연결해 해석할 포인트가 있을 때 반응이 커집니다.'
  };

  const pointMap = {
    '사회·세대': '단순 설명보다 지금 사람들이 왜 이 문제를 자기 일처럼 느끼는지 드러내는 기획이 좋습니다. 불안, 경쟁, 관계의 압박을 구체적인 캐릭터와 상황으로 번역해야 합니다.',
    '장르·정서': '장르적 재미만 강조하지 말고 지금 대중이 해소하고 싶은 감정을 함께 설계하는 게 중요합니다. 감정선이 선명한 캐릭터와 빠른 몰입 구조가 잘 맞습니다.',
    '기술·미래': '기술 설정 자체보다 인간관계, 윤리, 생존 같은 현실적 질문으로 연결해야 힘이 생깁니다. 거대한 담론보다 개인 단위의 체감형 이야기로 좁히는 편이 효과적입니다.',
    '라이프스타일': '정보 나열보다 실제로 따라 해보고 싶게 만드는 구체성이 중요합니다. 루틴, 변화 전후, 작은 성취 같은 체험형 포인트를 살리는 구성이 유리합니다.',
    '사회 이슈': '이슈 설명보다 그 안에서 드러나는 감정 구조와 인간 군상을 잡아내야 콘텐츠 확장성이 생깁니다. 선악 구도보다 현실적인 딜레마를 보여주는 접근이 좋습니다.',
    '일반 관심사': '키워드 자체보다 사람들이 이 주제를 통해 무엇을 확인받고 싶은지 먼저 잡아야 합니다. 공감 포인트와 실질적 효용을 함께 제시하는 구성이 안전합니다.'
  };

  const toneMap = {
    '사회·세대': '현실 밀착형 드라마, 다큐멘터리, 공감형 토크 포맷이 잘 맞습니다. 과장보다는 진정성과 구체성이 있는 톤이 유효합니다.',
    '장르·정서': '스릴러, 미스터리, 감정 몰입형 드라마처럼 감각적으로 끌고 갈 수 있는 장르가 적합합니다. 톤은 선명하되 과도한 설명은 줄이는 편이 좋습니다.',
    '기술·미래': 'SF 스릴러, 근미래 드라마, 하이컨셉 예능 실험 포맷으로 확장하기 좋습니다. 차갑기만 하기보다 인간적인 체온을 남기는 톤이 효과적입니다.',
    '라이프스타일': '브이로그, 체험형 예능, 휴먼 다큐, 정보형 숏폼과 잘 맞습니다. 가볍지만 얄팍하지 않은 생활 밀착 톤이 어울립니다.',
    '사회 이슈': '리얼리즘 드라마, 시사 모티프 스릴러, 관찰형 다큐가 적합합니다. 자극보다 밀도 있는 긴장감을 유지하는 톤이 좋습니다.',
    '일반 관심사': '공감형 다큐, 정보형 예능, 휴먼스토리 포맷으로 풀어내기 좋습니다. 설명적이기보다 맥락을 자연스럽게 체감시키는 톤이 적합합니다.'
  };

  return `👀 왜 반응하는가\n${whyMap[category]}\n\n🎬 기획 포인트\n${pointMap[category]}\n\n🎭 장르/톤 제안\n${toneMap[category]}`;
}

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

    const rawKeyword = req.query.keyword || "AI";
    const keyword = String(rawKeyword).trim().toLowerCase();
    const fallbackInsight = buildFallbackInsight(keyword);
    const detail = error?.message || String(error);
    const isRateLimited = detail?.includes("429") || detail?.includes("RESOURCE_EXHAUSTED");

    console.log(`[GEMINI] Returning fallback insight for: ${keyword}`);

    return res.status(200).json({
      ok: true,
      source: isRateLimited ? "fallback-rate-limit" : "fallback",
      data: {
        keyword,
        insight: fallbackInsight,
        urls: [],
        candidates: [],
        updatedAt: new Date().toISOString(),
        fallback: true,
        fallbackReason: isRateLimited ? "rate-limit" : "generation-error"
      },
      warning: isRateLimited
        ? "Gemini 무료 호출 제한으로 대체 인사이트를 반환했습니다."
        : "Gemini 호출 오류로 대체 인사이트를 반환했습니다.",
      detail
    });
  }
}
