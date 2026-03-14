import { Router } from "express";
import { postScan, getGraph, getImpact } from "../controllers/scan.controller.js";

const router = Router();

// POST /api/scan   → trigger a scan
router.post("/scan", postScan);

// GET  /api/graph  → get dependency/call graph
router.get("/graph", getGraph);

// GET  /api/impact → get impact analysis
router.get("/impact", getImpact);

export default router;
