import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

// Import API handlers
import kobisHandler from "./api/kobis.js";
import naverHandler from "./api/naver.js";
import geminiHandler from "./api/gemini.js";
import collectTrendsHandler from "./api/collect-trends.js";
import recommendedKeywordsHandler from "./api/recommended-keywords.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for parsing JSON bodies
  app.use(express.json());

  // API routes
  app.get("/api/kobis", kobisHandler);
  app.post("/api/naver", naverHandler);
  app.get("/api/gemini", geminiHandler);
  app.get("/api/collect-trends", collectTrendsHandler);
  app.get("/api/recommended-keywords", recommendedKeywordsHandler);

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
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
