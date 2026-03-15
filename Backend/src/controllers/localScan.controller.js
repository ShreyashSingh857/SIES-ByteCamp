import path from 'path';
import fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import {
  AI_ENGINE_ENTRY,
  PROJECT_ROOT,
  REPOSITORIES_ROOT,
  buildSeedPayloadFromParser,
  createScanId,
  getGraphFilePath,
  writeStoredGraph,
} from '../services/scan-workspace.service.js';
import { seedParsedGraph, setupDatabaseSchema } from '../db/neo4j.queries.js';
import { startLocalWatch } from '../services/localWatcher.service.js';

const execFileAsync = promisify(execFile);

/**
 * @desc   Scan a local directory path, seed into Neo4j, then start file watching.
 * @route  POST /api/scan/local
 * @body   { localPath: "/absolute/path/to/repo" }
 * @access Public
 *
 * Response shape mirrors postScan exactly so the frontend can reuse the same Redux logic.
 */
export const postLocalScan = async (req, res, next) => {
  const { localPath } = req.body;

  // -- Validation -------------------------------------------------------------
  if (!localPath || typeof localPath !== 'string') {
    return res.status(400).json({ success: false, message: 'localPath is required' });
  }

  if (!path.isAbsolute(localPath)) {
    return res.status(400).json({
      success: false,
      message: 'localPath must be an absolute path (e.g. /home/user/myproject or C:\\Users\\user\\myproject)',
    });
  }

  if (!fs.existsSync(localPath)) {
    return res.status(400).json({
      success: false,
      message: `Directory does not exist: ${localPath}`,
    });
  }

  if (!fs.statSync(localPath).isDirectory()) {
    return res.status(400).json({
      success: false,
      message: `Path is not a directory: ${localPath}`,
    });
  }

  // -- Build stable repoId from directory name + timestamp --------------------
  const baseName = path.basename(localPath).toLowerCase().replace(/[^a-z0-9-_]/g, '-');
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const repoId = `${baseName}-${suffix}`;
  const scanId = createScanId();

  try {
    // -- Step 1: Run AI Engine on the local path -----------------------------
    const { stdout } = await execFileAsync(
      process.execPath,
      [AI_ENGINE_ENTRY, '--repo', localPath],
      {
        cwd: PROJECT_ROOT,
        maxBuffer: 20 * 1024 * 1024,
      }
    );

    let parserResult = null;
    try {
      parserResult = JSON.parse(stdout);
    } catch {
      parserResult = { raw: stdout };
    }

    // -- Step 2: Persist the graph JSON to workspace/graphs/<repoId>.json ----
    writeStoredGraph(repoId, parserResult);

    // -- Step 3: Seed into Neo4j (best-effort, non-fatal if Neo4j is absent) -
    let seedResult = null;
    let seedError = null;
    try {
      await setupDatabaseSchema();
      const payload = buildSeedPayloadFromParser(repoId, parserResult, scanId);
      payload.scanNode.repoUrls = [localPath];
      payload.serviceNode.repoUrl = localPath;
      await seedParsedGraph(payload);
      seedResult = {
        fileCount: payload.files.length,
        functionCount: payload.functions.length,
        dependencyCount: payload.dependencyEdges.length,
      };
    } catch (err) {
      // Neo4j may not be configured - log and continue
      seedError = err.message;
      console.warn('[LocalScan] Neo4j seed failed (impact analysis may be unavailable):', err.message);
    }

    // -- Step 4: Start the file-system watcher -------------------------------
    startLocalWatch(repoId, scanId, localPath);

    // -- Step 5: Respond - same shape as postScan so frontend code is reused -
    return res.status(200).json({
      success: true,
      message: 'Local repository scanned and watcher started',
      data: {
        repoId,
        scanId,
        repoUrl: localPath,
        branch: null,
        workspaceDir: path.join(PROJECT_ROOT, 'workspace'),
        clonedRepoPath: localPath,
        graphPath: getGraphFilePath(repoId),
        graphApi: `/api/graph/${repoId}`,
        parserSummary: parserResult?.summary || null,
        neo4j: seedResult,
        neo4jError: seedError,
        isLocal: true,
        watching: true,
      },
    });
  } catch (error) {
    const err = new Error(`Failed to scan local repository: ${error.message}`);
    err.status = 422;
    next(err);
  }
};

/**
 * @desc   Stop watching a local repo that was registered via POST /api/scan/local
 * @route  DELETE /api/scan/local/:repoId
 * @access Public
 */
export const deleteLocalWatch = async (req, res, next) => {
  try {
    const { repoId } = req.params;
    const { stopLocalWatch, isWatching } = await import('../services/localWatcher.service.js');

    if (!isWatching(repoId)) {
      return res.status(404).json({ success: false, message: `No active watcher for repoId: ${repoId}` });
    }

    stopLocalWatch(repoId);
    return res.status(200).json({ success: true, message: `Watcher stopped for repoId: ${repoId}` });
  } catch (error) {
    next(error);
  }
};
