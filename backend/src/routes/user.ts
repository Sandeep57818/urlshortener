import { Router, Request, Response } from "express";
import { prisma } from "../services/urlService";
import {
  hashPassword,
  comparePassword,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  requireAuth,
} from "../middleware/auth";
import { authLimiter } from "../middleware/rateLimit";
import { validate, registerSchema, loginSchema } from "../middleware/validation";
import type { AuthRequest } from "../types/index";

const router = Router();

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 */
router.post(
  "/auth/register",
  authLimiter,
  validate(registerSchema),
  async (req: Request, res: Response) => {
    try {
      const { email, password, name } = req.body as { email: string; password: string; name?: string };

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        res.status(409).json({ success: false, error: "Email already registered" });
        return;
      }

      const hashed = await hashPassword(password);
      const user = await prisma.user.create({
        data: { email, password: hashed, name: name || null },
        select: { id: true, email: true, name: true, role: true, createdAt: true },
      });

      const payload = { userId: user.id, email: user.email, role: user.role as "USER" | "ADMIN" };
      const [accessToken, refreshToken] = await Promise.all([
        signAccessToken(payload),
        signRefreshToken(payload),
      ]);

      res.status(201).json({
        success: true,
        data: { user, accessToken, refreshToken },
      });
    } catch {
      res.status(500).json({ success: false, error: "Registration failed" });
    }
  }
);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login with email and password
 *     tags: [Auth]
 */
router.post(
  "/auth/login",
  authLimiter,
  validate(loginSchema),
  async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body as { email: string; password: string };

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user || !user.isActive) {
        res.status(401).json({ success: false, error: "Invalid credentials" });
        return;
      }

      const valid = await comparePassword(password, user.password);
      if (!valid) {
        res.status(401).json({ success: false, error: "Invalid credentials" });
        return;
      }

      const payload = { userId: user.id, email: user.email, role: user.role as "USER" | "ADMIN" };
      const [accessToken, refreshToken] = await Promise.all([
        signAccessToken(payload),
        signRefreshToken(payload),
      ]);

      res.json({
        success: true,
        data: {
          user: { id: user.id, email: user.email, name: user.name, role: user.role },
          accessToken,
          refreshToken,
        },
      });
    } catch {
      res.status(500).json({ success: false, error: "Login failed" });
    }
  }
);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token
 */
router.post("/auth/refresh", async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body as { refreshToken: string };
    if (!refreshToken) {
      res.status(400).json({ success: false, error: "Refresh token required" });
      return;
    }

    const payload = await verifyRefreshToken(refreshToken);
    if (!payload) {
      res.status(401).json({ success: false, error: "Invalid refresh token" });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || !user.isActive) {
      res.status(401).json({ success: false, error: "User not found" });
      return;
    }

    const newPayload = { userId: user.id, email: user.email, role: user.role as "USER" | "ADMIN" };
    const [accessToken, newRefresh] = await Promise.all([
      signAccessToken(newPayload),
      signRefreshToken(newPayload),
    ]);

    res.json({ success: true, data: { accessToken, refreshToken: newRefresh } });
  } catch {
    res.status(500).json({ success: false, error: "Token refresh failed" });
  }
});

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user profile
 */
router.get("/auth/me", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user!.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });
    if (!user) {
      res.status(404).json({ success: false, error: "User not found" });
      return;
    }
    res.json({ success: true, data: user });
  } catch {
    res.status(500).json({ success: false, error: "Profile fetch failed" });
  }
});

/**
 * @swagger
 * /api/auth/me:
 *   patch:
 *     summary: Update user profile
 */
router.patch("/auth/me", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user!.userId;
    const { name } = req.body as { name?: string };
    const user = await prisma.user.update({
      where: { id: userId },
      data: { ...(name ? { name } : {}) },
      select: { id: true, email: true, name: true, role: true },
    });
    res.json({ success: true, data: user });
  } catch {
    res.status(500).json({ success: false, error: "Update failed" });
  }
});

export default router;
