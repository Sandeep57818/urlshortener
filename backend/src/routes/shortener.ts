// backend/src/routes/shortener.ts
import { Router, Request, Response } from "express";
import { requireAuth, optionalAuth } from "../middleware/auth";
import { shortenLimiter } from "../middleware/rateLimit";
import { validate, urlSchema } from "../middleware/validation";
import {
  createShortUrl,
  resolveShortUrl,
  recordClick,
  getUserUrls,
  deleteUrl,
} from "../services/urlService";
import { generateQRCode, generateQRCodeBuffer } from "../services/qrService";
import { parseUserAgent, getGeoInfo } from "../services/analyticsService";
import { emitClickEvent } from "../websocket/analyticsSocket";
import type { AuthRequest } from "../types/index";

const router = Router();

/**
 * @swagger
 * /api/shorten:
 *   post:
 *     summary: Create a short URL
 *     tags: [URLs]
 */
router.post(
  "/shorten",
  shortenLimiter,
  optionalAuth,
  validate(urlSchema),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as AuthRequest).user?.userId;
      const url = await createShortUrl(req.body, userId);
      const shortUrl = `${process.env.SHORT_DOMAIN || "http://localhost:4000"}/${url.shortCode}`;
      const qr = await generateQRCode(shortUrl);

      res.status(201).json({
        success: true,
        data: { ...url, shortUrl, qrCode: qr },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create URL";
      res.status(400).json({ success: false, error: msg });
    }
  }
);

/**
 * @swagger
 * /api/urls:
 *   get:
 *     summary: Get authenticated user's URLs
 *     tags: [URLs]
 */
router.get("/urls", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user!.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const result = await getUserUrls(userId, page, limit);

    const domain = process.env.SHORT_DOMAIN || "http://localhost:4000";
    const urls = result.urls.map((u) => ({
      ...u,
      shortUrl: `${domain}/${u.shortCode}`,
    }));

    res.json({
      success: true,
      data: urls,
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch {
    res.status(500).json({ success: false, error: "Failed to fetch URLs" });
  }
});

/**
 * @swagger
 * /api/urls/{id}:
 *   delete:
 *     summary: Delete a URL
 */
router.delete("/urls/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user!.userId;
    const isAdmin = (req as AuthRequest).user!.role === "ADMIN";
    await deleteUrl(req.params.id, userId, isAdmin);
    res.json({ success: true, message: "URL deleted" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Delete failed";
    res.status(400).json({ success: false, error: msg });
  }
});

/**
 * @swagger
 * /api/qr/{shortCode}:
 *   get:
 *     summary: Get QR code for a short URL
 */
router.get("/qr/:shortCode", async (req: Request, res: Response) => {
  try {
    const { shortCode } = req.params;
    const format = req.query.format as string;
    const shortUrl = `${process.env.SHORT_DOMAIN || "http://localhost:4000"}/${shortCode}`;

    if (format === "png") {
      const buf = await generateQRCodeBuffer(shortUrl);
      res.set("Content-Type", "image/png");
      res.send(buf);
    } else {
      const qr = await generateQRCode(shortUrl);
      res.json({ success: true, data: { qrCode: qr, url: shortUrl } });
    }
  } catch {
    res.status(500).json({ success: false, error: "QR generation failed" });
  }
});

// Redirect handler — mounted at root level in index.ts
export async function handleRedirect(req: Request, res: Response) {
  try {
    const { shortCode } = req.params;
    const urlData = await resolveShortUrl(shortCode);

    if (!urlData) {
      res.status(404).json({ success: false, error: "Short URL not found or expired" });
      return;
    }

    const ip =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      "";

    const ua = req.headers["user-agent"] || "";
    const referer = req.headers.referer || req.headers.referrer as string || "";

    // Fire-and-forget: record click + emit WS event
    (async () => {
      const [geo, uaData] = await Promise.all([
        getGeoInfo(ip),
        Promise.resolve(parseUserAgent(ua)),
      ]);
      await recordClick(urlData.id, {
        ip,
        userAgent: ua,
        referer,
        country: geo.country,
        city: geo.city,
        ...(await uaData),
      });
      emitClickEvent({
        shortCode,
        urlId: urlData.id,
        country: geo.country,
        browser: (await uaData).browser,
        device: (await uaData).device,
        timestamp: new Date().toISOString(),
      });
    })();

    res.redirect(301, urlData.originalUrl);
  } catch {
    res.status(500).json({ success: false, error: "Redirect failed" });
  }
}

export default router;
