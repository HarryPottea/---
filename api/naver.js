import store from './store.js';
import { safeFetch } from './utils.js';

export default async function handler(req, res) {
  console.log("[NAVER] function started");
  
  try {
    // Debug GET check
    if (req.method === "GET" && req.query?.debug === "1") {
      return res.status(200).json({
        ok: true,
        route: "naver",
        debug: {
          hasClientId: !!process.env.NAVER_CLIENT_ID,
          hasClientSecret: !!process.env.NAVER_CLIENT_SECRET
        }
      });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    }
    
    const { body } = req.body;
    const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID || "Rx0q2Y7SHyMOmmSghFGL";
    const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || "Fb2BDCQKu5";
    
    console.log("[NAVER] has NAVER_CLIENT_ID:", !!process.env.NAVER_CLIENT_ID);
    console.log("[NAVER] has NAVER_CLIENT_SECRET:", !!process.env.NAVER_CLIENT_SECRET);
    
    const keyword = body.keywordGroups?.[0]?.groupName;
    console.log(`[NAVER] Request: keyword=${keyword}`);

    // 1. Check Firestore Cache
    if (keyword) {
      try {
        const cachedTrends = await store.getKeywordTrends(keyword);
        if (cachedTrends && cachedTrends.length > 0) {
          console.log(`[NAVER] Serving from Firestore cache: ${keyword}`);
          return res.status(200).json({
            ok: true,
            results: [{
              title: keyword,
              data: cachedTrends
            }]
          });
        }
      } catch (cacheError) {
        console.error("[NAVER] Cache read error:", cacheError.message);
        // Continue to fetch if cache fails
      }
    }

    // 2. Fetch from Naver
    const url = "https://openapi.naver.com/v1/datalab/search";
    const result = await safeFetch(url, {
      method: 'POST',
      headers: {
        "X-Naver-Client-Id": NAVER_CLIENT_ID,
        "X-Naver-Client-Secret": NAVER_CLIENT_SECRET,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body)
    }, "[NAVER]");

    if (!result.ok) {
      return res.status(result.status || 500).json(result);
    }

    const data = result.data;
    // Save to Firestore cache
    if (data.results?.[0]?.data) {
      const trendData = data.results[0].data;
      try {
        for (const item of trendData) {
          await store.setKeywordTrend(keyword, item.period, item.ratio);
        }
      } catch (cacheWriteError) {
        console.error("[NAVER] Cache write error:", cacheWriteError.message);
      }
    }

    return res.status(200).json({
      ok: true,
      ...data
    });
  } catch (error) {
    console.error("[NAVER] Internal API error:", error.message);
    return res.status(500).json({
      ok: false,
      error: "Internal API error",
      detail: error?.message || String(error)
    });
  }
}
