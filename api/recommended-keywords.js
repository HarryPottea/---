import store from './store.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // Fetch from Firestore via store
    const recommendations = await store.getRecommendedKeywords();

    if (!recommendations || recommendations.length === 0) {
      return res.status(200).json({
        ok: true,
        data: [],
        message: "No recommendations found. Please run /api/collect-trends first."
      });
    }

    res.status(200).json({
      ok: true,
      data: recommendations
    });
  } catch (error) {
    console.error("Recommended Keywords Error:", error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
}
