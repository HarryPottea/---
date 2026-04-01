import axios from 'axios';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  
  const { body } = req.body;
  const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID || "Rx0q2Y7SHyMOmmSghFGL";
  const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || "Fb2BDCQKu5";

  console.log(`Naver Request: body=${JSON.stringify(body)}`);

  try {
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
    res.status(200).json(response.data);
  } catch (error) {
    console.error("Naver Error:", error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ 
      error: error.response?.data?.errorMessage || error.message 
    });
  }
}
