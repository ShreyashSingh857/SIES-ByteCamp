import { Router } from "express";
import { postScan, getGraph, deleteGraph, getImpact } from "../controllers/scan.controller.js";

const router = Router();

// POST /api/scan   → trigger a scan
router.post("/scan", postScan);

// GET  /api/graph/:repoId  → get dependency/call graph for scanned repo
router.get("/graph/:repoId", getGraph);

// DELETE /api/graph/:repoId → delete stored graph for scanned repo
router.delete("/graph/:repoId", deleteGraph);

// GET  /api/impact → get impact analysis
router.get("/impact", getImpact);

export default router;
