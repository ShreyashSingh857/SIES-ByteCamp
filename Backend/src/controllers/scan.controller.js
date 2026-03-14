import simpleGit from "simple-git";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { execFile } from "child_process";
import { promisify } from "util";
import { randomUUID } from "crypto";
import {
  getImpactedNodesByNode,
  getRelatedFilesByPath,
  getGraphMetrics,
  setupDatabaseSchema,
  seedParsedGraph,
  findSymbolOccurrences,
  getNodeDependencies,
  traceSymbolDependencies,
  getSymbolReferences,
} from "../db/neo4j.queries.js";
import {
  analyzeDependenciesWithLLM,
  generateArchitectureSummary,
  inferImplicitDependencies,
} from "../services/llm.service.js";

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

function sanitizeSelectedText(rawText, maxLength = 1000) {
  const value = String(rawText || "").replace(/\s+/g, " ").trim();
  if (!value) return "";
  if (value.length <= maxLength) return value;
  return value.slice(0, maxLength);
}

function extractSearchCandidates(rawText) {
  const cleaned = sanitizeSelectedText(rawText, 1000);
  if (!cleaned) return [];

  const tokens = cleaned
    .split(/[^a-zA-Z0-9_$./:-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);

  return [...new Set([cleaned, ...tokens])].slice(0, 8);
}

function getPreferredSymbolForTracing(candidates) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return "";
  }
  return candidates.find((candidate) => !candidate.includes(" ")) || candidates[0];
}

function calculateChainDepth(symbolDependencies) {
  const edges = symbolDependencies?.edges || [];
  if (!edges.length) return 0;
  return 1;
}

function buildLlmGraphContext(symbolOccurrences, dependencyMap, symbolDependencies) {
  const nodesById = new Map();
  const edgesById = new Map();

  for (const occurrence of symbolOccurrences || []) {
    if (!occurrence?.id) continue;
    nodesById.set(String(occurrence.id), {
      id: String(occurrence.id),
      name: occurrence.displayName || occurrence.id,
      type: occurrence.type || "Unknown",
      filePath: occurrence.filePath || "",
      lineNumber: occurrence.lineNumber || 0,
    });
  }

  for (const [nodeId, deps] of Object.entries(dependencyMap || {})) {
    const outgoing = deps?.outgoing || [];
    const incoming = deps?.incoming || [];

    for (const dep of [...outgoing, ...incoming]) {
      const sourceId = String(dep.sourceId || dep.targetId || "");
      const targetId = String(dep.targetId || dep.sourceId || "");

      if (sourceId) {
        nodesById.set(sourceId, {
          id: sourceId,
          name: dep.sourceName || sourceId,
          type: dep.sourceType || "Unknown",
        });
      }

      if (targetId) {
        nodesById.set(targetId, {
          id: targetId,
          name: dep.targetName || targetId,
          type: dep.targetType || "Unknown",
        });
      }

      const edgeId = `${nodeId}:${sourceId}:${dep.relationshipType || "REL"}:${targetId}`;
      edgesById.set(edgeId, {
        id: edgeId,
        source: sourceId,
        target: targetId,
        type: dep.relationshipType || "RELATED_TO",
        properties: dep.relationshipProps || {},
      });
    }
  }

  for (const node of symbolDependencies?.nodes || []) {
    const nodeId = String(node.id || "");
    if (!nodeId) continue;
    nodesById.set(nodeId, {
      ...(nodesById.get(nodeId) || {}),
      ...node,
      id: nodeId,
    });
  }

  for (const edge of symbolDependencies?.edges || []) {
    const edgeId = String(edge.id || `${edge.source}-${edge.type}-${edge.target}`);
    edgesById.set(edgeId, {
      ...edge,
      id: edgeId,
      source: String(edge.source || ""),
      target: String(edge.target || ""),
    });
  }

  return {
    nodes: Array.from(nodesById.values()).slice(0, 300),
    edges: Array.from(edgesById.values()).slice(0, 450),
  };
}

function buildSeedPayloadFromParser(repoId, parserResult, scanId) {
  const nowIso = new Date().toISOString();
  const serviceId = `svc:${scanId}:${repoId}`;
  const idMap = new Map();

  const fileNodes = (parserResult?.nodes || []).filter((n) => n.type === "FILE");
  const functionNodes = (parserResult?.nodes || []).filter((n) => n.type === "FUNCTION");
  const filePathToRawId = new Map(fileNodes.map((n) => [n.name, n.id]));

  const resolveImportedFileRawId = (sourceRawFileId, moduleSpecifier) => {
    if (!sourceRawFileId || !moduleSpecifier || !moduleSpecifier.startsWith(".")) return null;

    const sourcePath = sourceRawFileId.replace(/^file:/, "");
    const sourceDir = path.posix.dirname(sourcePath);
    const baseResolved = path.posix.normalize(path.posix.join(sourceDir, moduleSpecifier));

    const candidates = [];
    const hasExt = Boolean(path.posix.extname(baseResolved));

    if (hasExt) {
      candidates.push(baseResolved);
    } else {
      const exts = [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".json"];
      for (const ext of exts) {
        candidates.push(`${baseResolved}${ext}`);
        candidates.push(path.posix.join(baseResolved, `index${ext}`));
      }
    }

    for (const candidate of candidates) {
      const matchedRawId = filePathToRawId.get(candidate);
      if (matchedRawId) return matchedRawId;
    }

    return null;
  };

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
    .map((e) => {
      let fromRawId = e.from;
      let toRawId = e.to;

      if (
        e.type === "IMPORTS" &&
        typeof e.from === "string" &&
        e.from.startsWith("file:") &&
        typeof e.to === "string" &&
        e.to.startsWith("module:")
      ) {
        const moduleSpecifier = e.to.slice("module:".length);
        const resolvedRawFileId = resolveImportedFileRawId(e.from, moduleSpecifier);
        if (resolvedRawFileId) {
          toRawId = resolvedRawFileId;
          fromRawId = e.from;
        }
      }

      return {
        fromId: idMap.get(fromRawId),
        toId: idMap.get(toRawId),
        type: e.type,
      };
    })
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

/**
 * @desc    Return related files for a file path from Neo4j (live)
 * @route   GET /api/impact/files?scanId=...&filePath=...
 * @access  Public
 */
export const getFileRelations = async (req, res, next) => {
  try {
    const scanId = req.query.scanId;
    const filePath = req.query.filePath;

    if (!scanId || typeof scanId !== "string") {
      return res.status(400).json({
        success: false,
        message: "Query param 'scanId' is required",
      });
    }

    if (!filePath || typeof filePath !== "string") {
      return res.status(400).json({
        success: false,
        message: "Query param 'filePath' is required",
      });
    }

    const result = await getRelatedFilesByPath(scanId, filePath);

    res.status(200).json({
      success: true,
      data: {
        scanId,
        filePath,
        incoming: result.incoming,
        outgoing: result.outgoing,
      },
    });
  } catch (error) {
    if (error?.message?.includes("Neo4j is not configured")) {
      return res.status(503).json({ success: false, message: error.message });
    }
    next(error);
  }
};

/**
 * @desc    Analyze dependencies for selected text in code editor
 * @route   POST /api/analyze/dependencies
 * @access  Public
 */
export const analyzeDependencies = async (req, res, next) => {
  try {
    const { repoId, currentFile, selectedText } = req.body;

    if (!repoId || !selectedText) {
      return res.status(400).json({
        success: false,
        message: "repoId and selectedText are required",
      });
    }

    const graphFilePath = getGraphFilePath(repoId);

    if (!fs.existsSync(graphFilePath)) {
      return res.status(404).json({
        success: false,
        message: `No graph found for repoId: ${repoId}`,
      });
    }

    const parserResult = JSON.parse(fs.readFileSync(graphFilePath, "utf8"));
    const files = (parserResult?.nodes || []).filter((n) => n.type === "FILE");

    const dependencies = [];
    const searchText = selectedText.trim();

    // Search through all files for occurrences of the selected text
    for (const fileNode of files) {
      const filePath = fileNode.name;

      // Skip the current file
      if (currentFile && filePath === currentFile) {
        continue;
      }

      try {
        // Construct the full path to the repository clone
        const repoPath = path.join(REPOSITORIES_ROOT);

        // Find the cloned repo directory for this repoId
        const repoDirs = fs.readdirSync(REPOSITORIES_ROOT).filter((name) => name.includes(repoId.split('-').slice(0, 2).join('-')));

        if (repoDirs.length === 0) {
          continue;
        }

        const repoDir = path.join(REPOSITORIES_ROOT, repoDirs[0]);
        const fullPath = path.join(repoDir, filePath);

        // Check if file exists and is readable
        if (!fs.existsSync(fullPath)) {
          continue;
        }

        const fileContent = fs.readFileSync(fullPath, "utf8");
        const lines = fileContent.split("\n");

        // Find lines containing the selected text
        lines.forEach((line, lineIdx) => {
          if (line.includes(searchText)) {
            // Extract context (3 lines before and after)
            const start = Math.max(0, lineIdx - 2);
            const end = Math.min(lines.length, lineIdx + 3);
            const snippet = lines.slice(start, end).join("\n");

            dependencies.push({
              filePath: filePath,
              lineNumber: lineIdx + 1,
              codeSnippet: snippet,
            });
          }
        });
      } catch (err) {
        // Skip files that can't be read
        continue;
      }
    }

    res.status(200).json({
      success: true,
      data: {
        repoId,
        selectedText,
        dependenciesFound: dependencies.length,
        dependencies,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Analyze dependencies using Neo4j + LLM intelligence
 * @route   POST /api/analyze/dependencies-llm
 * @access  Public
 */
export const analyzeDependenciesWithIntelligence = async (req, res, next) => {
  try {
    const {
      repoId,
      scanId,
      currentFile,
      selectedText,
      selectedSnippet,
      surroundingContext,
      lineRange,
      withLLM = true,
    } = req.body;

    const normalizedSelectedText = sanitizeSelectedText(selectedText, 2000);
    const searchCandidates = extractSearchCandidates(normalizedSelectedText);
    const preferredSymbol = getPreferredSymbolForTracing(searchCandidates);

    if (!normalizedSelectedText) {
      return res.status(400).json({
        success: false,
        message: "selectedText is required",
      });
    }

    if (!scanId) {
      return res.status(400).json({
        success: false,
        message: "scanId is required for Neo4j analysis",
      });
    }

    // Step 1: Find symbol occurrences in Neo4j using robust candidate matching
    let symbolOccurrences = [];
    const seenOccurrenceIds = new Set();
    for (const candidate of searchCandidates) {
      try {
        const matches = await findSymbolOccurrences(candidate, scanId);
        for (const match of matches) {
          const key = String(match.id || `${match.filePath}:${match.lineNumber}:${match.displayName}`);
          if (!seenOccurrenceIds.has(key)) {
            seenOccurrenceIds.add(key);
            symbolOccurrences.push(match);
          }
        }
      } catch (err) {
        console.warn(`Neo4j symbol search failed for "${candidate}":`, err.message);
      }
    }

    if (symbolOccurrences.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          selectedText: normalizedSelectedText,
          scanId,
          searchCandidates,
          symbolOccurrences: [],
          dependencies: [],
          llmAnalysis: withLLM
            ? {
              status: "skipped",
              message: "No occurrences found",
              model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
            }
            : null,
          message: "No symbol occurrences found in database",
        },
      });
    }

    // Step 2: Get dependencies for each occurrence
    const dependencyMap = {};
    for (const occurrence of symbolOccurrences) {
      try {
        const deps = await getNodeDependencies(occurrence.id, scanId);
        dependencyMap[occurrence.id] = deps;
      } catch (err) {
        console.warn(`Failed to get dependencies for ${occurrence.id}:`, err.message);
        dependencyMap[occurrence.id] = { incoming: [], outgoing: [] };
      }
    }

    // Step 3: Trace complete dependency chains
    let symbolDependencies = { nodes: [], edges: [] };
    try {
      if (preferredSymbol) {
        symbolDependencies = await traceSymbolDependencies(preferredSymbol, scanId, 4);
      }
    } catch (err) {
      console.warn("Failed to trace symbol dependencies:", err.message);
      symbolDependencies = { nodes: [], edges: [] };
    }

    // Step 4: Get symbol references
    let references = [];
    try {
      if (preferredSymbol) {
        references = await getSymbolReferences(preferredSymbol, scanId);
      }
    } catch (err) {
      console.warn("Failed to get symbol references:", err.message);
    }

    const llmGraphContext = buildLlmGraphContext(
      symbolOccurrences,
      dependencyMap,
      symbolDependencies
    );

    const dependencySummary = {
      occurrenceCount: symbolOccurrences.length,
      uniqueFiles: [...new Set(symbolOccurrences.map((occurrence) => occurrence.filePath).filter(Boolean))].length,
      relationshipNodes: Object.keys(dependencyMap).length,
      referenceFiles: references.length,
      chainDepth: calculateChainDepth(symbolDependencies),
      relationshipTypes: [
        ...new Set(
          Object.values(dependencyMap)
            .flatMap((deps) => [...(deps?.incoming || []), ...(deps?.outgoing || [])])
            .map((dep) => dep.relationshipType)
            .filter(Boolean)
        ),
      ],
    };

    // Step 5: Use LLM to analyze if requested
    let llmAnalysis = null;
    if (withLLM) {
      llmAnalysis = await analyzeDependenciesWithLLM(
        normalizedSelectedText,
        llmGraphContext,
        symbolOccurrences,
        {
          currentFile,
          selectedSnippet,
          surroundingContext,
          lineRange,
          references,
          dependencySummary,
        }
      );
    }

    res.status(200).json({
      success: true,
      data: {
        selectedText: normalizedSelectedText,
        searchCandidates,
        preferredSymbol,
        scanId,
        summary: {
          occurrencesFound: dependencySummary.occurrenceCount,
          uniqueFiles: dependencySummary.uniqueFiles,
          relationshipsFound: dependencySummary.relationshipNodes,
          chainDepth: dependencySummary.chainDepth,
          relationshipTypes: dependencySummary.relationshipTypes,
        },
        symbolOccurrences: symbolOccurrences.map(o => ({
          id: o.id,
          displayName: o.displayName,
          type: o.type,
          filePath: o.filePath,
          lineNumber: o.lineNumber,
          context: o.context,
        })),
        dependencies: {
          perNode: dependencyMap,
          chain: symbolDependencies,
        },
        references: references,
        llmContext: {
          currentFile,
          lineRange: lineRange || null,
          selectedSnippet: selectedSnippet || normalizedSelectedText,
          surroundingContext: surroundingContext || null,
        },
        llmAnalysis: llmAnalysis,
      },
    });
  } catch (error) {
    console.error("Error in analyzeDependenciesWithIntelligence:", error);
    next(error);
  }
};
