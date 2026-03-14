import simpleGit from "simple-git";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";
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
  generatePerFileDependencyInsights,
  generateArchitectureSummary,
  inferImplicitDependencies,
  generateDetailedImpactRefactorPlan,
} from "../services/llm.service.js";
import { saveWebhookSubscription } from "../db/webhook.queries.js";
import { registerWebhookForRepo } from "../services/github-webhook-registration.service.js";
import { broadcast } from "../services/sse.service.js";
import {
  AI_ENGINE_ENTRY,
  AI_ENGINE_AGENT_ENTRY,
  PROJECT_ROOT,
  WORKSPACE_ROOT,
  REPOSITORIES_ROOT,
  assertValidRepoId,
  buildSeedPayloadFromParser,
  buildUniqueRepoDir,
  createScanId,
  extractRepoFullName,
  getGraphFilePath,
  getRepoIdFromCloneDir,
  normalizeParserEdge,
  writeStoredGraph,
} from "../services/scan-workspace.service.js";

const execFileAsync = promisify(execFile);

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

const LOCAL_TEXT_FILE_EXTENSIONS = new Set([
  ".js", ".jsx", ".ts", ".tsx", ".json", ".md", ".txt", ".css", ".scss", ".sass", ".less",
  ".html", ".htm", ".xml", ".yml", ".yaml", ".env", ".properties", ".ini", ".toml",
  ".py", ".java", ".go", ".rb", ".rs", ".php", ".cs", ".cpp", ".c", ".h", ".hpp",
  ".sql", ".sh", ".bash", ".zsh", ".mjs", ".cjs", ".graphql",
]);

function normalizeRepoFilePath(filePath) {
  return String(filePath || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/\.(?=\/|$)/g, "")
    .trim();
}

function isLikelyTextFile(filePath) {
  const extension = path.extname(String(filePath || "")).toLowerCase();
  if (extension && LOCAL_TEXT_FILE_EXTENSIONS.has(extension)) {
    return true;
  }

  const basename = path.basename(String(filePath || "")).toLowerCase();
  return basename === "dockerfile" || basename === "makefile";
}

function resolveLocalRepoPath(repoId) {
  assertValidRepoId(repoId);
  const localPath = path.resolve(REPOSITORIES_ROOT, repoId);
  if (!localPath.startsWith(path.resolve(REPOSITORIES_ROOT))) {
    throw new Error("Invalid repository path");
  }
  if (!fs.existsSync(localPath) || !fs.statSync(localPath).isDirectory()) {
    throw new Error(`Local repository not found for repoId: ${repoId}`);
  }
  return localPath;
}

function resolveFilePathWithinRepo(repoId, filePath) {
  const normalizedFilePath = normalizeRepoFilePath(filePath);
  if (!normalizedFilePath) {
    throw new Error("filePath is required");
  }

  const localRepoPath = resolveLocalRepoPath(repoId);
  const absoluteFilePath = path.resolve(localRepoPath, normalizedFilePath);

  if (!absoluteFilePath.startsWith(localRepoPath)) {
    throw new Error("filePath cannot escape the repository root");
  }

  return {
    localRepoPath,
    absoluteFilePath,
    normalizedFilePath,
  };
}

function createStableHash(input) {
  return crypto.createHash("sha256").update(String(input || "")).digest("hex");
}

function computeLineDiffStats(originalContent, updatedContent) {
  const originalLines = String(originalContent || "").split(/\r?\n/);
  const updatedLines = String(updatedContent || "").split(/\r?\n/);
  const maxLength = Math.max(originalLines.length, updatedLines.length);

  let changedLineCount = 0;
  let addedLineCount = 0;
  let removedLineCount = 0;

  for (let index = 0; index < maxLength; index += 1) {
    const oldLine = originalLines[index];
    const newLine = updatedLines[index];

    if (oldLine === undefined && newLine !== undefined) {
      addedLineCount += 1;
      changedLineCount += 1;
      continue;
    }

    if (oldLine !== undefined && newLine === undefined) {
      removedLineCount += 1;
      changedLineCount += 1;
      continue;
    }

    if (oldLine !== newLine) {
      changedLineCount += 1;
    }
  }

  return {
    changedLineCount,
    addedLineCount,
    removedLineCount,
    originalLineCount: originalLines.length,
    updatedLineCount: updatedLines.length,
    changed: changedLineCount > 0,
  };
}

function summarizeFileRelations(fileRelations) {
  const incoming = fileRelations?.incoming || [];
  const outgoing = fileRelations?.outgoing || [];
  const staticIncoming = fileRelations?.staticIncoming || [];
  const staticOutgoing = fileRelations?.staticOutgoing || [];
  const runtimeIncoming = fileRelations?.runtimeIncoming || [];
  const runtimeOutgoing = fileRelations?.runtimeOutgoing || [];

  return {
    incomingCount: incoming.length,
    outgoingCount: outgoing.length,
    staticIncomingCount: staticIncoming.length,
    staticOutgoingCount: staticOutgoing.length,
    runtimeIncomingCount: runtimeIncoming.length,
    runtimeOutgoingCount: runtimeOutgoing.length,
    totalRelatedFiles: new Set([...incoming, ...outgoing]).size,
  };
}

function buildImpactAcknowledgementToken({ repoId, filePath, updatedContent, diffStats, relationSummary }) {
  const payload = {
    repoId,
    filePath,
    updatedContentHash: createStableHash(updatedContent),
    diffStats,
    relationSummary,
  };

  return createStableHash(JSON.stringify(payload));
}

async function runDependencyAgentForEditedContent({ localRepoPath, filePath, updatedContent, withLlm }) {
  const absolutePath = path.resolve(localRepoPath, filePath);
  const originalContent = fs.readFileSync(absolutePath, "utf8");

  let stdout = "";
  const args = [
    AI_ENGINE_AGENT_ENTRY,
    "--repo",
    localRepoPath,
    "--changed",
    filePath,
  ];

  if (withLlm) {
    args.push("--with-llm");
  }

  try {
    fs.writeFileSync(absolutePath, updatedContent, "utf8");
    const runResult = await execFileAsync(process.execPath, args, {
      cwd: PROJECT_ROOT,
      maxBuffer: 20 * 1024 * 1024,
    });
    stdout = runResult.stdout || "";
  } finally {
    fs.writeFileSync(absolutePath, originalContent, "utf8");
  }

  if (!stdout.trim()) {
    return null;
  }

  try {
    return JSON.parse(stdout);
  } catch {
    return {
      status: "failed",
      reason: "Unable to parse dependency agent output",
      rawOutput: stdout,
    };
  }
}

async function runDependencyAgentFromDisk({ localRepoPath, filePath, withLlm }) {
  const args = [
    AI_ENGINE_AGENT_ENTRY,
    "--repo",
    localRepoPath,
    "--changed",
    filePath,
  ];

  if (withLlm) {
    args.push("--with-llm");
  }

  const { stdout } = await execFileAsync(process.execPath, args, {
    cwd: PROJECT_ROOT,
    maxBuffer: 20 * 1024 * 1024,
  });

  if (!stdout?.trim()) {
    return null;
  }

  try {
    return JSON.parse(stdout);
  } catch {
    return {
      status: "failed",
      reason: "Unable to parse dependency agent output",
      rawOutput: stdout,
    };
  }
}

function collectChangedLineSamples(originalContent, updatedContent, maxSamples = 60) {
  const originalLines = String(originalContent || "").split(/\r?\n/);
  const updatedLines = String(updatedContent || "").split(/\r?\n/);
  const maxLength = Math.max(originalLines.length, updatedLines.length);
  const samples = [];

  for (let index = 0; index < maxLength; index += 1) {
    const before = originalLines[index];
    const after = updatedLines[index];

    if (before === after) {
      continue;
    }

    samples.push({
      lineNumber: index + 1,
      before: before ?? "",
      after: after ?? "",
    });

    if (samples.length >= maxSamples) {
      break;
    }
  }

  return samples;
}

function readFileContentWithinRepo(localRepoPath, relativePath) {
  const normalized = normalizeRepoFilePath(relativePath);
  const absolute = path.resolve(localRepoPath, normalized);
  if (!absolute.startsWith(localRepoPath)) {
    return null;
  }
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
    return null;
  }

  try {
    return fs.readFileSync(absolute, "utf8");
  } catch {
    return null;
  }
}

function collectRelatedFileContexts(localRepoPath, filePath, fileRelations, maxFiles = 12) {
  const relationPaths = [
    ...(fileRelations?.incoming || []),
    ...(fileRelations?.outgoing || []),
    ...(fileRelations?.staticIncoming || []),
    ...(fileRelations?.staticOutgoing || []),
    ...(fileRelations?.runtimeIncoming || []),
    ...(fileRelations?.runtimeOutgoing || []),
  ];

  const uniquePaths = [...new Set(relationPaths.map((item) => normalizeRepoFilePath(item)).filter(Boolean))]
    .filter((item) => item !== normalizeRepoFilePath(filePath))
    .slice(0, maxFiles);

  return uniquePaths
    .map((relatedPath) => {
      const content = readFileContentWithinRepo(localRepoPath, relatedPath);
      if (typeof content !== "string") {
        return null;
      }

      return {
        filePath: relatedPath,
        content,
      };
    })
    .filter(Boolean);
}

function applyLineLevelEditToContent(content, edit) {
  const lines = String(content || "").split(/\r?\n/);
  const targetIndex = Number(edit.lineNumber || 0) - 1;
  const oldText = String(edit.oldText || "");
  const newText = String(edit.newText || "");

  let applied = false;

  if (targetIndex >= 0 && targetIndex < lines.length) {
    if (oldText) {
      if (lines[targetIndex].includes(oldText)) {
        lines[targetIndex] = lines[targetIndex].replace(oldText, newText);
        applied = true;
      }
    } else {
      lines[targetIndex] = newText;
      applied = true;
    }
  }

  if (!applied && oldText) {
    const joined = lines.join("\n");
    if (joined.includes(oldText)) {
      return {
        content: joined.replace(oldText, newText),
        applied: true,
      };
    }
  }

  return {
    content: lines.join("\n"),
    applied,
  };
}

function applyDetailedFileEdits(localRepoPath, detailedPlan) {
  const edits = Array.isArray(detailedPlan?.plan?.fileEdits) ? detailedPlan.plan.fileEdits : [];
  const groupedByFile = new Map();

  for (const edit of edits) {
    const normalizedPath = normalizeRepoFilePath(edit.filePath);
    if (!normalizedPath) {
      continue;
    }

    if (!groupedByFile.has(normalizedPath)) {
      groupedByFile.set(normalizedPath, []);
    }

    groupedByFile.get(normalizedPath).push(edit);
  }

  const appliedEdits = [];
  const skippedEdits = [];

  for (const [relativePath, fileEdits] of groupedByFile.entries()) {
    const absolute = path.resolve(localRepoPath, relativePath);
    if (!absolute.startsWith(localRepoPath) || !fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
      for (const edit of fileEdits) {
        skippedEdits.push({ ...edit, reason: edit.reason || "File not found" });
      }
      continue;
    }

    let content = fs.readFileSync(absolute, "utf8");
    let fileChanged = false;

    for (const edit of fileEdits) {
      const result = applyLineLevelEditToContent(content, edit);
      if (result.applied) {
        content = result.content;
        fileChanged = true;
        appliedEdits.push(edit);
      } else {
        skippedEdits.push({ ...edit, reason: edit.reason || "Exact text not found" });
      }
    }

    if (fileChanged) {
      fs.writeFileSync(absolute, content, "utf8");
    }
  }

  return {
    appliedCount: appliedEdits.length,
    skippedCount: skippedEdits.length,
    appliedEdits,
    skippedEdits,
  };
}


const STATIC_RELATIONSHIP_TYPES = new Set([
  "IMPORTS",
  "CALLS",
  "DEPENDS_ON",
  "USES",
  "EXTENDS",
  "IMPLEMENTS",
  "INHERITS",
  "READS",
  "WRITES",
  "RELATES_TO",
]);

const RUNTIME_RELATIONSHIP_TYPES = new Set([
  "CONSUMES_API",
  "EXPOSES_API",
  "USES_TABLE",
  "USES_FIELD",
  "EMITS_EVENT",
  "LISTENS_EVENT",
  "READS_ENV",
  "USES_CACHE",
  "RUNTIME_CALL",
]);

function normalizeRelationshipType(value) {
  return String(value || "RELATED_TO").trim().toUpperCase();
}

function isTruthyFlag(value) {
  if (value === true) return true;
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function classifyDependencyNature(relationshipType, relationshipProps = {}) {
  const normalizedType = normalizeRelationshipType(relationshipType);

  if (isTruthyFlag(relationshipProps?.runtimeDependency)) {
    return "runtime";
  }

  if (isTruthyFlag(relationshipProps?.staticDependency)) {
    return "static";
  }

  if (RUNTIME_RELATIONSHIP_TYPES.has(normalizedType)) {
    return "runtime";
  }

  if (STATIC_RELATIONSHIP_TYPES.has(normalizedType)) {
    return "static";
  }

  return "unknown";
}

function createFileContextBucket(filePath) {
  return {
    filePath,
    occurrences: [],
    dependencies: [],
    referencedFunctions: [],
  };
}

function buildFileDependencyContexts(symbolOccurrences, dependencyMap, references) {
  const fileMap = new Map();

  const ensureBucket = (filePath) => {
    const safePath = String(filePath || "").trim() || "unknown";
    if (!fileMap.has(safePath)) {
      fileMap.set(safePath, createFileContextBucket(safePath));
    }
    return fileMap.get(safePath);
  };

  for (const occurrence of symbolOccurrences || []) {
    const bucket = ensureBucket(occurrence?.filePath);

    bucket.occurrences.push({
      id: occurrence?.id,
      displayName: occurrence?.displayName,
      type: occurrence?.type,
      lineNumber: occurrence?.lineNumber || 0,
      context: occurrence?.context || "",
    });

    const nodeDeps = dependencyMap?.[occurrence?.id] || { incoming: [], outgoing: [] };
    const mergedDeps = [
      ...(nodeDeps?.incoming || []).map((dep) => ({ ...dep, direction: "incoming" })),
      ...(nodeDeps?.outgoing || []).map((dep) => ({ ...dep, direction: "outgoing" })),
    ];

    for (const dep of mergedDeps) {
      const direction = dep.direction || "outgoing";
      const relationshipType = normalizeRelationshipType(dep.relationshipType);
      const dependencyNature = classifyDependencyNature(relationshipType, dep.relationshipProps || {});
      const relatedEntity = direction === "incoming"
        ? dep.sourceName || dep.sourceId || "unknown"
        : dep.targetName || dep.targetId || "unknown";
      const relatedId = direction === "incoming"
        ? String(dep.sourceId || "")
        : String(dep.targetId || "");
      const relatedType = direction === "incoming"
        ? dep.sourceType || "Unknown"
        : dep.targetType || "Unknown";

      bucket.dependencies.push({
        direction,
        relationshipType,
        dependencyNature,
        relatedId,
        relatedEntity,
        relatedType,
        properties: dep.relationshipProps || {},
      });
    }
  }

  for (const reference of references || []) {
    const bucket = ensureBucket(reference?.filePath);
    const functionNames = (reference?.functions || [])
      .map((fn) => String(fn?.qualifiedName || fn?.name || "").trim())
      .filter(Boolean);

    bucket.referencedFunctions = [...new Set([...bucket.referencedFunctions, ...functionNames])];
  }

  for (const bucket of fileMap.values()) {
    const seenKeys = new Set();
    bucket.dependencies = bucket.dependencies.filter((dep) => {
      const key = [
        dep.direction,
        dep.relationshipType,
        dep.dependencyNature,
        dep.relatedId,
        dep.relatedEntity,
      ].join("::");
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    });
  }

  return [...fileMap.values()].sort((a, b) => {
    const weightA = (a.occurrences?.length || 0) * 2 + (a.dependencies?.length || 0);
    const weightB = (b.occurrences?.length || 0) * 2 + (b.dependencies?.length || 0);
    return weightB - weightA;
  });
}

function summarizeStaticRuntimeDependencies(fileContexts) {
  const relationshipBreakdown = {};
  const staticFiles = new Set();
  const runtimeFiles = new Set();

  let staticDependencyCount = 0;
  let runtimeDependencyCount = 0;
  let unknownDependencyCount = 0;

  for (const context of fileContexts || []) {
    for (const dep of context?.dependencies || []) {
      const relType = normalizeRelationshipType(dep.relationshipType);
      relationshipBreakdown[relType] = (relationshipBreakdown[relType] || 0) + 1;

      if (dep.dependencyNature === "static") {
        staticDependencyCount += 1;
        staticFiles.add(context.filePath);
      } else if (dep.dependencyNature === "runtime") {
        runtimeDependencyCount += 1;
        runtimeFiles.add(context.filePath);
      } else {
        unknownDependencyCount += 1;
      }
    }
  }

  return {
    totalFiles: fileContexts?.length || 0,
    staticDependencyCount,
    runtimeDependencyCount,
    unknownDependencyCount,
    filesWithStaticDependencies: [...staticFiles].sort((a, b) => a.localeCompare(b)),
    filesWithRuntimeDependencies: [...runtimeFiles].sort((a, b) => a.localeCompare(b)),
    relationshipBreakdown,
  };
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

/**
 * @desc    Clone a public repo and return scan result
 * @route   POST /api/scan
 * @body    { repoUrl: "https://github.com/user/repo" }
 * @access  Public
 */
export const postScan = async (req, res, next) => {
  const { repoUrl, githubToken, branch } = req.body;

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
  const scanId = createScanId();
  const requestedBranch = typeof branch === "string" && branch.trim() ? branch.trim() : "main";

  try {
    fs.mkdirSync(REPOSITORIES_ROOT, { recursive: true });
    const cloneArgs = isLocalAbsolutePath
      ? []
      : ["--branch", requestedBranch, "--single-branch"];
    try {
      await simpleGit().clone(repoUrl, cloneDir, cloneArgs);
    } catch (cloneError) {
      if (isLocalAbsolutePath || !requestedBranch) {
        throw cloneError;
      }
      await simpleGit().clone(repoUrl, cloneDir);
    }

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

    writeStoredGraph(repoId, parserResult);

    let webhookInfo = null;
    const repoFullName = extractRepoFullName(repoUrl);
    const effectiveGithubToken = githubToken || process.env.GITHUB_TOKEN || "";
    if (repoFullName && effectiveGithubToken) {
      try {
        const { hookId, secret } = await registerWebhookForRepo(repoFullName, effectiveGithubToken);
        await saveWebhookSubscription({
          repoId,
          scanId,
          repoFullName,
          repoUrl,
          branch: requestedBranch,
          localPath: cloneDir,
          hookId,
          secret,
        });
        webhookInfo = { registered: true, repoFullName, hookId };
      } catch (webhookError) {
        webhookInfo = {
          registered: false,
          repoFullName,
          message: webhookError.message,
        };
      }
    }

    res.status(200).json({
      success: true,
      message: "Repository cloned and parsed successfully",
      data: {
        repoId,
        scanId,
        repoUrl,
        branch: requestedBranch,
        workspaceDir: WORKSPACE_ROOT,
        repositoriesDir: REPOSITORIES_ROOT,
        clonedRepoPath: cloneDir,
        parserInputPath: cloneDir,
        graphPath: getGraphFilePath(repoId),
        graphApi: `/api/graph/${repoId}`,
        parserSummary: parserResult?.summary || null,
        webhook: webhookInfo,
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
  return normalizeParserEdge(edge, index);
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
    const scanId = req.body?.scanId || createScanId();
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
        staticIncoming: result.staticIncoming || [],
        staticOutgoing: result.staticOutgoing || [],
        runtimeIncoming: result.runtimeIncoming || [],
        runtimeOutgoing: result.runtimeOutgoing || [],
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
      // Fallback: scan repository files for literal text matches.
      // This keeps the UX useful even when the selection is not a clean symbol present in Neo4j.
      let textMatches = [];
      let fallbackOccurrences = [];
      let fallbackFileContexts = [];

      try {
        if (repoId) {
          const graphFilePath = getGraphFilePath(repoId);
          if (fs.existsSync(graphFilePath)) {
            const parserResult = JSON.parse(fs.readFileSync(graphFilePath, "utf8"));
            const files = (parserResult?.nodes || []).filter((n) => n.type === "FILE");
            const searchText = normalizedSelectedText.trim();

            const repoDirs = fs
              .readdirSync(REPOSITORIES_ROOT)
              .filter((name) => name.includes(repoId.split("-").slice(0, 2).join("-")));

            if (repoDirs.length > 0 && searchText) {
              const repoDir = path.join(REPOSITORIES_ROOT, repoDirs[0]);

              const contextByFile = new Map();

              for (const fileNode of files) {
                const candidatePath = fileNode.name;
                if (!candidatePath) continue;
                if (currentFile && candidatePath === currentFile) continue;

                const fullPath = path.join(repoDir, candidatePath);
                if (!fs.existsSync(fullPath)) continue;

                let fileContent = "";
                try {
                  fileContent = fs.readFileSync(fullPath, "utf8");
                } catch {
                  continue;
                }

                const lines = fileContent.split("\n");
                for (let lineIdx = 0; lineIdx < lines.length; lineIdx += 1) {
                  const line = lines[lineIdx];
                  if (!line || !line.includes(searchText)) continue;

                  const start = Math.max(0, lineIdx - 2);
                  const end = Math.min(lines.length, lineIdx + 3);
                  const snippet = lines.slice(start, end).join("\n");

                  const match = {
                    filePath: candidatePath,
                    lineNumber: lineIdx + 1,
                    lineText: String(line).trim().slice(0, 180),
                    codeSnippet: snippet,
                  };
                  textMatches.push(match);

                  if (!contextByFile.has(candidatePath)) {
                    contextByFile.set(candidatePath, {
                      filePath: candidatePath,
                      occurrences: [],
                      dependencies: [],
                      referencedFunctions: [],
                    });
                  }

                  contextByFile.get(candidatePath).occurrences.push({
                    id: `${candidatePath}:${lineIdx + 1}`,
                    displayName: match.lineText || "text match",
                    type: "TEXT_MATCH",
                    lineNumber: lineIdx + 1,
                    context: snippet,
                  });

                  fallbackOccurrences.push({
                    id: `${candidatePath}:${lineIdx + 1}`,
                    displayName: match.lineText || "text match",
                    type: "TextMatch",
                    filePath: candidatePath,
                    lineNumber: lineIdx + 1,
                    context: snippet,
                  });
                }
              }

              fallbackFileContexts = [...contextByFile.values()].sort((a, b) => {
                const aCount = a.occurrences?.length || 0;
                const bCount = b.occurrences?.length || 0;
                return bCount - aCount;
              });
            }
          }
        }
      } catch (err) {
        console.warn("Fallback repo scan failed:", err.message);
      }

      if (fallbackFileContexts.length > 0) {
        const staticRuntimeDependencies = summarizeStaticRuntimeDependencies(fallbackFileContexts);
        const personalizedInsights = await generatePerFileDependencyInsights(
          normalizedSelectedText,
          fallbackFileContexts,
          {
            currentFile,
            implicitDependencies: null,
            staticRuntimeSummary: staticRuntimeDependencies,
            model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
          }
        );

        return res.status(200).json({
          success: true,
          data: {
            selectedText: normalizedSelectedText,
            scanId,
            searchCandidates,
            symbolOccurrences: fallbackOccurrences,
            dependencies: {
              perNode: {},
              chain: { nodes: [], edges: [] },
            },
            references: [],
            staticRuntimeDependencies,
            implicitDependencies: null,
            personalizedInsights,
            contentMatches: textMatches.slice(0, 500),
            message: "No Neo4j symbol matches; showing literal text matches across the repo.",
          },
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          selectedText: normalizedSelectedText,
          scanId,
          searchCandidates,
          symbolOccurrences: [],
          dependencies: [],
          llmAnalysis: null,
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

    const fileDependencyContexts = buildFileDependencyContexts(
      symbolOccurrences,
      dependencyMap,
      references
    );

    const staticRuntimeDependencies = summarizeStaticRuntimeDependencies(fileDependencyContexts);

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

    // Step 6: infer implicit/runtime dependencies from selected code + graph context
    let implicitDependencies = null;
    if (withLLM) {
      implicitDependencies = await inferImplicitDependencies(
        selectedSnippet || normalizedSelectedText,
        {
          selectedText: normalizedSelectedText,
          currentFile,
          lineRange: lineRange || null,
          dependencySummary,
          staticRuntimeDependencies,
          topFiles: fileDependencyContexts.slice(0, 25).map((fileCtx) => ({
            filePath: fileCtx.filePath,
            occurrenceCount: fileCtx.occurrences.length,
            dependencyCount: fileCtx.dependencies.length,
          })),
        }
      );
    }

    // Step 7: generate personalized dependency response for each related file
    let personalizedInsights = {
      status: "skipped",
      message: "Per-file personalization skipped",
      files: [],
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    };

    if (fileDependencyContexts.length > 0) {
      personalizedInsights = await generatePerFileDependencyInsights(
        normalizedSelectedText,
        fileDependencyContexts,
        {
          currentFile,
          implicitDependencies: implicitDependencies?.inferredDependencies || null,
          staticRuntimeSummary: staticRuntimeDependencies,
          model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
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
        staticRuntimeDependencies,
        implicitDependencies,
        personalizedInsights,
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

/**
 * @desc    Read editable file content from cloned repository
 * @route   GET /api/editor/file?repoId=...&filePath=...
 * @access  Public
 */
export const getEditableFileContent = async (req, res, next) => {
  try {
    const repoId = String(req.query.repoId || "").trim();
    const filePath = String(req.query.filePath || "").trim();

    if (!repoId || !filePath) {
      return res.status(400).json({
        success: false,
        message: "repoId and filePath are required",
      });
    }

    if (!isLikelyTextFile(filePath)) {
      return res.status(415).json({
        success: false,
        message: "Only text-like files are editable from this endpoint",
      });
    }

    const { absoluteFilePath, normalizedFilePath } = resolveFilePathWithinRepo(repoId, filePath);

    if (!fs.existsSync(absoluteFilePath) || !fs.statSync(absoluteFilePath).isFile()) {
      return res.status(404).json({
        success: false,
        message: `File not found: ${normalizedFilePath}`,
      });
    }

    const content = fs.readFileSync(absoluteFilePath, "utf8");
    const stats = fs.statSync(absoluteFilePath);

    return res.status(200).json({
      success: true,
      data: {
        repoId,
        filePath: normalizedFilePath,
        content,
        sizeBytes: stats.size,
        updatedAt: stats.mtime.toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Preview impact of edited content and generate dependency-agent recommendations
 * @route   POST /api/editor/impact-preview
 * @access  Public
 */
export const previewEditorImpact = async (req, res, next) => {
  try {
    const {
      repoId,
      scanId,
      filePath,
      updatedContent,
      withLlm = false,
    } = req.body || {};

    if (!repoId || !filePath || typeof updatedContent !== "string") {
      return res.status(400).json({
        success: false,
        message: "repoId, filePath and updatedContent are required",
      });
    }

    if (!isLikelyTextFile(filePath)) {
      return res.status(415).json({
        success: false,
        message: "Only text-like files are supported for impact preview",
      });
    }

    const { localRepoPath, absoluteFilePath, normalizedFilePath } = resolveFilePathWithinRepo(repoId, filePath);

    if (!fs.existsSync(absoluteFilePath) || !fs.statSync(absoluteFilePath).isFile()) {
      return res.status(404).json({
        success: false,
        message: `File not found: ${normalizedFilePath}`,
      });
    }

    const originalContent = fs.readFileSync(absoluteFilePath, "utf8");
    const diffStats = computeLineDiffStats(originalContent, updatedContent);

    let fileRelations = {
      incoming: [],
      outgoing: [],
      staticIncoming: [],
      staticOutgoing: [],
      runtimeIncoming: [],
      runtimeOutgoing: [],
    };

    let relationError = null;
    if (scanId) {
      try {
        fileRelations = await getRelatedFilesByPath(scanId, normalizedFilePath);
      } catch (error) {
        relationError = error.message;
      }
    }

    const relationSummary = summarizeFileRelations(fileRelations);

    let agentRecommendations = null;
    if (diffStats.changed) {
      agentRecommendations = await runDependencyAgentForEditedContent({
        localRepoPath,
        filePath: normalizedFilePath,
        updatedContent,
        withLlm: Boolean(withLlm),
      });
    }

    let llmDetailedImpact = {
      status: "skipped",
      message: "Detailed LLM plan is disabled",
      plan: {
        summary: "",
        warnings: [],
        renameCandidates: [],
        fileEdits: [],
      },
    };

    if (diffStats.changed && withLlm) {
      const changedLines = collectChangedLineSamples(originalContent, updatedContent);
      const relatedFiles = collectRelatedFileContexts(localRepoPath, normalizedFilePath, fileRelations);

      llmDetailedImpact = await generateDetailedImpactRefactorPlan({
        repoId,
        scanId: scanId || null,
        changedFilePath: normalizedFilePath,
        changedLines,
        originalContent,
        updatedContent,
        relationSummary,
        relatedFiles,
      });
    }

    const acknowledgementToken = buildImpactAcknowledgementToken({
      repoId,
      filePath: normalizedFilePath,
      updatedContent,
      diffStats,
      relationSummary,
    });

    const preview = {
      repoId,
      scanId: scanId || null,
      filePath: normalizedFilePath,
      diffStats,
      relationSummary,
      fileRelations,
      relationError,
      agentRecommendations,
      llmDetailedImpact,
      acknowledgementToken,
      generatedAt: new Date().toISOString(),
    };

    broadcast(repoId, {
      type: "AGENT_IMPACT_PREVIEW",
      repoId,
      scanId: scanId || null,
      filePath: normalizedFilePath,
      changed: diffStats.changed,
      changedLineCount: diffStats.changedLineCount,
      relationSummary,
      timestamp: new Date().toISOString(),
    });

    return res.status(200).json({ success: true, data: preview });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Save edited file content after impact acknowledgment
 * @route   POST /api/editor/file/save
 * @access  Public
 */
export const saveEditedFileContent = async (req, res, next) => {
  try {
    const {
      repoId,
      scanId,
      filePath,
      updatedContent,
      acknowledged,
      acknowledgementToken,
      withLlm = false,
      autoApplyRelatedChanges = false,
    } = req.body || {};

    if (!repoId || !filePath || typeof updatedContent !== "string") {
      return res.status(400).json({
        success: false,
        message: "repoId, filePath and updatedContent are required",
      });
    }

    if (!acknowledged) {
      return res.status(400).json({
        success: false,
        message: "Impact acknowledgement is required before saving",
      });
    }

    if (!isLikelyTextFile(filePath)) {
      return res.status(415).json({
        success: false,
        message: "Only text-like files are editable from this endpoint",
      });
    }

    const { localRepoPath, absoluteFilePath, normalizedFilePath } = resolveFilePathWithinRepo(repoId, filePath);

    if (!fs.existsSync(absoluteFilePath) || !fs.statSync(absoluteFilePath).isFile()) {
      return res.status(404).json({
        success: false,
        message: `File not found: ${normalizedFilePath}`,
      });
    }

    const originalContent = fs.readFileSync(absoluteFilePath, "utf8");
    const diffStats = computeLineDiffStats(originalContent, updatedContent);

    if (!diffStats.changed) {
      return res.status(200).json({
        success: true,
        data: {
          saved: false,
          reason: "No content changes detected",
          repoId,
          filePath: normalizedFilePath,
          diffStats,
        },
      });
    }

    let fileRelations = {
      incoming: [],
      outgoing: [],
      staticIncoming: [],
      staticOutgoing: [],
      runtimeIncoming: [],
      runtimeOutgoing: [],
    };

    if (scanId) {
      try {
        fileRelations = await getRelatedFilesByPath(scanId, normalizedFilePath);
      } catch {
        fileRelations = {
          incoming: [],
          outgoing: [],
          staticIncoming: [],
          staticOutgoing: [],
          runtimeIncoming: [],
          runtimeOutgoing: [],
        };
      }
    }

    const relationSummary = summarizeFileRelations(fileRelations);
    const expectedToken = buildImpactAcknowledgementToken({
      repoId,
      filePath: normalizedFilePath,
      updatedContent,
      diffStats,
      relationSummary,
    });

    if (!acknowledgementToken || acknowledgementToken !== expectedToken) {
      return res.status(409).json({
        success: false,
        message: "Impact preview is outdated. Please preview impact again before saving.",
        data: {
          expectedAcknowledgementToken: expectedToken,
        },
      });
    }

    fs.writeFileSync(absoluteFilePath, updatedContent, "utf8");

    const stats = fs.statSync(absoluteFilePath);
    const agentRecommendations = await runDependencyAgentFromDisk({
      localRepoPath,
      filePath: normalizedFilePath,
      withLlm: Boolean(withLlm),
    });

    let llmDetailedImpact = {
      status: "skipped",
      message: "Detailed LLM plan is disabled",
      plan: {
        summary: "",
        warnings: [],
        renameCandidates: [],
        fileEdits: [],
      },
    };

    let relatedAutoApply = {
      enabled: Boolean(autoApplyRelatedChanges),
      appliedCount: 0,
      skippedCount: 0,
      appliedEdits: [],
      skippedEdits: [],
    };

    if (withLlm) {
      const changedLines = collectChangedLineSamples(originalContent, updatedContent);
      const relatedFiles = collectRelatedFileContexts(localRepoPath, normalizedFilePath, fileRelations);

      llmDetailedImpact = await generateDetailedImpactRefactorPlan({
        repoId,
        scanId: scanId || null,
        changedFilePath: normalizedFilePath,
        changedLines,
        originalContent,
        updatedContent,
        relationSummary,
        relatedFiles,
      });

      if (autoApplyRelatedChanges && llmDetailedImpact?.status === "completed") {
        relatedAutoApply = {
          enabled: true,
          ...applyDetailedFileEdits(localRepoPath, llmDetailedImpact),
        };
      }
    }

    broadcast(repoId, {
      type: "EDITOR_FILE_SAVED",
      repoId,
      scanId: scanId || null,
      filePath: normalizedFilePath,
      changedLineCount: diffStats.changedLineCount,
      timestamp: new Date().toISOString(),
    });

    broadcast(repoId, {
      type: "AGENT_RECOMMENDATIONS",
      repoId,
      scanId: scanId || null,
      filePath: normalizedFilePath,
      summary: agentRecommendations?.summary || null,
      timestamp: new Date().toISOString(),
    });

    if (relatedAutoApply.enabled) {
      broadcast(repoId, {
        type: "AGENT_RELATED_AUTOFIX",
        repoId,
        scanId: scanId || null,
        filePath: normalizedFilePath,
        appliedCount: relatedAutoApply.appliedCount,
        skippedCount: relatedAutoApply.skippedCount,
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        saved: true,
        repoId,
        scanId: scanId || null,
        filePath: normalizedFilePath,
        updatedAt: stats.mtime.toISOString(),
        diffStats,
        relationSummary,
        agentRecommendations,
        llmDetailedImpact,
        relatedAutoApply,
      },
    });
  } catch (error) {
    next(error);
  }
};
