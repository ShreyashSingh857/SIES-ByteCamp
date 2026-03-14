import simpleGit from "simple-git";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { execFile } from "child_process";
import { promisify } from "util";
import { randomUUID } from "crypto";
import {
  getImpactedNodesByNode,
  getGraphMetrics,
  setupDatabaseSchema,
  seedParsedGraph,
} from "../db/neo4j.queries.js";

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, "../../..");
const WORKSPACE_ROOT = path.join(PROJECT_ROOT, "workspace");
const REPOSITORIES_ROOT = path.join(WORKSPACE_ROOT, "repositories");
const GRAPHS_ROOT = path.join(WORKSPACE_ROOT, "graphs");
const AI_ENGINE_ENTRY = path.join(PROJECT_ROOT, "AI-Engine", "src", "index.js");

function buildUniqueRepoDir(repoUrl) {
  const baseName = path.basename(repoUrl).replace(/\.git$/i, "") || "repo";
  const safe = baseName.toLowerCase().replace(/[^a-z0-9-_]/g, "-");
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return path.join(REPOSITORIES_ROOT, `${safe}-${suffix}`);
}

function getRepoIdFromCloneDir(cloneDir) {
  return path.basename(cloneDir);
}

function assertValidRepoId(repoId) {
  if (!repoId || !/^[a-zA-Z0-9-_]+$/.test(repoId)) {
    throw new Error("Invalid repoId format");
  }
}

function getGraphFilePath(repoId) {
  assertValidRepoId(repoId);
  return path.join(GRAPHS_ROOT, `${repoId}.json`);
}

function normalizeNeo4jNumber(value) {
  if (typeof value === "number") return value;
  if (value && typeof value.toNumber === "function") return value.toNumber();
  return Number(value || 0);
}

function buildSeedPayloadFromParser(repoId, parserResult, scanId) {
  const nowIso = new Date().toISOString();
  const serviceId = `svc:${scanId}:${repoId}`;
  const idMap = new Map();

  const fileNodes = (parserResult?.nodes || []).filter((n) => n.type === "FILE");
  const functionNodes = (parserResult?.nodes || []).filter((n) => n.type === "FUNCTION");

  const files = fileNodes.map((n) => {
    const id = `file:${scanId}:${n.id}`;
    idMap.set(n.id, id);
    return {
      id,
      serviceId,
      scanId,
      path: n.name,
      language: n.language || "unknown",
      extension: path.extname(n.name || "") || "",
      lineCount: 0,
      importCount: 0,
      exportCount: 0,
      parsedAt: nowIso,
    };
  });

  const functions = functionNodes.map((n) => {
    const id = `fn:${scanId}:${n.id}`;
    idMap.set(n.id, id);
    return {
      id,
      fileId: `file:${scanId}:file:${n.file}`,
      serviceId,
      scanId,
      name: n.name || "anonymous",
      qualifiedName: `${n.file || "unknown"}.${n.name || "anonymous"}`,
      isExported: false,
      isAsync: false,
      visibility: "default",
      lineStart: n.line || 0,
      lineEnd: n.line || 0,
      paramTypes: [],
      returnType: "unknown",
    };
  });

  const containsEdges = [
    ...files.map((f) => ({ fromId: serviceId, toId: f.id })),
    ...functions.map((fn) => ({ fromId: fn.fileId, toId: fn.id })),
  ];

  const dependencyEdges = (parserResult?.edges || [])
    .filter((e) => ["IMPORTS", "CALLS"].includes(e.type))
    .map((e) => ({ fromId: idMap.get(e.from), toId: idMap.get(e.to), type: e.type }))
    .filter((e) => e.fromId && e.toId);

  return {
    scanNode: {
      id: scanId,
      status: "COMPLETE",
      repoUrls: [],
      fileCount: files.length,
      nodeCount: files.length + functions.length + 2,
      edgeCount: containsEdges.length + dependencyEdges.length,
      durationMs: 0,
      userId: "system",
      createdAt: nowIso,
      completedAt: nowIso,
    },
    serviceNode: {
      id: serviceId,
      scanId,
      name: repoId,
      language: parserResult?.summary?.languages?.[0] || "unknown",
      repoUrl: "",
      rootPath: "/",
      framework: "none",
      fileCount: files.length,
      detectedAt: nowIso,
    },
    files,
    functions,
    containsEdges,
    dependencyEdges,
  };
}

/**
 * @desc    Clone a public repo and return scan result
 * @route   POST /api/scan
 * @body    { repoUrl: "https://github.com/user/repo" }
 * @access  Public
 */
export const postScan = async (req, res, next) => {
  const { repoUrl } = req.body;

  if (!repoUrl || typeof repoUrl !== "string") {
    return res.status(400).json({ success: false, message: "repoUrl is required" });
  }

  // Accept public HTTP(S) URLs and absolute local paths.
  const isHttpUrl = /^https?:\/\/[^\s]+$/i.test(repoUrl);
  const isLocalAbsolutePath = path.isAbsolute(repoUrl);
  if (!isHttpUrl && !isLocalAbsolutePath) {
    return res.status(400).json({
      success: false,
      message: "repoUrl must be a public http(s) URL or absolute local path",
    });
  }

  const cloneDir = buildUniqueRepoDir(repoUrl);
  const repoId = getRepoIdFromCloneDir(cloneDir);

  try {
    fs.mkdirSync(REPOSITORIES_ROOT, { recursive: true });
    await simpleGit().clone(repoUrl, cloneDir);

    const { stdout } = await execFileAsync(
      process.execPath,
      [AI_ENGINE_ENTRY, "--repo", cloneDir],
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

    fs.mkdirSync(GRAPHS_ROOT, { recursive: true });
    fs.writeFileSync(getGraphFilePath(repoId), JSON.stringify(parserResult, null, 2), "utf8");

    res.status(200).json({
      success: true,
      message: "Repository cloned and parsed successfully",
      data: {
        repoId,
        repoUrl,
        workspaceDir: WORKSPACE_ROOT,
        repositoriesDir: REPOSITORIES_ROOT,
        clonedRepoPath: cloneDir,
        parserInputPath: cloneDir,
        graphPath: getGraphFilePath(repoId),
        graphApi: `/api/graph/${repoId}`,
        parserSummary: parserResult?.summary || null,
      },
    });
  } catch (error) {
    const err = new Error(`Failed to clone/parse repository: ${error.message}`);
    err.status = 422;
    next(err);
  }
};

/**
 * Normalise a raw parser edge { from, to, type } into the shape the frontend
 * Cytoscape view and Redux graphSlice expect: { id, source, target, type }.
 * Also passes through edges that already use source/target (future-proofing).
 */
function normalizeEdge(edge, index) {
  const source = edge.source ?? edge.from ?? null;
  const target = edge.target ?? edge.to ?? null;
  return {
    id: edge.id || `edge-${index}`,
    source,
    target,
    type: edge.type || "UNKNOWN",
  };
}

/**
 * @desc    Return parser graph as nodes + edges for a scanned repo
 * @route   GET /api/graph/:repoId
 * @access  Public
 */
export const getGraph = async (req, res, next) => {
  try {
    const { repoId } = req.params;
    const graphFilePath = getGraphFilePath(repoId);

    if (!fs.existsSync(graphFilePath)) {
      return res.status(404).json({
        success: false,
        message: `No graph found for repoId: ${repoId}`,
      });
    }

    const parserResult = JSON.parse(fs.readFileSync(graphFilePath, "utf8"));

    // Normalise edges so the frontend always receives { id, source, target, type }
    const rawEdges = parserResult?.edges || [];
    const edges = rawEdges.map(normalizeEdge);

    res.status(200).json({
      success: true,
      repoId,
      data: {
        nodes: parserResult?.nodes || [],
        edges,
        summary: parserResult?.summary || null,
        // Forward LLM insights when the graph was scanned with --with-llm
        llmInsights: parserResult?.llmInsights || null,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete stored parser graph for a scanned repo
 * @route   DELETE /api/graph/:repoId
 * @access  Public
 */
export const deleteGraph = async (req, res, next) => {
  try {
    const { repoId } = req.params;
    const graphFilePath = getGraphFilePath(repoId);

    if (!fs.existsSync(graphFilePath)) {
      return res.status(404).json({
        success: false,
        message: `No graph found for repoId: ${repoId}`,
      });
    }

    fs.unlinkSync(graphFilePath);

    res.status(200).json({
      success: true,
      repoId,
      message: "Graph deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Seed Neo4j constraints/indexes for graph schema
 * @route   POST /api/db/seed/schema
 * @access  Public
 */
export const seedSchema = async (_req, res, next) => {
  try {
    await setupDatabaseSchema();
    res.status(200).json({ success: true, message: "Schema seed completed" });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Seed stored parser graph into Neo4j
 * @route   POST /api/db/seed/graph/:repoId
 * @access  Public
 */
export const seedGraphToDb = async (req, res, next) => {
  try {
    const { repoId } = req.params;
    const graphFilePath = getGraphFilePath(repoId);
    if (!fs.existsSync(graphFilePath)) {
      return res.status(404).json({ success: false, message: `No graph found for repoId: ${repoId}` });
    }

    const parserResult = JSON.parse(fs.readFileSync(graphFilePath, "utf8"));
    const scanId = req.body?.scanId || `scan-${randomUUID()}`;
    const payload = buildSeedPayloadFromParser(repoId, parserResult, scanId);
    payload.scanNode.repoUrls = [req.body?.repoUrl || ""];
    payload.serviceNode.repoUrl = req.body?.repoUrl || "";

    await seedParsedGraph(payload);

    res.status(200).json({
      success: true,
      message: "Graph seeded into Neo4j",
      data: {
        repoId,
        scanId,
        fileCount: payload.files.length,
        functionCount: payload.functions.length,
        dependencyCount: payload.dependencyEdges.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Return graph metrics for a scan
 * @route   GET /api/metrics/:scanId
 * @access  Public
 */
export const getMetrics = async (req, res, next) => {
  try {
    const { scanId } = req.params;
    if (!scanId) {
      return res.status(400).json({ success: false, message: "scanId is required" });
    }

    const metrics = await getGraphMetrics(scanId);
    res.status(200).json({
      success: true,
      data: {
        scanId,
        totalServices: normalizeNeo4jNumber(metrics.totalServices),
        totalDependencies: normalizeNeo4jNumber(metrics.totalDependencies),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Return impact analysis result
 * @route   GET /api/impact
 * @access  Public
 */
export const getImpact = async (_req, res, next) => {
  try {
    const node = _req.query.node;
    const scanId = _req.query.scanId || null;

    if (!node || typeof node !== "string") {
      return res.status(400).json({
        success: false,
        message: "Query param 'node' is required",
      });
    }

    const impactedNodesRaw = await getImpactedNodesByNode(node, scanId);
    const impactedNodes = impactedNodesRaw.map((item) => ({
      ...item,
      hops: normalizeNeo4jNumber(item.hops),
    }));

    res.status(200).json({
      success: true,
      data: {
        node,
        scanId,
        count: impactedNodes.length,
        impactedNodes,
      },
    });
  } catch (error) {
    if (error?.message?.includes("Neo4j is not configured")) {
      return res.status(503).json({ success: false, message: error.message });
    }
    next(error);
  }
};
