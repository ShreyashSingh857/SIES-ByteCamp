import { Router } from 'express';
import {
  analyzeWithLLMAndImport,
  getScanStats,
  listScans,
  deleteScan,
} from '../controllers/import.controller.js';

const router = Router();

/**
 * POST /api/import/analyze-with-llm
 * Run AI-Engine with LLM and import to Neo4j
 */
router.post('/analyze-with-llm', analyzeWithLLMAndImport);

/**
 * GET /api/import/scans
 * List all scans
 */
router.get('/scans', listScans);

/**
 * GET /api/import/scans/:scanId
 * Get scan details and statistics
 */
router.get('/scans/:scanId', getScanStats);

/**
 * DELETE /api/import/scans/:scanId
 * Delete a scan
 */
router.delete('/scans/:scanId', deleteScan);

export default router;
