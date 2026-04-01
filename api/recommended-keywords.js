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

    // Fetch from Firestore via store
    try {
      const recommendations = await store.getRecommendedKeywords();

      if (!recommendations || recommendations.length === 0) {
        console.log("[RECOMMENDED] No recommendations found");
        return res.status(200).json({
          ok: true,
          data: [],
          message: "No recommendations found. Please run /api/collect-trends first."
        });
      }

      console.log(`[RECOMMENDED] Found ${recommendations.length} recommendations`);
      return res.status(200).json({
        ok: true,
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
