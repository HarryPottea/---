import store from './store.js';

export default async function handler(req, res) {
  console.log("[RECOMMENDED] function started");
  
  try {
    // Health check
    if (req.query?.health === "1") {
      return res.status(200).json({
        ok: true,
        route: "recommended-keywords"
      });
    }

    if (req.method !== 'GET') {
      return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    }

    console.log("[RECOMMENDED] fetching today's recommended keywords");

    // Fetch from Firestore via store
    try {
      let recommendations = await store.getRecommendedKeywords();

      // If no recommendations found, it might be because they haven't been generated today
      // The store.getRecommendedKeywords() currently just gets top 10 regardless of date
      // But we can add a check or log here.
      
      console.log("[RECOMMENDED] result count:", recommendations.length);

      if (!recommendations || recommendations.length === 0) {
        console.log("[RECOMMENDED] No recommendations found in database");
        return res.status(200).json({
          ok: true,
          count: 0,
          data: [],
          message: "추천 키워드 데이터가 아직 생성되지 않았습니다. 데이터 수집 버튼을 눌러주세요."
        });
      }

      return res.status(200).json({
        ok: true,
        count: recommendations.length,
        data: recommendations
      });
    } catch (storeError) {
      console.error("[RECOMMENDED] Store read error:", storeError.message);
      return res.status(500).json({
        ok: false,
        error: "Database read error",
        detail: storeError.message
      });
    }
  } catch (error) {
    console.error("[RECOMMENDED] Internal API error:", error.message);
    return res.status(500).json({
      ok: false,
      error: "Internal API error",
      detail: error?.message || String(error)
    });
  }
}
