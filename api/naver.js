import { safeFetch } from './utils.js';

export default async function handler(req, res) {
  console.log("[NAVER] function started");
  
  try {
    // Health check
    if (req.query?.health === "1") {
      return res.status(200).json({
        ok: true,
        route: "naver"
      });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    }
    
    const { body } = req.body;
    const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID || "Rx0q2Y7SHyMOmmSghFGL";
    const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || "Fb2BDCQKu5";
    
    console.log("[NAVER] has NAVER_CLIENT_ID:", !!process.env.NAVER_CLIENT_ID);
    console.log("[NAVER] has NAVER_CLIENT_SECRET:", !!process.env.NAVER_CLIENT_SECRET);
    
    const keyword = body.keywordGroups?.[0]?.groupName;
    console.log(`[NAVER] Request: keyword=${keyword}`);

    // 2. Fetch from Naver (Pure lookup, no cache)
    const url = "https://openapi.naver.com/v1/datalab/search";
    const result = await safeFetch(url, {
      method: 'POST',
      headers: {
        "X-Naver-Client-Id": NAVER_CLIENT_ID,
        "X-Naver-Client-Secret": NAVER_CLIENT_SECRET,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body)
    }, "[NAVER]");

    if (!result.ok) {
      return res.status(result.status || 500).json(result);
    }

    const data = result.data;
    return res.status(200).json({
      ok: true,
      ...data
    });
  } catch (error) {
    console.error("[NAVER] Internal API error:", error.message);
    return res.status(500).json({
      ok: false,
      error: "Internal API error",
      detail: error?.message || String(error)
    });
  }
}
