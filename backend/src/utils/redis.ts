// backend/src/utils/redis.ts
import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  retryStrategy(times) {
    if (times > 10) return null;
    return Math.min(times * 100, 3000);
  },
  lazyConnect: false,
});

redis.on("connect", () => console.log("✅ Redis connected"));
redis.on("error", (err) => console.error("❌ Redis error:", err.message));

// Cache helpers
export const CACHE_TTL = {
  SHORT_URL: 3600,      // 1 hour
  ANALYTICS: 300,       // 5 min
  USER: 900,            // 15 min
  RATE_LIMIT: 60,       // 1 min window
};

export async function cacheGet<T>(key: string): Promise<T | null> {
  const val = await redis.get(key);
  if (!val) return null;
  try { return JSON.parse(val) as T; } catch { return null; }
}

export async function cacheSet(key: string, value: unknown, ttl = CACHE_TTL.SHORT_URL): Promise<void> {
  await redis.setex(key, ttl, JSON.stringify(value));
}

export async function cacheDel(key: string): Promise<void> {
  await redis.del(key);
}

export async function cacheDelPattern(pattern: string): Promise<void> {
  const keys = await redis.keys(pattern);
  if (keys.length > 0) await redis.del(...keys);
}
