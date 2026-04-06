// backend/src/middleware/auth.ts
import { Request, Response, NextFunction } from "express";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import type { AuthPayload, AuthRequest } from "../types/index";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-secret-must-change-in-production"
);
const JWT_REFRESH_SECRET = new TextEncoder().encode(
  process.env.JWT_REFRESH_SECRET || "fallback-refresh-secret-must-change"
);

export async function signAccessToken(payload: AuthPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(process.env.JWT_EXPIRES_IN || "15m")
    .sign(JWT_SECRET);
}

export async function signRefreshToken(payload: AuthPayload): Promise<string> {
return new SignJWT(payload as unknown as Record<string, unknown>)    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(process.env.JWT_REFRESH_EXPIRES_IN || "7d")
    .sign(JWT_REFRESH_SECRET);
}

export async function verifyAccessToken(token: string): Promise<AuthPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as AuthPayload;
  } catch { return null; }
}

export async function verifyRefreshToken(token: string): Promise<AuthPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_REFRESH_SECRET);
    return payload as unknown as AuthPayload;
  } catch { return null; }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// Middleware: require valid JWT
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ success: false, error: "Authentication required" });
    return;
  }

  verifyAccessToken(token).then((payload) => {
    if (!payload) {
      res.status(401).json({ success: false, error: "Invalid or expired token" });
      return;
    }
    (req as AuthRequest).user = payload;
    next();
  }).catch(() => {
    res.status(401).json({ success: false, error: "Token verification failed" });
  });
}

// Middleware: require ADMIN role
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    const user = (req as AuthRequest).user;
    if (!user || user.role !== "ADMIN") {
      res.status(403).json({ success: false, error: "Admin access required" });
      return;
    }
    next();
  });
}

// Optional auth — doesn't fail if no token
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) { next(); return; }

  verifyAccessToken(token).then((payload) => {
    if (payload) (req as AuthRequest).user = payload;
    next();
  }).catch(() => next());
}
