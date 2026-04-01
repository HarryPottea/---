import store from './store.js';
import { safeFetch } from './utils.js';

const KOBIS_KEY = process.env.KOBIS_API_KEY || "57e44523cc7bbb91b7c1fc2fd37b3ca4";
const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID || "Rx0q2Y7SHyMOmmSghFGL";
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || "Fb2BDCQKu5";

function getYesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

// Recommendation Score Calculation
function calculateScore(movie, trendData) {
  const todayScore = Number(movie.audiCnt) / 10000; // Normalized
  const dayChangeRate = Number(movie.audiChange || 0) / 100; // Normalized
  const trendScore = trendData ? trendData.ratio / 10 : 0; // Normalized
  
  const score = (todayScore * 0.4) + (dayChangeRate * 0.3) + (trendScore * 0.3);
  return Math.min(Math.round(score * 10), 100);
}

// Trend State Determination
function determineTrendState(movie, trendData) {
  const audiChange = Number(movie.audiChange || 0);
  if (audiChange > 50) return "급상승";
  if (audiChange > 10) return "상승 중";
  if (audiChange < -50) return "하락 중";
  if (audiChange < -10) return "하락 중";
  return "유지";
}

// Reason Text Generation
function generateReasonText(movie, trendData) {
  const audiChange = Number(movie.audiChange || 0);
  if (audiChange > 50) return "전일 대비 관객수가 폭발적으로 증가했습니다.";
  if (audiChange > 10) return "전일 대비 관객수가 상승 흐름을 보이고 있습니다.";
  if (trendData && trendData.ratio > 50) return "네이버 검색 트렌드에서 높은 관심도를 보이고 있습니다.";
  return "박스오피스 상위권을 유지하며 안정적인 트렌드를 보이고 있습니다.";
}

export default async function handler(req, res) {
  console.log("[COLLECT] function started");
  const targetDt = getYesterday();
  const today = getToday();

  try {
    // 1. Fetch KOBIS Daily Box Office
    const kobisUrl = `https://www.kobis.or.kr/kobisopenapi/webservice/rest/boxoffice/searchDailyBoxOfficeList.json?key=${KOBIS_KEY}&targetDt=${targetDt}`;
    const kobisResult = await safeFetch(kobisUrl, {}, "[COLLECT-KOBIS]");
    
    if (!kobisResult.ok) {
      return res.status(kobisResult.status || 500).json(kobisResult);
    }
    
    const boxOfficeList = kobisResult.data.boxOfficeResult?.dailyBoxOfficeList || [];
    
    // Store in Firestore
    try {
      await store.setBoxOffice(targetDt, boxOfficeList);
    } catch (cacheError) {
      console.error("[COLLECT] KOBIS Cache error:", cacheError.message);
    }

    // 2. Fetch Naver Trends for top 5 movies
    const recommendations = [];
    for (const movie of boxOfficeList.slice(0, 5)) {
      const keyword = movie.movieNm;
      
      // Fetch Naver Trend
      let trendData = null;
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
            startDate: "2026-03-01",
            endDate: today,
            timeUnit: "date",
            keywordGroups: [{ groupName: keyword, keywords: [keyword] }]
          })
        }, `[COLLECT-NAVER-${keyword}]`);
        
        if (naverResult.ok && naverResult.data.results?.[0]?.data) {
          const results = naverResult.data.results[0].data;
          trendData = results[results.length - 1]; // Latest data
          
          // Store trend data in Firestore
          if (trendData) {
            await store.setKeywordTrend(keyword, trendData.period, trendData.ratio);
          }
        }
      } catch (e) {
        console.error(`[COLLECT] Naver Trend Error for ${keyword}:`, e.message);
      }

      const score = calculateScore(movie, trendData);
      const state = determineTrendState(movie, trendData);
      const reason = generateReasonText(movie, trendData);

      recommendations.push({
        keyword,
        recommendationScore: score,
        trendState: state,
        reasonText: reason,
        sourceSummary: ["kobis-boxoffice", trendData ? "naver-trend" : null].filter(Boolean)
      });
    }

    // Store recommendations in Firestore
    try {
      await store.setRecommendedKeywords(recommendations);
    } catch (cacheError) {
      console.error("[COLLECT] Recommendations Cache error:", cacheError.message);
    }

    return res.status(200).json({ ok: true, message: "Data collected and stored.", data: recommendations });
  } catch (error) {
    console.error("[COLLECT] Internal API error:", error.message);
    return res.status(500).json({
      ok: false,
      error: "Internal API error",
      detail: error?.message || String(error)
    });
  }
}
