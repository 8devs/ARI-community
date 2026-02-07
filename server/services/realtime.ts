import type { Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { verifySession } from "../lib/jwt.js";
import { parse } from "cookie";

let io: SocketIOServer | null = null;

export function setupSocketIO(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NODE_ENV === "production" ? false : ["http://localhost:8080", "http://localhost:3000"],
      credentials: true,
    },
    path: "/ws",
  });

  io.use((socket, next) => {
    try {
      const cookieHeader = socket.handshake.headers.cookie;
      if (!cookieHeader) return next(new Error("No session"));

      const cookies = parse(cookieHeader);
      const token = cookies["ari_session"];
      if (!token) return next(new Error("No session token"));

      const payload = verifySession(token);
      (socket as any).userId = payload.sub;
      (socket as any).userRole = payload.role;
      next();
    } catch {
      next(new Error("Invalid session"));
    }
  });

  io.on("connection", (socket) => {
    const userId = (socket as any).userId;
    const userRole = (socket as any).userRole;

    // Join personal room
    socket.join(`user:${userId}`);

    // Admins join global room for join-request updates
    if (userRole === "SUPER_ADMIN" || userRole === "ORG_ADMIN") {
      socket.join("admin");
    }

    socket.on("disconnect", () => {
      // Cleanup handled automatically by Socket.io
    });
  });

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
}

// Emit to a specific user
export function emitToUser(userId: string, event: string, data: any) {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, data);
}

// Emit to all admins
export function emitToAdmins(event: string, data: any) {
  if (!io) return;
  io.to("admin").emit(event, data);
}
