import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

import { apiLimiter } from "./middleware/rateLimit";
import { register, httpRequestDuration } from "./utils/metrics";
import { redis } from "./utils/redis";
import { prisma } from "./services/urlService";
import { initWebSocket } from "./websocket/analyticsSocket";

import shortenerRouter, { handleRedirect } from "./routes/shortener";
import analyticsRouter from "./routes/analytics";
import userRouter from "./routes/user";
import adminRouter from "./routes/admin";

const app = express();
const server = http.createServer(app);
const PORT = parseInt(process.env.PORT || "4000");

// ─── WebSocket ────────────────────────────────────────────────────────────────
initWebSocket(server);

// ─── Core middleware ──────────────────────────────────────────────────────────
app.set("trust proxy", 1);

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: [
    process.env.FRONTEND_URL || "http://localhost:3000",
    "http://localhost:3000",
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(compression());
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// ─── Metrics middleware ───────────────────────────────────────────────────────
app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer();
  res.on("finish", () => {
    end({ method: req.method, route: req.route?.path || req.path, status_code: res.statusCode });
  });
  next();
});

// ─── Swagger docs ─────────────────────────────────────────────────────────────
const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.0",
    info: {
      title: "URL Shortener API",
      version: "0.1.0",
      description: "Production URL Shortener with Analytics",
    },
    servers: [{ url: `http://localhost:${PORT}`, description: "Local" }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ["./src/routes/*.ts"],
});
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ─── Health & metrics ─────────────────────────────────────────────────────────
app.get("/health", async (_req, res) => {
  const checks = {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || "0.1.0",
    services: {
      database: "unknown",
      redis: "unknown",
    },
  };
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.services.database = "healthy";
  } catch { checks.services.database = "unhealthy"; }
  try {
    await redis.ping();
    checks.services.redis = "healthy";
  } catch { checks.services.redis = "unhealthy"; }

  const allHealthy = Object.values(checks.services).every((s) => s === "healthy");
  res.status(allHealthy ? 200 : 503).json(checks);
});

app.get("/ready", async (_req, res) => {
  try {
    await Promise.all([prisma.$queryRaw`SELECT 1`, redis.ping()]);
    res.json({ ready: true });
  } catch {
    res.status(503).json({ ready: false });
  }
});

app.get("/metrics", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (process.env.NODE_ENV === "production" && token !== process.env.METRICS_TOKEN) {
    res.status(401).end();
    return;
  }
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

// ─── API routes ───────────────────────────────────────────────────────────────
app.use("/api", apiLimiter);
app.use("/api", shortenerRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api", userRouter);
app.use("/api/admin", adminRouter);

// ─── Short URL redirect ───────────────────────────────────────────────────────
app.get("/:shortCode([a-zA-Z0-9_-]{4,20})", handleRedirect);

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, error: "Route not found" });
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ success: false, error: "Internal server error" });
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────
async function gracefulShutdown(signal: string) {
  console.log(`\n${signal} received — shutting down...`);
  server.close(async () => {
    await Promise.allSettled([prisma.$disconnect(), redis.quit()]);
    console.log("✅ Graceful shutdown complete");
    process.exit(0);
  });
  setTimeout(() => { console.error("Forced shutdown"); process.exit(1); }, 10000);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// ─── Start ────────────────────────────────────────────────────────────────────
server.listen(PORT, async () => {
  console.log(`\n🚀 URL Shortener running on http://localhost:${PORT}`);
  console.log(`📚 Swagger docs: http://localhost:${PORT}/api-docs`);
  console.log(`📊 Metrics: http://localhost:${PORT}/metrics`);
  console.log(`❤️  Health: http://localhost:${PORT}/health\n`);

  // Seed admin if not exists
  try {
    const { hashPassword } = await import("./middleware/auth");
    const { prisma: db } = await import("./services/urlService");
    const { Role } = await import("@prisma/client");
    const adminEmail = process.env.ADMIN_EMAIL || "admin@example.com";
    const existing = await db.user.findUnique({ where: { email: adminEmail } });
    if (!existing) {
      const hashed = await hashPassword(process.env.ADMIN_PASSWORD || "Admin@123456");
      await db.user.create({ data: { email: adminEmail, password: hashed, name: "Admin", role: Role.ADMIN } });
      console.log(`👤 Admin created: ${adminEmail}`);
    }
  } catch (e) { console.error("Admin seed error:", e); }
});

export default app;
