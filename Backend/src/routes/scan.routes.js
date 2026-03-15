import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import {
	postScan,
	getGraph,
	deleteGraph,
	getImpact,
	getFileRelations,
	getMetrics,
	seedSchema,
	seedGraphToDb,
	analyzeDependencies,
	analyzeDependenciesWithIntelligence,
	getEditableFileContent,
	previewEditorImpact,
	saveEditedFileContent,
} from "../controllers/scan.controller.js";
import localScanRouter from "./localScan.routes.js";

const router = Router();

router.use(requireAuth);

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

// GET  /api/impact → get impact analysis
router.get("/impact", getImpact);

// GET /api/impact/files?scanId=...&filePath=... → related files for a file path
router.get("/impact/files", getFileRelations);

// POST /api/analyze/dependencies → analyze dependencies for selected text (basic file scan)
router.post("/analyze/dependencies", analyzeDependencies);

// POST /api/analyze/dependencies-llm → analyze dependencies with LLM + Neo4j (advanced)
router.post("/analyze/dependencies-llm", analyzeDependenciesWithIntelligence);

router.use("/scan", localScanRouter);
// GET /api/editor/file?repoId=...&filePath=... → load editable local file content
router.get("/editor/file", getEditableFileContent);

// POST /api/editor/impact-preview → preview change impact + dependency recommendations
router.post("/editor/impact-preview", previewEditorImpact);

// POST /api/editor/file/save → save edited file after impact acknowledgement
router.post("/editor/file/save", saveEditedFileContent);

export default router;
