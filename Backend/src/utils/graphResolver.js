import { readStoredGraph } from "../services/scan-workspace.service.js";
import {
  findFileNodeByName,
  getForwardDependencies,
  getFunctionsInFile,
  getReverseDependencies,
  getTransitiveDependencies,
} from "../db/chat-graph.queries.js";

function normalizeFileName(raw) {
  return String(raw || "").trim().replace(/\\/g, "/").toLowerCase();
}

function resolveFromStoredGraph(graph, filePath) {
  const norm = normalizeFileName(filePath);
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph?.edges) ? graph.edges : [];

  const matchedNode = nodes.find((n) => normalizeFileName(n.name || n.id || "").includes(norm));
  if (!matchedNode) return null;

  const nodeId = matchedNode.id;
  const forwardDeps = edges
    .filter((e) => (e.source || e.from) === nodeId && e.type === "IMPORTS")
    .map((e) => {
      const targetId = e.target || e.to;
      const targetNode = nodes.find((n) => n.id === targetId);
      return { path: targetNode?.name || targetId, language: targetNode?.language || "unknown" };
    });

  const reverseDeps = edges
    .filter((e) => (e.target || e.to) === nodeId && e.type === "IMPORTS")
    .map((e) => {
      const sourceId = e.source || e.from;
      const sourceNode = nodes.find((n) => n.id === sourceId);
      return { path: sourceNode?.name || sourceId, language: sourceNode?.language || "unknown" };
    });

  const functions = nodes
    .filter((n) => n.type === "FUNCTION" && (n.file === matchedNode.name || n.id?.toLowerCase().includes(norm)))
    .map((n) => ({ name: n.name, lineStart: n.line || 0 }));

  return {
    file: { path: matchedNode.name, language: matchedNode.language || "unknown" },
    forwardDeps,
    reverseDeps,
    functions,
    source: "stored-graph",
    totalFiles: nodes.filter((n) => n.type === "FILE").length,
    totalEdges: edges.length,
  };
}

export async function resolveFileDependencies({ filePath, scanId, repoId }) {
  if (scanId) {
    try {
      const [fileNodes, forwardDeps, reverseDeps, functions, transitive] = await Promise.all([
        findFileNodeByName(filePath, scanId),
        getForwardDependencies(filePath, scanId),
        getReverseDependencies(filePath, scanId),
        getFunctionsInFile(filePath, scanId),
        getTransitiveDependencies(filePath, scanId, "BOTH", 3),
      ]);

      if (fileNodes.length > 0) {
        return { file: fileNodes[0], forwardDeps, reverseDeps, functions, transitive, source: "neo4j", totalFiles: null };
      }
    } catch (err) {
      console.warn("[graphResolver] Neo4j lookup failed, falling back to stored graph:", err.message);
    }
  }

  if (repoId) {
    const graph = readStoredGraph(repoId);
    if (graph) return resolveFromStoredGraph(graph, filePath);
  }
  return null;
}

export function extractFilenameFromMessage(message) {
  if (!message || typeof message !== "string") return null;

  const extPattern = /(?:^|\s|[`'"])([a-zA-Z0-9_\-./\\]+\.(?:js|ts|jsx|tsx|mjs|cjs|py|java|go|rb|cs|cpp|c|h|php|vue|svelte|rs|kt|swift))\b/gi;
  const extMatches = [...message.matchAll(extPattern)];
  if (extMatches.length > 0) {
    return extMatches[0][1].trim().replace(/^['"`]|['"`]$/g, "");
  }

  const keywordPattern = /(?:file|module|component|service|controller|util|helper|model)\s+[`'"]?([a-zA-Z0-9_\-./\\]+)[`'"]?/i;
  const kwMatch = message.match(keywordPattern);
  if (kwMatch) return kwMatch[1].trim();

  return null;
}
