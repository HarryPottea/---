import { safeFetch } from './utils.js';

export default async function handler(req, res) {
  console.log("[KOBIS] function started");
  
  try {
    // Health check
    if (req.query?.health === "1") {
      return res.status(200).json({
        ok: true,
        route: "kobis"
      });
    }

    const { targetDt } = req.query;
    const KOBIS_KEY = process.env.KOBIS_API_KEY || "57e44523cc7bbb91b7c1fc2fd37b3ca4";
    
    console.log("[KOBIS] has KOBIS_API_KEY:", !!process.env.KOBIS_API_KEY);
    console.log(`[KOBIS] Request: targetDt=${targetDt}`);
    
    if (!targetDt) {
      return res.status(400).json({ ok: false, error: "targetDt is required" });
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
    
    // Enrich with genres (Pure lookup, no cache)
    const enrichedList = await Promise.all(dailyList.map(async (movie) => {
      try {
        const infoUrl = `https://www.kobis.or.kr/kobisopenapi/webservice/rest/movie/searchMovieInfo.json?key=${KOBIS_KEY}&movieCd=${movie.movieCd}`;
        const infoResult = await safeFetch(infoUrl, {}, `[KOBIS-INFO-${movie.movieNm}]`);
        
        if (infoResult.ok && infoResult.data.movieInfoResult?.movieInfo) {
          const genres = infoResult.data.movieInfoResult.movieInfo.genres || [];
          const genre = genres.map(g => g.genreNm).join(', ');
          return { ...movie, genre };
        }
        return movie;
      } catch (e) {
        console.error(`[KOBIS] Error fetching info for ${movie.movieNm}:`, e.message);
        return movie;
      }
    }));
    
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
