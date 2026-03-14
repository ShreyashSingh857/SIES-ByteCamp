import { Router } from "express";
import {
	postScan,
	getGraph,
	deleteGraph,
	getImpact,
	getMetrics,
	seedSchema,
	seedGraphToDb,
} from "../controllers/scan.controller.js";

const router = Router();

// POST /api/scan   → trigger a scan
router.post("/scan", postScan);

// GET  /api/graph/:repoId  → get dependency/call graph for scanned repo
router.get("/graph/:repoId", getGraph);

// DELETE /api/graph/:repoId → delete stored graph for scanned repo
router.delete("/graph/:repoId", deleteGraph);

// POST /api/db/seed/schema → create constraints/indexes
router.post("/db/seed/schema", seedSchema);

// POST /api/db/seed/graph/:repoId → seed parser graph JSON to Neo4j
router.post("/db/seed/graph/:repoId", seedGraphToDb);

// GET /api/metrics/:scanId → graph metrics for dashboard
router.get("/metrics/:scanId", getMetrics);

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
