// backend/src/routes/analytics.ts
import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth";
import { getUrlAnalytics, getGlobalStats } from "../services/analyticsService";
import { prisma } from "../services/urlService";
import type { AuthRequest } from "../types/index";

const router = Router();

/**
 * @swagger
 * /api/analytics/{urlId}:
 *   get:
 *     summary: Get analytics for a specific URL
 *     tags: [Analytics]
 */
router.get("/:urlId", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user!.userId;
    const isAdmin = (req as AuthRequest).user!.role === "ADMIN";
    const { urlId } = req.params;
    const days = parseInt(req.query.days as string) || 30;

    // Verify ownership
    const url = await prisma.url.findUnique({ where: { id: urlId } });
    if (!url) {
      res.status(404).json({ success: false, error: "URL not found" });
      return;
    }
    if (!isAdmin && url.userId !== userId) {
      res.status(403).json({ success: false, error: "Forbidden" });
      return;
    }

    const analytics = await getUrlAnalytics(urlId, days);
    res.json({ success: true, data: { url, analytics } });
  } catch {
    res.status(500).json({ success: false, error: "Analytics fetch failed" });
  }
});

/**
 * @swagger
 * /api/analytics/global/stats:
 *   get:
 *     summary: Get global platform stats
 */
router.get("/global/stats", requireAuth, async (_req: Request, res: Response) => {
  try {
    const stats = await getGlobalStats();
    res.json({ success: true, data: stats });
  } catch {
    res.status(500).json({ success: false, error: "Stats fetch failed" });
  }
});

export default router;
