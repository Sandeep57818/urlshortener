// backend/src/utils/metrics.ts
import client from "prom-client";

const register = new client.Registry();
client.collectDefaultMetrics({ register });

export const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

export const urlsCreatedTotal = new client.Counter({
  name: "urls_created_total",
  help: "Total number of URLs created",
  registers: [register],
});

export const redirectsTotal = new client.Counter({
  name: "redirects_total",
  help: "Total number of redirects served",
  registers: [register],
});

export const activeUsers = new client.Gauge({
  name: "active_users_total",
  help: "Total number of registered users",
  registers: [register],
});

export const cacheHits = new client.Counter({
  name: "cache_hits_total",
  help: "Total Redis cache hits",
  labelNames: ["type"],
  registers: [register],
});

export const cacheMisses = new client.Counter({
  name: "cache_misses_total",
  help: "Total Redis cache misses",
  labelNames: ["type"],
  registers: [register],
});

export const rateLimitHits = new client.Counter({
  name: "rate_limit_hits_total",
  help: "Total rate limit rejections",
  registers: [register],
});

export { register };
