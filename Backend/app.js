import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

// Neo4j verification
import { isNeo4jConfigured, verifyNeo4jConnectivity } from './src/config/neo4j.js';

if (isNeo4jConfigured) {
  verifyNeo4jConnectivity()
    .then(() => console.log('✅ Neo4j connected'))
    .catch((err) => console.error('❌ Neo4j connection failed:', err.message || err));
} else {
  console.warn('⚠️ Neo4j is not configured. Set NEO4J_URI, NEO4J_USER/NEO4J_USERNAME, and NEO4J_PASSWORD to enable graph DB features.');
}

// Route imports
import helpRouter from "./src/routes/help.routes.js";
import scanRouter from "./src/routes/scan.routes.js";
import importRouter from "./src/routes/import.routes.js";
import webhookRouter from "./src/routes/webhook.routes.js";
import sseRouter from "./src/routes/sse.routes.js";
import authRouter from "./src/routes/auth.route.js";
import userRouter from "./src/routes/user.route.js";
import chatRouter from "./src/routes/chat.routes.js";
import { startWebhookWorker } from "./src/workers/webhook.worker.js";
import { stopAllLocalWatchers } from "./src/services/localWatcher.service.js";

const app = express();

// ─── Middlewares ───────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(
  express.json({
    limit: "512kb",
    verify: (req, _res, buf) => {
      if (req.originalUrl?.startsWith("/api/webhook/github")) {
        req.rawBody = Buffer.from(buf);
      }
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(cookieParser(process.env.COOKIE_SECRET || process.env.JWT_SECRET || 'dev-cookie-secret'));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/", (_req, res) => {
  res.json({ success: true, message: "SIES-ByteCamp API is running 🚀" });
});

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    status: "healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/help", helpRouter);
app.use("/api/auth", authRouter);
app.use("/api/users", userRouter);
app.use("/api/chat", chatRouter);
app.use("/api/import", importRouter);
app.use("/api/webhook", webhookRouter);
app.use("/api/events", sseRouter);
app.use("/api", scanRouter);

startWebhookWorker();

// ─── 404 handler ──────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// ─── Global error handler ─────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  console.error(`[ERROR] ${status} - ${message}`);
  res.status(status).json({ success: false, message });
});

// Graceful shutdown: stop all file watchers when the process exits.
process.on("SIGTERM", () => {
  stopAllLocalWatchers();
  process.exit(0);
});
process.on("SIGINT", () => {
  stopAllLocalWatchers();
  process.exit(0);
});

export default app;
