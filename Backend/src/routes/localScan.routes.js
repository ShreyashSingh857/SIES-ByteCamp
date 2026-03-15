import { Router } from 'express';
import { postLocalScan, deleteLocalWatch } from '../controllers/localScan.controller.js';

const router = Router();

// POST /api/scan/local - initial scan of a local directory + start watcher
router.post('/local', postLocalScan);

// DELETE /api/scan/local/:repoId - stop watching a local repo
router.delete('/local/:repoId', deleteLocalWatch);

export default router;
