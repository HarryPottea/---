import { db } from './firebase-admin.js';

const store = {
  // Box Office Data
  async getBoxOffice(date) {
    const doc = await db.collection('boxoffice_daily').doc(date).get();
    return doc.exists ? doc.data().movies : null;
  },
  async setBoxOffice(date, movies) {
    await db.collection('boxoffice_daily').doc(date).set({
      date,
      movies,
      updatedAt: new Date().toISOString()
    });
  },

  // Movie Metadata
  async getMovieMeta(movieNm) {
    const doc = await db.collection('movie_meta').doc(movieNm).get();
    return doc.exists ? doc.data() : null;
  },
  async setMovieMeta(movieNm, meta) {
    await db.collection('movie_meta').doc(movieNm).set({
      ...meta,
      updatedAt: new Date().toISOString()
    });
  },

  // Keyword Trends
  async getKeywordTrends(keyword) {
    const snapshot = await db.collection('keyword_trends')
      .where('keyword', '==', keyword)
      .orderBy('date', 'desc')
      .limit(30)
      .get();
    return snapshot.docs.map(doc => doc.data()).reverse();
  },
  async setKeywordTrend(keyword, date, ratio) {
    const id = `${keyword}_${date}`;
    await db.collection('keyword_trends').doc(id).set({
      keyword,
      date,
      ratio,
      updatedAt: new Date().toISOString()
    });
  },

  // Recommended Keywords
  async getRecommendedKeywords() {
    const snapshot = await db.collection('recommended_keywords')
      .orderBy('recommendationScore', 'desc')
      .limit(10)
      .get();
    return snapshot.docs.map(doc => doc.data());
  },
  async setRecommendedKeywords(keywords) {
    const batch = db.batch();
    
    // Clear existing recommendations (optional, or just overwrite)
    // For simplicity, we'll just overwrite/add
    for (const item of keywords) {
      const ref = db.collection('recommended_keywords').doc(item.keyword);
      batch.set(ref, {
        ...item,
        updatedAt: new Date().toISOString()
      });
    }
    await batch.commit();
  },

  // Gemini Insights Cache
  async getGeminiInsight(keyword) {
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
    return null;
  },
  async setGeminiInsight(keyword, insight, urls = []) {
    await db.collection('gemini_insights').doc(keyword).set({
      keyword,
      insight,
      urls,
      updatedAt: new Date().toISOString()
    });
  }
};

export default store;
