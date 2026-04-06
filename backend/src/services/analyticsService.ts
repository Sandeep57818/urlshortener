// backend/src/services/analyticsService.ts
import { prisma } from "./urlService";
import { cacheGet, cacheSet, CACHE_TTL } from "../utils/redis";
import { cacheHits, cacheMisses } from "../utils/metrics";

export async function getUrlAnalytics(urlId: string, days = 30) {
  const cacheKey = `analytics:${urlId}:${days}`;
  const cached = await cacheGet(cacheKey);
  if (cached) { cacheHits.inc({ type: "analytics" }); return cached; }
  cacheMisses.inc({ type: "analytics" });

  const since = new Date();
  since.setDate(since.getDate() - days);

  const [clicks, dailyData, countries, referers, browsers, devices] = await Promise.all([
    prisma.click.count({ where: { urlId, timestamp: { gte: since } } }),
    prisma.dailyAnalytics.findMany({
      where: { urlId, date: { gte: since } },
      orderBy: { date: "asc" },
    }),
    prisma.click.groupBy({
      by: ["country"],
      where: { urlId, country: { not: null } },
      _count: true,
      orderBy: { _count: { country: "desc" } },
      take: 10,
    }),
    prisma.click.groupBy({
      by: ["referer"],
      where: { urlId, referer: { not: null } },
      _count: true,
      orderBy: { _count: { referer: "desc" } },
      take: 10,
    }),
    prisma.click.groupBy({
      by: ["browser"],
      where: { urlId, browser: { not: null } },
      _count: true,
      orderBy: { _count: { browser: "desc" } },
      take: 5,
    }),
    prisma.click.groupBy({
      by: ["device"],
      where: { urlId, device: { not: null } },
      _count: true,
      orderBy: { _count: { device: "desc" } },
      take: 5,
    }),
  ]);

  const result = {
    totalClicks: clicks,
    clicksByDay: dailyData.map((d) => ({
      date: d.date.toISOString().split("T")[0],
      clicks: d.clicks,
    })),
    topCountries: countries.map((c) => ({ country: c.country || "Unknown", count: c._count })),
    topReferers: referers.map((r) => ({ referer: r.referer || "Direct", count: r._count })),
    browsers: browsers.map((b) => ({ browser: b.browser || "Unknown", count: b._count })),
    devices: devices.map((d) => ({ device: d.device || "Unknown", count: d._count })),
  };

  await cacheSet(cacheKey, result, CACHE_TTL.ANALYTICS);
  return result;
}

export async function getGlobalStats() {
  const cacheKey = "global:stats";
  const cached = await cacheGet(cacheKey);
  if (cached) { cacheHits.inc({ type: "global" }); return cached; }

  const [totalUrls, totalClicks, totalUsers, recentClicks] = await Promise.all([
    prisma.url.count(),
    prisma.click.count(),
    prisma.user.count(),
    prisma.click.count({
      where: { timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    }),
  ]);

  const result = { totalUrls, totalClicks, totalUsers, clicksLast24h: recentClicks };
  await cacheSet(cacheKey, result, 60); // 1 min
  return result;
}

export async function parseUserAgent(ua: string) {
  const browser =
    ua.includes("Chrome") ? "Chrome" :
    ua.includes("Firefox") ? "Firefox" :
    ua.includes("Safari") ? "Safari" :
    ua.includes("Edge") ? "Edge" :
    ua.includes("Opera") ? "Opera" : "Other";

  const os =
    ua.includes("Windows") ? "Windows" :
    ua.includes("Mac") ? "macOS" :
    ua.includes("Linux") ? "Linux" :
    ua.includes("Android") ? "Android" :
    ua.includes("iPhone") || ua.includes("iPad") ? "iOS" : "Other";

  const device =
    ua.includes("Mobile") || ua.includes("Android") || ua.includes("iPhone") ? "Mobile" :
    ua.includes("Tablet") || ua.includes("iPad") ? "Tablet" : "Desktop";

  return { browser, os, device };
}

export async function getGeoInfo(ip: string): Promise<{ country?: string; city?: string }> {
  if (!ip || ip === "127.0.0.1" || ip === "::1" || ip.startsWith("192.168.") || ip.startsWith("10.")) {
    return { country: "Local", city: "Local" };
  }
  try {
    const res = await fetch(`https://ipapi.co/${ip}/json/`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return {};
    const data = await res.json() as { country_name?: string; city?: string };
    return { country: data.country_name, city: data.city };
  } catch {
    return {};
  }
}
