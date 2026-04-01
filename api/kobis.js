import axios from 'axios';
import store from './store.js';

export default async function handler(req, res) {
  const { targetDt } = req.query;
  const KOBIS_KEY = process.env.KOBIS_API_KEY || "57e44523cc7bbb91b7c1fc2fd37b3ca4";
  
  console.log(`KOBIS Request: targetDt=${targetDt}`);
  
  try {
    // 1. Check Firestore Cache
    const cachedData = await store.getBoxOffice(targetDt);
    if (cachedData) {
      console.log(`Serving KOBIS from Firestore cache: ${targetDt}`);
      return res.status(200).json({
        boxOfficeResult: {
          dailyBoxOfficeList: cachedData
        }
      });
    }

    // 2. Fetch from KOBIS
    const response = await axios.get(
      `https://www.kobis.or.kr/kobisopenapi/webservice/rest/boxoffice/searchDailyBoxOfficeList.json`,
      { params: { key: KOBIS_KEY, targetDt } }
    );
    
    if (response.data.faultInfo) {
      console.error("KOBIS API Fault:", response.data.faultInfo.message);
      return res.status(400).json({ error: response.data.faultInfo.message });
    }
    
    const dailyList = response.data.boxOfficeResult?.dailyBoxOfficeList || [];
    
    // Enrich with genres
    const enrichedList = await Promise.all(dailyList.map(async (movie) => {
      try {
        // Check cache first
        const meta = await store.getMovieMeta(movie.movieNm);
        if (meta && meta.genre) {
          return { ...movie, genre: meta.genre };
        }

        // Fetch from Movie Info API
        const infoRes = await axios.get(
          `https://www.kobis.or.kr/kobisopenapi/webservice/rest/movie/searchMovieInfo.json`,
          { params: { key: KOBIS_KEY, movieCd: movie.movieCd } }
        );
        
        const genres = infoRes.data.movieInfoResult?.movieInfo?.genres || [];
        const genre = genres.map(g => g.genreNm).join(', ');
        
        // Save to cache
        await store.setMovieMeta(movie.movieNm, { genre });
        
        return { ...movie, genre };
      } catch (e) {
        console.error(`Error fetching info for ${movie.movieNm}:`, e.message);
        return movie;
      }
    }));
    
    // Save to Firestore cache
    if (enrichedList.length > 0) {
      await store.setBoxOffice(targetDt, enrichedList);
    }
    
    res.status(200).json({
      boxOfficeResult: {
        dailyBoxOfficeList: enrichedList
      }
    });
  } catch (error) {
    console.error("KOBIS Error:", error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data?.error || error.message });
  }
}
