import axios from 'axios';

export default async function handler(req, res) {
  const { targetDt } = req.query;
  const KOBIS_KEY = process.env.KOBIS_API_KEY || "57e44523cc7bbb91b7c1fc2fd37b3ca4";
  
  console.log(`KOBIS Request: targetDt=${targetDt}`);
  
  try {
    const response = await axios.get(
      `https://www.kobis.or.kr/kobisopenapi/webservice/rest/boxoffice/searchDailyBoxOfficeList.json`,
      { params: { key: KOBIS_KEY, targetDt } }
    );
    
    if (response.data.faultInfo) {
      console.error("KOBIS API Fault:", response.data.faultInfo.message);
      return res.status(400).json({ error: response.data.faultInfo.message });
    }
    
    res.status(200).json(response.data);
  } catch (error) {
    console.error("KOBIS Error:", error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data?.error || error.message });
  }
}
