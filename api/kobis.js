import store from './store.js';
import { safeFetch } from './utils.js';

export default async function handler(req, res) {
  console.log("[KOBIS] function started");
  
  try {
    // Debug GET check
    if (req.method === "GET" && req.query?.debug === "1") {
      return res.status(200).json({
        ok: true,
        route: "kobis",
        debug: {
          hasApiKey: !!process.env.KOBIS_API_KEY
        }
      });
    }

    const { targetDt } = req.query;
    const KOBIS_KEY = process.env.KOBIS_API_KEY || "57e44523cc7bbb91b7c1fc2fd37b3ca4";
    
    console.log("[KOBIS] has KOBIS_API_KEY:", !!process.env.KOBIS_API_KEY);
    console.log(`[KOBIS] Request: targetDt=${targetDt}`);
    
    if (!targetDt) {
      return res.status(400).json({ ok: false, error: "targetDt is required" });
    }

    // 1. Check Firestore Cache
    try {
      const cachedData = await store.getBoxOffice(targetDt);
      if (cachedData) {
        console.log(`[KOBIS] Serving from Firestore cache: ${targetDt}`);
        return res.status(200).json({
          ok: true,
          boxOfficeResult: {
            dailyBoxOfficeList: cachedData
          }
        });
      }
    } catch (cacheError) {
      console.error("[KOBIS] Cache read error:", cacheError.message);
      // Continue to fetch if cache fails
    }

    // 2. Fetch from KOBIS
    const url = `https://www.kobis.or.kr/kobisopenapi/webservice/rest/boxoffice/searchDailyBoxOfficeList.json?key=${KOBIS_KEY}&targetDt=${targetDt}`;
    const result = await safeFetch(url, {}, "[KOBIS]");
    
    if (!result.ok) {
      return res.status(result.status || 500).json(result);
    }
    
    const data = result.data;
    if (data.faultInfo) {
      console.error("[KOBIS] API Fault:", data.faultInfo.message);
      return res.status(400).json({ ok: false, error: data.faultInfo.message });
    }
    
    const dailyList = data.boxOfficeResult?.dailyBoxOfficeList || [];
    
    // Enrich with genres
    const enrichedList = await Promise.all(dailyList.map(async (movie) => {
      try {
        // Check cache first
        const meta = await store.getMovieMeta(movie.movieNm);
        if (meta && meta.genre) {
          return { ...movie, genre: meta.genre };
        }

        // Fetch from Movie Info API
        const infoUrl = `https://www.kobis.or.kr/kobisopenapi/webservice/rest/movie/searchMovieInfo.json?key=${KOBIS_KEY}&movieCd=${movie.movieCd}`;
        const infoResult = await safeFetch(infoUrl, {}, `[KOBIS-INFO-${movie.movieNm}]`);
        
        if (infoResult.ok && infoResult.data.movieInfoResult?.movieInfo) {
          const genres = infoResult.data.movieInfoResult.movieInfo.genres || [];
          const genre = genres.map(g => g.genreNm).join(', ');
          
          // Save to cache
          await store.setMovieMeta(movie.movieNm, { genre });
          return { ...movie, genre };
        }
        return movie;
      } catch (e) {
        console.error(`[KOBIS] Error fetching info for ${movie.movieNm}:`, e.message);
        return movie;
      }
    }));
    
    // Save to Firestore cache
    if (enrichedList.length > 0) {
      try {
        await store.setBoxOffice(targetDt, enrichedList);
      } catch (cacheWriteError) {
        console.error("[KOBIS] Cache write error:", cacheWriteError.message);
      }
    }
    
    return res.status(200).json({
      ok: true,
      boxOfficeResult: {
        dailyBoxOfficeList: enrichedList
      }
    });
  } catch (error) {
    console.error("[KOBIS] Internal API error:", error.message);
    return res.status(500).json({
      ok: false,
      error: "Internal API error",
      detail: error?.message || String(error)
    });
  }
}
