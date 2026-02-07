// Load .env.local for development, .env for production
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";
import cors from "cors";

import { ensureUploadDirs, UPLOAD_DIR } from "./services/storage.js";
import { setupSocketIO } from "./services/realtime.js";
import authRoutes from "./routes/auth.js";
import dataRoutes from "./routes/data.js";
import uploadRoutes from "./routes/upload.js";
import crudRoutes from "./routes/crud.js";
import notificationRoutes from "./routes/notifications.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT ?? 3000);
const isDev = process.env.NODE_ENV !== "production";

const app = express();
const httpServer = createServer(app);

// ─── Middleware ───────────────────────────────────────────────────────
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());

if (isDev) {
  app.use(
    cors({
      origin: ["http://localhost:8080", "http://localhost:3000", "http://localhost:5173"],
      credentials: true,
    })
  );
}

// ─── File Uploads (static serving) ───────────────────────────────────
ensureUploadDirs();
app.use("/uploads", express.static(UPLOAD_DIR, { maxAge: "1d" }));

// ─── API Routes ──────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/data", dataRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api", crudRoutes);
app.use("/api/notifications", notificationRoutes);

// ─── WebSocket (Socket.io) ───────────────────────────────────────────
setupSocketIO(httpServer);

// ─── Serve Frontend (production) ─────────────────────────────────────
if (!isDev) {
  const distPath = path.join(__dirname, "..", "dist");
  app.use(express.static(distPath));

  // SPA fallback – serve index.html for all non-API, non-upload routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

// ─── Start Server ────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`ARI server running on port ${PORT} (${isDev ? "development" : "production"})`);
});

export default app;
