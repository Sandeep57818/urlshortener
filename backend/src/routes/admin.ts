// backend/src/routes/admin.ts
import { Router, Request, Response } from "express";
import { requireAdmin } from "../middleware/auth";
import { prisma, getAllUrls, deleteUrl } from "../services/urlService";
import { getGlobalStats } from "../services/analyticsService";
import { redis } from "../utils/redis";
import type { AuthRequest } from "../types/index";

const router = Router();

// All admin routes require ADMIN role
router.use(requireAdmin);

/**
 * @swagger
 * /api/admin/stats:
 *   get:
 *     summary: Get admin dashboard stats
 *     tags: [Admin]
 */
router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const [stats, redisInfo] = await Promise.all([
      getGlobalStats(),
      redis.info("memory").catch(() => ""),
    ]);

    const memMatch = redisInfo.match(/used_memory_human:(.+)/);
    const redisMemory = memMatch ? memMatch[1].trim() : "N/A";

    res.json({
      success: true,
      data: { ...stats, redis: { memory: redisMemory, status: "connected" } },
    });
  } catch {
    res.status(500).json({ success: false, error: "Stats fetch failed" });
  }
});

/**
 * @swagger
 * /api/admin/urls:
 *   get:
 *     summary: Get all URLs (paginated)
 */
router.get("/urls", async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const search = req.query.search as string | undefined;
    const result = await getAllUrls(page, limit, search);
    res.json({ success: true, data: result.urls, meta: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages } });
  } catch {
    res.status(500).json({ success: false, error: "Fetch failed" });
  }
});

/**
 * @swagger
 * /api/admin/urls/{id}:
 *   delete:
 *     summary: Delete any URL
 */
router.delete("/urls/:id", async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user!.userId;
    await deleteUrl(req.params.id, userId, true);
    res.json({ success: true, message: "URL deleted" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Delete failed";
    res.status(400).json({ success: false, error: msg });
  }
});

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: Get all users
 */
router.get("/users", async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const search = req.query.search as string;
    const skip = (page - 1) * limit;

    const where = search
      ? { OR: [{ email: { contains: search, mode: "insensitive" as const } }, { name: { contains: search, mode: "insensitive" as const } }] }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true, email: true, name: true, role: true,
          isActive: true, createdAt: true,
          _count: { select: { urls: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      success: true,
      data: users,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch {
    res.status(500).json({ success: false, error: "Fetch failed" });
  }
});

/**
 * @swagger
 * /api/admin/users/{id}/toggle:
 *   patch:
 *     summary: Toggle user active status
 */
router.patch("/users/:id/toggle", async (req: Request, res: Response) => {
  try {
    const currentId = (req as AuthRequest).user!.userId;
    if (req.params.id === currentId) {
      res.status(400).json({ success: false, error: "Cannot deactivate yourself" });
      return;
    }
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) { res.status(404).json({ success: false, error: "User not found" }); return; }

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive: !user.isActive },
      select: { id: true, email: true, isActive: true },
    });
    res.json({ success: true, data: updated });
  } catch {
    res.status(500).json({ success: false, error: "Update failed" });
  }
});

/**
 * @swagger
 * /api/admin/users/{id}/role:
 *   patch:
 *     summary: Change user role
 */
router.patch("/users/:id/role", async (req: Request, res: Response) => {
  try {
    const { role } = req.body as { role: "USER" | "ADMIN" };
    if (!["USER", "ADMIN"].includes(role)) {
      res.status(400).json({ success: false, error: "Invalid role" });
      return;
    }
    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { role },
      select: { id: true, email: true, role: true },
    });
    res.json({ success: true, data: updated });
  } catch {
    res.status(500).json({ success: false, error: "Update failed" });
  }
});

/**
 * @swagger
 * /api/admin/cache/flush:
 *   post:
 *     summary: Flush all Redis cache
 */
router.post("/cache/flush", async (_req: Request, res: Response) => {
  try {
    await redis.flushdb();
    res.json({ success: true, message: "Cache flushed" });
  } catch {
    res.status(500).json({ success: false, error: "Flush failed" });
  }
});

export default router;
