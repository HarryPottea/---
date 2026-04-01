import axios from 'axios';
import store from './store.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  
  const { body } = req.body;
  const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID || "Rx0q2Y7SHyMOmmSghFGL";
  const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || "Fb2BDCQKu5";

  const keyword = body.keywordGroups?.[0]?.groupName;

  console.log(`Naver Request: keyword=${keyword}`);

  try {
    // 1. Check Firestore Cache
    if (keyword) {
      const cachedTrends = await store.getKeywordTrends(keyword);
      if (cachedTrends && cachedTrends.length > 0) {
        console.log(`Serving Naver from Firestore cache: ${keyword}`);
        return res.status(200).json({
          results: [{
            title: keyword,
            data: cachedTrends
          }]
        });
      }
    }

    // 2. Fetch from Naver
    const response = await axios.post(
      "https://openapi.naver.com/v1/datalab/search",
      body,
      {
        headers: {
          "X-Naver-Client-Id": NAVER_CLIENT_ID,
          "X-Naver-Client-Secret": NAVER_CLIENT_SECRET,
          "Content-Type": "application/json",
        },
      }
    );

    // Save to Firestore cache
    if (response.data.results?.[0]?.data) {
      const trendData = response.data.results[0].data;
      for (const item of trendData) {
        await store.setKeywordTrend(keyword, item.period, item.ratio);
      }
    }

    res.status(200).json(response.data);
  } catch (error) {
    console.error("Naver Error:", error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ 
      error: error.response?.data?.errorMessage || error.message 
    });
  }
}
