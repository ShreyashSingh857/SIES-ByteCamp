import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const PROJECT_ROOT = path.resolve(__dirname, "../../..");
export const WORKSPACE_ROOT = path.join(PROJECT_ROOT, "workspace");
export const REPOSITORIES_ROOT = path.join(WORKSPACE_ROOT, "repositories");
export const GRAPHS_ROOT = path.join(WORKSPACE_ROOT, "graphs");
export const WEBHOOKS_ROOT = path.join(WORKSPACE_ROOT, "webhooks");
export const WEBHOOK_JOBS_ROOT = path.join(WORKSPACE_ROOT, "webhook-jobs");
export const AI_ENGINE_ENTRY = path.join(PROJECT_ROOT, "AI-Engine", "src", "index.js");
export const AI_ENGINE_AGENT_ENTRY = path.join(PROJECT_ROOT, "AI-Engine", "src", "agent.js");

export function ensureWorkspaceDirectories() {
  fs.mkdirSync(REPOSITORIES_ROOT, { recursive: true });
  fs.mkdirSync(GRAPHS_ROOT, { recursive: true });
  fs.mkdirSync(WEBHOOKS_ROOT, { recursive: true });
  fs.mkdirSync(WEBHOOK_JOBS_ROOT, { recursive: true });
}

export function createScanId() {
  return `scan-${randomUUID()}`;
}

export function buildUniqueRepoDir(repoUrl) {
  const baseName = path.basename(repoUrl).replace(/\.git$/i, "") || "repo";
  const safe = baseName.toLowerCase().replace(/[^a-z0-9-_]/g, "-");
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return path.join(REPOSITORIES_ROOT, `${safe}-${suffix}`);
}

export function getRepoIdFromCloneDir(cloneDir) {
  return path.basename(cloneDir);
}

export function assertValidRepoId(repoId) {
  if (!repoId || !/^[a-zA-Z0-9-_]+$/.test(repoId)) {
    throw new Error("Invalid repoId format");
  }
}

export function getGraphFilePath(repoId) {
  assertValidRepoId(repoId);
  return path.join(GRAPHS_ROOT, `${repoId}.json`);
}

export function readStoredGraph(repoId) {
  const graphFilePath = getGraphFilePath(repoId);
  if (!fs.existsSync(graphFilePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(graphFilePath, "utf8"));
}

export function writeStoredGraph(repoId, graphData) {
  fs.mkdirSync(GRAPHS_ROOT, { recursive: true });
  fs.writeFileSync(getGraphFilePath(repoId), JSON.stringify(graphData, null, 2), "utf8");
}

export function extractRepoFullName(repoUrl) {
  try {
    const parsed = new URL(repoUrl);
    if (parsed.hostname !== "github.com") {
      return null;
    }
    const parts = parsed.pathname.replace(/^\/+|\/+$/g, "").replace(/\.git$/i, "").split("/");
    if (parts.length < 2) {
      return null;
    }
    return `${parts[0]}/${parts[1]}`;
  } catch {
    return null;
  }
}

export function normalizeParserEdge(edge, index = 0) {
  const source = edge?.source ?? edge?.from ?? null;
  const target = edge?.target ?? edge?.to ?? null;
  return {
    id: edge?.id || `edge-${index}`,
    source,
    target,
    type: edge?.type || "UNKNOWN",
  };
}

export function buildSeedPayloadFromParser(repoId, parserResult, scanId) {
  const nowIso = new Date().toISOString();
  const serviceId = `svc:${scanId}:${repoId}`;
  const idMap = new Map();

  const fileNodes = (parserResult?.nodes || []).filter((node) => node.type === "FILE");
  const functionNodes = (parserResult?.nodes || []).filter((node) => node.type === "FUNCTION");
  const filePathToRawId = new Map(fileNodes.map((node) => [node.name, node.id]));

  const resolveImportedFileRawId = (sourceRawFileId, moduleSpecifier) => {
    if (!sourceRawFileId || !moduleSpecifier || !moduleSpecifier.startsWith(".")) {
      return null;
    }

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
      if (matchedRawId) {
        return matchedRawId;
      }
    }

    return null;
  };

  const files = fileNodes.map((node) => {
    const id = `file:${scanId}:${node.id}`;
    idMap.set(node.id, id);
    return {
      id,
      serviceId,
      scanId,
      path: node.name,
      language: node.language || "unknown",
      extension: path.extname(node.name || "") || "",
      lineCount: 0,
      importCount: 0,
      exportCount: 0,
      parsedAt: nowIso,
    };
  });

  const functions = functionNodes.map((node) => {
    const id = `fn:${scanId}:${node.id}`;
    idMap.set(node.id, id);
    return {
      id,
      fileId: `file:${scanId}:file:${node.file}`,
      serviceId,
      scanId,
      name: node.name || "anonymous",
      qualifiedName: `${node.file || "unknown"}.${node.name || "anonymous"}`,
      isExported: false,
      isAsync: false,
      visibility: "default",
      lineStart: node.line || 0,
      lineEnd: node.line || 0,
      paramTypes: [],
      returnType: "unknown",
    };
  });

  const containsEdges = [
    ...files.map((file) => ({ fromId: serviceId, toId: file.id })),
    ...functions.map((fn) => ({ fromId: fn.fileId, toId: fn.id })),
  ];

  const dependencyEdges = (parserResult?.edges || [])
    .filter((edge) => ["IMPORTS", "CALLS"].includes(edge.type))
    .map((edge) => {
      let fromRawId = edge.from;
      let toRawId = edge.to;

      if (
        edge.type === "IMPORTS" &&
        typeof edge.from === "string" &&
        edge.from.startsWith("file:") &&
        typeof edge.to === "string" &&
        edge.to.startsWith("module:")
      ) {
        const moduleSpecifier = edge.to.slice("module:".length);
        const resolvedRawFileId = resolveImportedFileRawId(edge.from, moduleSpecifier);
        if (resolvedRawFileId) {
          fromRawId = edge.from;
          toRawId = resolvedRawFileId;
        }
      }

      return {
        fromId: idMap.get(fromRawId),
        toId: idMap.get(toRawId),
        type: edge.type,
      };
    })
    .filter((edge) => edge.fromId && edge.toId);

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
