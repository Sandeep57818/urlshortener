// backend/src/websocket/analyticsSocket.ts
import { Server as SocketServer } from "socket.io";
import { Server as HttpServer } from "http";
import { verifyAccessToken } from "../middleware/auth";

let io: SocketServer | null = null;

export function initWebSocket(server: HttpServer) {
  io = new SocketServer(server, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (token) {
      const payload = await verifyAccessToken(token);
      if (payload) {
        socket.data.user = payload;
      }
    }
    next();
  });

  io.on("connection", (socket) => {
    console.log(`🔌 WS connected: ${socket.id}`);

    socket.on("subscribe:url", (shortCode: string) => {
      socket.join(`url:${shortCode}`);
    });

    socket.on("subscribe:dashboard", () => {
      if (socket.data.user) {
        socket.join(`user:${socket.data.user.userId}`);
      }
    });

    socket.on("subscribe:admin", () => {
      if (socket.data.user?.role === "ADMIN") {
        socket.join("admin");
      }
    });

    socket.on("disconnect", () => {
      console.log(`🔌 WS disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function emitClickEvent(data: {
  shortCode: string;
  urlId: string;
  country?: string;
  browser?: string;
  device?: string;
  timestamp: string;
}) {
  if (!io) return;
  io.to(`url:${data.shortCode}`).emit("click", data);
  io.to("admin").emit("click:global", data);
}

export function emitGlobalStats(stats: {
  totalUrls: number;
  totalClicks: number;
  clicksLast24h: number;
}) {
  if (!io) return;
  io.to("admin").emit("stats:update", stats);
}

export function getIO() {
  return io;
}
