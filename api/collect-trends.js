import store from './store.js';
import { safeFetch } from './utils.js';
import geminiHandler from './gemini.js';
import seedKeywordData from '../data/seed-keywords.json' with { type: 'json' };

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID || "Rx0q2Y7SHyMOmmSghFGL";
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || "Fb2BDCQKu5";

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function getStartDate(days = 30) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function flattenSeedKeywords() {
  return seedKeywordData.categories.flatMap(category =>
    category.keywords.map(keyword => ({
      keyword,
      category: category.name
    }))
  );
}

function calculateTrendScore(series) {
  if (!series || series.length === 0) return 0;

  const ratios = series.map(item => Number(item.ratio || 0));
  const latest = ratios[ratios.length - 1] || 0;
  const previous = ratios[ratios.length - 2] || latest || 0;
  const recentWindow = ratios.slice(-7);
  const recentAverage = recentWindow.length > 0
    ? recentWindow.reduce((sum, value) => sum + value, 0) / recentWindow.length
    : latest;

  const momentum = latest - previous;
  const lift = recentAverage > 0 ? ((latest - recentAverage) / recentAverage) * 100 : 0;

  const score = (latest * 0.6) + (momentum * 1.5) + (lift * 0.25);
  return Math.max(0, Math.min(100, Math.round(score)));
}

function determineTrendState(series) {
  if (!series || series.length < 2) return "유지";
  const latest = Number(series[series.length - 1]?.ratio || 0);
  const previous = Number(series[series.length - 2]?.ratio || 0);
  const diff = latest - previous;

  if (diff >= 8) return "급상승";
  if (diff >= 2) return "상승 중";
  if (diff <= -8) return "급하락";
  if (diff <= -2) return "하락 중";
  return "유지";
}

function generateReasonText(keyword, category, series) {
  if (!series || series.length === 0) {
    return `${category} 분야에서 꾸준히 관찰할 만한 관심 키워드입니다.`;
  }

  const latest = Number(series[series.length - 1]?.ratio || 0);
  const previous = Number(series[series.length - 2]?.ratio || 0);
  const diff = latest - previous;

  if (diff >= 8) {
    return `최근 검색량이 빠르게 상승 중인 ${category} 관심사입니다.`;
  }
  if (diff >= 2) {
    return `${category} 관련 관심이 꾸준히 커지고 있는 흐름입니다.`;
  }
  if (latest >= 60) {
    return `현재 대중 관심도가 높은 ${category} 키워드입니다.`;
  }
  return `${category} 맥락에서 기획 아이디어로 확장해볼 만한 관심사입니다.`;
}

async function autoGenerateInsights(keywords) {
  const results = [];

  for (const keyword of keywords) {
    const cached = await store.getGeminiInsight(keyword);
    if (cached?.insight) {
      results.push({ keyword, source: 'cache' });
      continue;
    }

    const req = { query: { keyword } };
    let statusCode = 200;
    let payload = null;
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(body) {
        payload = body;
        return body;
      }
    };

    await geminiHandler(req, res);
    results.push({ keyword, statusCode, source: payload?.source || 'generated' });
  }

  return results;
}

export default async function handler(req, res) {
  console.log("[COLLECT] function started");

  if (req.query?.health === "1") {
    return res.status(200).json({
      ok: true,
      route: "collect-trends"
    });
  }

  const today = getToday();
  const startDate = getStartDate(30);
  const keywordPool = flattenSeedKeywords();

  try {
    const trends = [];
    const recommendations = [];

    for (const item of keywordPool) {
      const { keyword, category } = item;

      try {
        const naverUrl = "https://openapi.naver.com/v1/datalab/search";
        const naverResult = await safeFetch(naverUrl, {
          method: 'POST',
          headers: {
            "X-Naver-Client-Id": NAVER_CLIENT_ID,
            "X-Naver-Client-Secret": NAVER_CLIENT_SECRET,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            startDate,
            endDate: today,
            timeUnit: "date",
            keywordGroups: [{ groupName: keyword, keywords: [keyword] }]
          })
        }, `[COLLECT-NAVER-${keyword}]`);

        if (!naverResult.ok || !naverResult.data.results?.[0]?.data) {
          continue;
        }

        const series = naverResult.data.results[0].data || [];
        const latest = series[series.length - 1];
        if (!latest) continue;

        await store.setKeywordTrend(keyword, latest.period, latest.ratio);
        trends.push({ keyword, category, latestRatio: latest.ratio, latestPeriod: latest.period });

        const recommendationScore = calculateTrendScore(series);
        if (recommendationScore < 15) continue;

        recommendations.push({
          keyword,
          recommendationScore,
          trendState: determineTrendState(series),
          reasonText: generateReasonText(keyword, category, series),
          sourceSummary: ["seed-keywords", "naver-trend", category],
          date: today
        });
      } catch (e) {
        console.error(`[COLLECT] Naver Trend Error for ${keyword}:`, e.message);
      }
    }

    const topRecommendations = recommendations
      .sort((a, b) => b.recommendationScore - a.recommendationScore)
      .slice(0, 12);

    console.log("[COLLECT] trends count:", trends.length);
    console.log("[COLLECT] recommended count:", topRecommendations.length);
    if (topRecommendations.length > 0) {
      console.log("[COLLECT] sample recommended:", topRecommendations[0]);
    }

    const autoInsightTargets = topRecommendations.slice(0, 3).map(item => item.keyword);
    let autoInsightResults = [];
    try {
      autoInsightResults = await autoGenerateInsights(autoInsightTargets);
    } catch (insightError) {
      console.error("[COLLECT] Auto insight generation error:", insightError.message);
    }

    let saveOk = true;
    let saveError = '';

    try {
      await store.setRecommendedKeywords(topRecommendations);
    } catch (cacheError) {
      console.error("[COLLECT] Recommendations Cache error:", cacheError.message);
      saveOk = false;
      saveError = cacheError.message;
    }

    return res.status(200).json({
      ok: true,
      message: "Interest keywords collected and stored.",
      collectedCount: trends.length,
      recommendedCount: topRecommendations.length,
      saveOk,
      saveError,
      autoInsightCount: autoInsightResults.length,
      autoInsightResults,
      recommendedSample: topRecommendations.slice(0, 5)
    });
  } catch (error) {
    console.error("[COLLECT] Internal API error:", error.message);
    return res.status(500).json({
      ok: false,
      error: "Internal API error",
      detail: error?.message || String(error)
    });
  }
}
