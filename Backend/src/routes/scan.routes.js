import { Router } from "express";
import {
  postScan,
  getGraph,
  deleteGraph,
  getImpact,
  seedSchema,
  seedGraphToDb,
  getMetrics,
} from "../controllers/scan.controller.js";

const router = Router();

// POST /api/scan   → trigger a scan
router.post("/scan", postScan);

// GET  /api/graph/:repoId → get dependency/call graph for specific repo
router.get("/graph/:repoId", getGraph);

// GET  /api/graph → get the latest scanned graph (backward compatibility)
router.get("/graph", getGraph);

// DELETE /api/graph/:repoId → delete stored graph
router.delete("/graph/:repoId", deleteGraph);

// GET  /api/impact → get impact analysis
router.get("/impact", getImpact);

// DB Seeding Routes
router.post("/db/seed/schema", seedSchema);
router.post("/db/seed/graph/:repoId", seedGraphToDb);

// Metrics Routes
router.get("/metrics/:scanId", getMetrics);

export default router;
