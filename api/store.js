import { supabase } from './supabase.js';

const store = {
  // Box Office Data
  async getBoxOffice(date) {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from('boxoffice_daily')
        .select('movies')
        .eq('date', date)
        .single();
      
      if (error) {
        if (error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
          console.error("[STORE] getBoxOffice error:", error.message);
        }
        return null;
      }
      return data ? data.movies : null;
    } catch (e) {
      console.error("[STORE] getBoxOffice error:", e.message);
      return null;
    }
  },
  async setBoxOffice(date, movies) {
    if (!supabase) return;
    try {
      const { error } = await supabase
        .from('boxoffice_daily')
        .upsert({
          date,
          movies,
          updatedat: new Date().toISOString()
        }, { onConflict: 'date' });
      
      if (error) console.error("[STORE] setBoxOffice error:", error.message);
    } catch (e) {
      console.error("[STORE] setBoxOffice error:", e.message);
    }
  },

  // Movie Metadata
  async getMovieMeta(movieNm) {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from('movie_meta')
        .select('*')
        .eq('movieNm', movieNm)
        .single();
      
      if (error) {
        if (error.code !== 'PGRST116') {
          console.error("[STORE] getMovieMeta error:", error.message);
        }
        return null;
      }
      return data;
    } catch (e) {
      console.error("[STORE] getMovieMeta error:", e.message);
      return null;
    }
  },
  async setMovieMeta(movieNm, meta) {
    if (!supabase) return;
    try {
      const { error } = await supabase
        .from('movie_meta')
        .upsert({
          ...meta,
          movieNm,
          updatedat: new Date().toISOString()
        }, { onConflict: 'movieNm' });
      
      if (error) console.error("[STORE] setMovieMeta error:", error.message);
    } catch (e) {
      console.error("[STORE] setMovieMeta error:", e.message);
    }
  },

  // Keyword Trends
  async getKeywordTrends(keyword) {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from('keyword_trends')
        .select('*')
        .eq('keyword', keyword)
        .order('date', { ascending: false })
        .limit(30);
      
      if (error) {
        console.error("[STORE] getKeywordTrends error:", error.message);
        return [];
      }
      return data ? data.reverse() : [];
    } catch (e) {
      console.error("[STORE] getKeywordTrends error:", e.message);
      return [];
    }
  },
  async setKeywordTrend(keyword, date, ratio) {
    if (!supabase) return;
    try {
      const id = `${keyword}_${date}`;
      const { error } = await supabase
        .from('keyword_trends')
        .upsert({
          id,
          keyword,
          date,
          ratio,
          updatedat: new Date().toISOString()
        }, { onConflict: 'id' });
      
      if (error) console.error("[STORE] setKeywordTrend error:", error.message);
    } catch (e) {
      console.error("[STORE] setKeywordTrend error:", e.message);
    }
  },

  // Recommended Keywords
  async getRecommendedKeywords(date = null) {
    if (!supabase) return [];
    try {
      const targetDate = date || new Date().toISOString().slice(0, 10);
      let query = supabase
        .from('recommended_keywords')
        .select('*')
        .eq('date', targetDate)
        .order('recommendationscore', { ascending: false })
        .limit(10);

      let { data, error } = await query;

      if (error) {
        console.error("[STORE] getRecommendedKeywords error:", error.message);
        return [];
      }

      if ((!data || data.length === 0) && !date) {
        console.log(`[STORE] No recommendations for ${targetDate}, falling back to latest records`);
        const fallback = await supabase
          .from('recommended_keywords')
          .select('*')
          .order('updatedat', { ascending: false })
          .limit(10);

        if (fallback.error) {
          console.error("[STORE] getRecommendedKeywords fallback error:", fallback.error.message);
          return [];
        }
        data = fallback.data || [];
      }

      return (data || []).map(item => ({
        id: item.id,
        keyword: item.keyword,
        date: item.date,
        recommendationScore: item.recommendationscore,
        trendState: item.trendstate,
        reasonText: item.reasontext,
        sourceSummary: item.sourcesummary,
        updatedAt: item.updatedat
      }));
    } catch (e) {
      console.error("[STORE] getRecommendedKeywords error:", e.message);
      return [];
    }
  },
  async setRecommendedKeywords(keywords) {
    if (!supabase) return;
    try {
      const rows = keywords.map(item => ({
        id: `${item.keyword}_${item.date}`,
        keyword: item.keyword,
        date: item.date,
        recommendationscore: item.recommendationScore,
        trendstate: item.trendState,
        reasontext: item.reasonText,
        sourcesummary: item.sourceSummary,
        updatedat: new Date().toISOString()
      }));

      const first = rows[0];
      const hasDate = rows.every(item => !!item.date);

      if (hasDate && first) {
        const targetDate = first.date;
        const existing = await supabase
          .from('recommended_keywords')
          .select('keyword, date')
          .eq('date', targetDate);

        if (existing.error) {
          console.error("[STORE] setRecommendedKeywords existing-read error:", existing.error.message);
        } else {
          const incomingKeywords = new Set(rows.map(item => item.keyword));
          const staleKeywords = (existing.data || [])
            .map(item => item.keyword)
            .filter(keyword => !incomingKeywords.has(keyword));

          if (staleKeywords.length > 0) {
            const del = await supabase
              .from('recommended_keywords')
              .delete()
              .eq('date', targetDate)
              .in('keyword', staleKeywords);

            if (del.error) {
              console.error("[STORE] setRecommendedKeywords cleanup error:", del.error.message);
            }
          }
        }
      }

      const { error } = await supabase
        .from('recommended_keywords')
        .upsert(rows, { onConflict: 'id' });

      if (error) {
        console.error("[STORE] setRecommendedKeywords error:", error.message);
      }
    } catch (e) {
      console.error("[STORE] setRecommendedKeywords error:", e.message);
    }
  },

  // Gemini Insights Cache
  async getGeminiInsight(keyword) {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from('gemini_insights')
        .select('*')
        .eq('keyword', keyword)
        .single();
      
      if (error) {
        if (error.code !== 'PGRST116') {
          console.error("[STORE] getGeminiInsight error:", error.message);
        }
        return null;
      }

      if (data) {
        const updatedAt = new Date(data.updatedat);
        const now = new Date();
        // Cache for 24 hours
        if (now.getTime() - updatedAt.getTime() < 24 * 60 * 60 * 1000) {
          return {
            keyword: data.keyword,
            insight: data.insight,
            urls: data.urls,
            updatedAt: data.updatedat
          };
        }
      }
    } catch (e) {
      console.error("[STORE] getGeminiInsight error:", e.message);
    }
    return null;
  },
  async setGeminiInsight(keyword, insight, urls = []) {
    if (!supabase) return;
    try {
      const { error } = await supabase
        .from('gemini_insights')
        .upsert({
          keyword,
          insight,
          urls,
          updatedat: new Date().toISOString()
        }, { onConflict: 'keyword' });
      
      if (error) console.error("[STORE] setGeminiInsight error:", error.message);
    } catch (e) {
      console.error("[STORE] setGeminiInsight error:", e.message);
    }
  }
};

export default store;
