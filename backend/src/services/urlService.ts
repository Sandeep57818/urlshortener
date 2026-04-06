// backend/src/services/urlService.ts
import { PrismaClient } from "@prisma/client";
import { generateShortCode, isValidShortCode } from "../utils/base62";
import { cacheGet, cacheSet, cacheDel, CACHE_TTL } from "../utils/redis";
import { cacheHits, cacheMisses, urlsCreatedTotal, redirectsTotal } from "../utils/metrics";
import type { CreateUrlInput } from "../types/index";

const prisma = new PrismaClient();

export async function createShortUrl(input: CreateUrlInput, userId?: string) {
  const { originalUrl, customCode, expiresAt, title, customDomain } = input;

  // Check custom code availability
  let shortCode = customCode;
  if (shortCode) {
    if (!isValidShortCode(shortCode)) {
      throw new Error("Invalid custom code format");
    }
    const existing = await prisma.url.findUnique({ where: { shortCode } });
    if (existing) throw new Error("Custom code already taken");
  } else {
    // Generate unique code with collision check
    let attempts = 0;
    do {
      shortCode = generateShortCode(7);
      attempts++;
      if (attempts > 10) throw new Error("Failed to generate unique code");
    } while (await prisma.url.findUnique({ where: { shortCode } }));
  }

  const url = await prisma.url.create({
    data: {
      shortCode: shortCode!,
      originalUrl,
      title: title || null,
      userId: userId || null,
      customDomain: customDomain || null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
  });

  urlsCreatedTotal.inc();
  await cacheSet(`url:${shortCode}`, url, CACHE_TTL.SHORT_URL);
  return url;
}

export async function resolveShortUrl(shortCode: string) {
  // Try cache first
  const cached = await cacheGet<{ originalUrl: string; id: string; expiresAt: string | null }>(`url:${shortCode}`);
  if (cached) {
    cacheHits.inc({ type: "url" });
    if (cached.expiresAt && new Date(cached.expiresAt) < new Date()) {
      await cacheDel(`url:${shortCode}`);
      return null;
    }
    redirectsTotal.inc();
    return cached;
  }

  cacheMisses.inc({ type: "url" });
  const url = await prisma.url.findUnique({
    where: { shortCode, isActive: true },
  });

  if (!url) return null;
  if (url.expiresAt && url.expiresAt < new Date()) return null;

  await cacheSet(`url:${shortCode}`, url, CACHE_TTL.SHORT_URL);
  redirectsTotal.inc();
  return url;
}

export async function recordClick(
  urlId: string,
  data: {
    ip?: string;
    userAgent?: string;
    referer?: string;
    country?: string;
    city?: string;
    browser?: string;
    os?: string;
    device?: string;
  }
) {
  await Promise.all([
    prisma.click.create({ data: { urlId, ...data } }),
    prisma.url.update({ where: { id: urlId }, data: { clickCount: { increment: 1 } } }),
    upsertDailyAnalytics(urlId),
  ]);
}

async function upsertDailyAnalytics(urlId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  await prisma.dailyAnalytics.upsert({
    where: { urlId_date: { urlId, date: today } },
    update: { clicks: { increment: 1 } },
    create: { urlId, date: today, clicks: 1 },
  });
}

export async function getUserUrls(userId: string, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  const [urls, total] = await Promise.all([
    prisma.url.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: { _count: { select: { clicks: true } } },
    }),
    prisma.url.count({ where: { userId } }),
  ]);
  return { urls, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function deleteUrl(id: string, userId: string, isAdmin = false) {
  const url = await prisma.url.findUnique({ where: { id } });
  if (!url) throw new Error("URL not found");
  if (!isAdmin && url.userId !== userId) throw new Error("Forbidden");
  await cacheDel(`url:${url.shortCode}`);
  await prisma.url.delete({ where: { id } });
}

export async function getAllUrls(page = 1, limit = 20, search?: string) {
  const skip = (page - 1) * limit;
  const where = search
    ? {
        OR: [
          { shortCode: { contains: search, mode: "insensitive" as const } },
          { originalUrl: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};
  const [urls, total] = await Promise.all([
    prisma.url.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: { user: { select: { email: true, name: true } } },
    }),
    prisma.url.count({ where }),
  ]);
  return { urls, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export { prisma };
