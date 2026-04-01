import { db } from './firebase-admin.js';

const store = {
  // Box Office Data
  async getBoxOffice(date) {
    if (!db) return null;
    try {
      const doc = await db.collection('boxoffice_daily').doc(date).get();
      return doc.exists ? doc.data().movies : null;
    } catch (e) {
      console.error("[STORE] getBoxOffice error:", e.message);
      return null;
    }
  },
  async setBoxOffice(date, movies) {
    if (!db) return;
    try {
      await db.collection('boxoffice_daily').doc(date).set({
        date,
        movies,
        updatedAt: new Date().toISOString()
      });
    } catch (e) {
      console.error("[STORE] setBoxOffice error:", e.message);
    }
  },

  // Movie Metadata
  async getMovieMeta(movieNm) {
    if (!db) return null;
    try {
      const doc = await db.collection('movie_meta').doc(movieNm).get();
      return doc.exists ? doc.data() : null;
    } catch (e) {
      console.error("[STORE] getMovieMeta error:", e.message);
      return null;
    }
  },
  async setMovieMeta(movieNm, meta) {
    if (!db) return;
    try {
      await db.collection('movie_meta').doc(movieNm).set({
        ...meta,
        updatedAt: new Date().toISOString()
      });
    } catch (e) {
      console.error("[STORE] setMovieMeta error:", e.message);
    }
  },

  // Keyword Trends
  async getKeywordTrends(keyword) {
    if (!db) return [];
    try {
      const snapshot = await db.collection('keyword_trends')
        .where('keyword', '==', keyword)
        .orderBy('date', 'desc')
        .limit(30)
        .get();
      return snapshot.docs.map(doc => doc.data()).reverse();
    } catch (e) {
      console.error("[STORE] getKeywordTrends error:", e.message);
      return [];
    }
  },
  async setKeywordTrend(keyword, date, ratio) {
    if (!db) return;
    try {
      const id = `${keyword}_${date}`;
      await db.collection('keyword_trends').doc(id).set({
        keyword,
        date,
        ratio,
        updatedAt: new Date().toISOString()
      });
    } catch (e) {
      console.error("[STORE] setKeywordTrend error:", e.message);
    }
  },

  // Recommended Keywords
  async getRecommendedKeywords() {
    if (!db) return [];
    try {
      const snapshot = await db.collection('recommended_keywords')
        .orderBy('recommendationScore', 'desc')
        .limit(10)
        .get();
      return snapshot.docs.map(doc => doc.data());
    } catch (e) {
      console.error("[STORE] getRecommendedKeywords error:", e.message);
      return [];
    }
  },
  async setRecommendedKeywords(keywords) {
    if (!db) return;
    try {
      const batch = db.batch();
      for (const item of keywords) {
        const ref = db.collection('recommended_keywords').doc(item.keyword);
        batch.set(ref, {
          ...item,
          updatedAt: new Date().toISOString()
        });
      }
      await batch.commit();
    } catch (e) {
      console.error("[STORE] setRecommendedKeywords error:", e.message);
    }
  },

  // Gemini Insights Cache
  async getGeminiInsight(keyword) {
    if (!db) return null;
    try {
      const doc = await db.collection('gemini_insights').doc(keyword).get();
      if (doc.exists) {
        const data = doc.data();
        const updatedAt = new Date(data.updatedAt);
        const now = new Date();
        // Cache for 24 hours
        if (now.getTime() - updatedAt.getTime() < 24 * 60 * 60 * 1000) {
          return data;
        }
      }
    } catch (e) {
      console.error("[STORE] getGeminiInsight error:", e.message);
    }
    return null;
  },
  async setGeminiInsight(keyword, insight, urls = []) {
    if (!db) return;
    try {
      await db.collection('gemini_insights').doc(keyword).set({
        keyword,
        insight,
        urls,
        updatedAt: new Date().toISOString()
      });
    } catch (e) {
      console.error("[STORE] setGeminiInsight error:", e.message);
    }
  }
};

export default store;
