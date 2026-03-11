import express from "express";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import * as cheerio from "cheerio";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for Instagram Scraping
  app.post("/api/scrape-instagram", async (req, res) => {
    const { handle } = req.body;
    if (!handle) {
      return res.status(400).json({ error: "Instagram handle is required" });
    }

    // Clean handle more robustly
    let cleanHandle = handle.trim().replace("@", "");
    try {
      if (cleanHandle.includes("instagram.com")) {
        const urlObj = new URL(cleanHandle.startsWith("http") ? cleanHandle : `https://${cleanHandle}`);
        cleanHandle = urlObj.pathname.split("/").filter(Boolean)[0];
      }
    } catch (e) {
      // Fallback to simple split if URL parsing fails
      cleanHandle = cleanHandle.split("/").filter(Boolean).pop() || cleanHandle;
    }
    
    const url = `https://www.instagram.com/${cleanHandle}/`;

    try {
      console.log(`[Scraper] Attempting handle: ${cleanHandle}`);
      
      let logo = null;
      let references: string[] = [];

      // Strategy 1: Instagram Direct
      try {
        const instaRes = await axios.get(url, {
          headers: { 
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": "https://www.google.com/"
          },
          timeout: 5000
        });
        const $ = cheerio.load(instaRes.data);
        logo = $('meta[property="og:image"]').attr('content');
        console.log(`[Scraper] Instagram direct logo found: ${!!logo}`);
      } catch (e: any) {
        console.log(`[Scraper] Instagram direct failed: ${e.message}`);
      }

      // Strategy 2: Picuki
      if (!logo || references.length < 3) {
        try {
          console.log(`[Scraper] Trying Picuki for ${cleanHandle}...`);
          const picukiRes = await axios.get(`https://www.picuki.com/profile/${cleanHandle}`, {
            headers: { 
              "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
              "Referer": "https://www.picuki.com/"
            },
            timeout: 5000
          });
          const $pic = cheerio.load(picukiRes.data);
          if (!logo) logo = $pic('.profile-avatar img').attr('src');
          $pic('.post-image img').each((i, el) => {
            const src = $pic(el).attr('src');
            if (src && !references.includes(src) && references.length < 6) references.push(src);
          });
          console.log(`[Scraper] Picuki results - Logo: ${!!logo}, Refs: ${references.length}`);
        } catch (e: any) {
          console.log(`[Scraper] Picuki failed: ${e.message}`);
        }
      }

      // Strategy 3: Imginn
      if (!logo || references.length < 3) {
        try {
          console.log(`[Scraper] Trying Imginn for ${cleanHandle}...`);
          const imginnRes = await axios.get(`https://imginn.com/${cleanHandle}/`, {
            headers: { 
              "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
              "Referer": "https://imginn.com/"
            },
            timeout: 5000
          });
          const $imginn = cheerio.load(imginnRes.data);
          if (!logo) logo = $imginn('.info .img img').attr('src');
          $imginn('.items .item img').each((i, el) => {
            const src = $imginn(el).attr('data-src') || $imginn(el).attr('src');
            if (src && !references.includes(src) && references.length < 6) references.push(src);
          });
          console.log(`[Scraper] Imginn results - Logo: ${!!logo}, Refs: ${references.length}`);
        } catch (e: any) {
          console.log(`[Scraper] Imginn failed: ${e.message}`);
        }
      }

      // Strategy 4: Dumpor (Fallback)
      if (!logo || references.length < 3) {
        try {
          console.log(`[Scraper] Trying Dumpor for ${cleanHandle}...`);
          const dumporRes = await axios.get(`https://dumpor.com/v/${cleanHandle}`, {
            headers: { 
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36",
              "Referer": "https://dumpor.com/"
            },
            timeout: 5000
          });
          const $dumpor = cheerio.load(dumporRes.data);
          if (!logo) logo = $dumpor('.user__img').css('background-image')?.replace(/url\(['"]?|['"]?\)/g, '');
          $dumpor('.content__img img').each((i, el) => {
            const src = $dumpor(el).attr('src');
            if (src && !references.includes(src) && references.length < 6) references.push(src);
          });
          console.log(`[Scraper] Dumpor results - Logo: ${!!logo}, Refs: ${references.length}`);
        } catch (e: any) {
          console.log(`[Scraper] Dumpor failed: ${e.message}`);
        }
      }

      if (!logo && references.length === 0) {
        throw new Error("Não foi possível encontrar dados para este perfil. Verifique se o perfil é público e tente novamente.");
      }

      res.json({
        logo: logo,
        references: references.slice(0, 3),
        handle: cleanHandle
      });
    } catch (error: any) {
      console.error("Scraping error:", error.message);
      res.status(500).json({ error: error.message || "Erro ao importar dados do Instagram." });
    }
  });

  // Proxy route for images to avoid CORS issues
  app.get("/api/proxy-image", async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).send("URL is required");
    try {
      const response = await axios.get(url as string, { 
        responseType: "arraybuffer",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36",
        }
      });
      res.set("Content-Type", response.headers["content-type"] || "image/jpeg");
      res.send(response.data);
    } catch (e) {
      console.error("Proxy error:", e);
      res.status(500).send("Failed to proxy image");
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
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
