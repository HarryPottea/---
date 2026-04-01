import express from "express";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import cors from "cors";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API Keys (Hardcoded as requested, but can be overridden by env vars)
  const KOBIS_KEY = process.env.KOBIS_API_KEY || "57e44523cc7bbb91b7c1fc2fd37b3ca4";
  const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID || "Rx0q2Y7SHyMOmmSghFGL";
  const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || "Fb2BDCQKu5";

  // KOBIS Proxy
  app.get("/api/kobis", async (req, res) => {
    const { targetDt } = req.query;
    try {
      const response = await axios.get(
        `http://kobis.or.kr/kobisopenapi/webservice/rest/boxoffice/searchDailyBoxOfficeList.json`,
        { params: { key: KOBIS_KEY, targetDt } }
      );
      res.json(response.data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Naver DataLab Proxy
  app.post("/api/naver", async (req, res) => {
    const { body } = req.body;
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
      res.json(response.data);
    } catch (error: any) {
      res.status(error.response?.status || 500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
