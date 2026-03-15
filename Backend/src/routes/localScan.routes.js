import { Router } from 'express';
import { postLocalScan, deleteLocalWatch, getLocalFileContent } from '../controllers/localScan.controller.js';

const router = Router();

// POST /api/scan/local - initial scan of a local directory + start watcher
router.post('/local', postLocalScan);

// DELETE /api/scan/local/:repoId - stop watching a local repo
router.delete('/local/:repoId', deleteLocalWatch);

// GET /api/scan/local/:repoId/file?filePath=src/index.js - read a local file by repoId
router.get('/local/:repoId/file', getLocalFileContent);

export default router;
