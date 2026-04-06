import rateLimit from "express-rate-limit";
import { RedisStore, type RedisReply } from "rate-limit-redis";
import { redis } from "../utils/redis";
import { rateLimitHits } from "../utils/metrics";
import { Request, Response } from "express";

function makeStore(prefix: string) {
  return new RedisStore({
    sendCommand: (command: string, ...args: string[]) =>
      redis.call(command, ...args) as Promise<RedisReply>,
    prefix,
  });
}

// General API: 100 req/min
export const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000"),
  max: parseInt(process.env.RATE_LIMIT_MAX || "100"),
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore("rl:api:"),
  handler(_req: Request, res: Response) {
    rateLimitHits.inc();
    res.status(429).json({
      success: false,
      error: "Too many requests. Limit: 100/min per IP.",
      retryAfter: 60,
    });
  },
});

// Shorten endpoint: 20 req/min
export const shortenLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore("rl:shorten:"),
  handler(_req: Request, res: Response) {
    rateLimitHits.inc();
    res.status(429).json({
      success: false,
      error: "Shorten limit: 20/min per IP.",
      retryAfter: 60,
    });
  },
});

// Auth: 10 req/min
export const authLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore("rl:auth:"),
  handler(_req: Request, res: Response) {
    rateLimitHits.inc();
    res.status(429).json({
      success: false,
      error: "Auth limit: 10/min per IP.",
      retryAfter: 60,
    });
  },
});