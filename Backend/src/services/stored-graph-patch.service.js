import { normalizeParserEdge, readStoredGraph, writeStoredGraph } from "./scan-workspace.service.js";

function getNodeFilePath(node) {
  if (!node) {
    return null;
  }

  if (node.type === "FILE") {
    return node.name || node.path || null;
  }

  if (node.type === "FUNCTION") {
    return node.file || null;
  }

  return node.file || node.path || null;
}

function buildSummary(graphData) {
  const files = Array.isArray(graphData?.nodes) ? graphData.nodes : [];
  return {
    scannedFiles: files.filter((node) => node.type === "FILE").length,
    parsedFiles: files.filter((node) => node.type === "FILE").length,
    nodes: files.length,
    edges: Array.isArray(graphData?.edges) ? graphData.edges.length : 0,
    languages: Array.from(
      new Set(
        files
          .map((node) => node.language || node.lang)
          .filter(Boolean)
      )
    ).sort(),
  };
}

export function mergeParserGraph(existingGraph, partialGraph, { removedFiles = [] } = {}) {
  const previousNodes = Array.isArray(existingGraph?.nodes) ? existingGraph.nodes : [];
  const previousEdges = (existingGraph?.edges || []).map((edge, index) => normalizeParserEdge(edge, index));
  const nextNodes = Array.isArray(partialGraph?.nodes) ? partialGraph.nodes : [];
  const nextEdges = (partialGraph?.edges || []).map((edge, index) => normalizeParserEdge(edge, index));

  const changedFilePaths = new Set(
    nextNodes
      .map((node) => (node.type === "FILE" ? node.name || node.path : null))
      .filter(Boolean)
  );
  const removedFilePaths = new Set((removedFiles || []).filter(Boolean));

  const existingChangedNodes = previousNodes.filter((node) => changedFilePaths.has(getNodeFilePath(node)));
  const existingRemovedNodes = previousNodes.filter((node) => removedFilePaths.has(getNodeFilePath(node)));
  const newNodeIds = new Set(nextNodes.map((node) => node.id));
  const staleNodeIds = new Set(
    existingChangedNodes
      .map((node) => node.id)
      .filter((nodeId) => !newNodeIds.has(nodeId))
  );
  const removedNodeIds = new Set([
    ...existingRemovedNodes.map((node) => node.id),
    ...staleNodeIds,
  ]);
  const replacedNodeIds = new Set(existingChangedNodes.map((node) => node.id));
  const removedSourceIds = new Set(existingRemovedNodes.map((node) => node.id));

  const retainedNodes = previousNodes.filter((node) => {
    const filePath = getNodeFilePath(node);
    return !changedFilePaths.has(filePath) && !removedFilePaths.has(filePath);
  });

  const retainedEdges = previousEdges.filter((edge) => {
    const sourceId = edge.source;
    const targetId = edge.target;

    if (removedNodeIds.has(sourceId) || removedNodeIds.has(targetId)) {
      return false;
    }
    if (replacedNodeIds.has(sourceId) || removedSourceIds.has(sourceId)) {
      return false;
    }
    return true;
  });

  const edgeMap = new Map(retainedEdges.map((edge) => [`${edge.source}|${edge.type}|${edge.target}`, edge]));
  for (const edge of nextEdges) {
    edgeMap.set(`${edge.source}|${edge.type}|${edge.target}`, edge);
  }

  const mergedGraph = {
    ...existingGraph,
    ...partialGraph,
    nodes: [...retainedNodes, ...nextNodes],
    edges: Array.from(edgeMap.values()),
  };
  mergedGraph.summary = buildSummary(mergedGraph);

  return {
    mergedGraph,
    patch: {
      graphData: mergedGraph,
      nodes: nextNodes,
      edges: nextEdges,
      removedNodeIds: Array.from(removedNodeIds),
      changedFilePaths: Array.from(changedFilePaths),
      removedFilePaths: Array.from(removedFilePaths),
      summary: mergedGraph.summary,
    },
  };
}

export function patchStoredGraph(repoId, partialGraph, options = {}) {
  const existingGraph = readStoredGraph(repoId) || { nodes: [], edges: [], summary: null };
  const { mergedGraph, patch } = mergeParserGraph(existingGraph, partialGraph, options);
  writeStoredGraph(repoId, mergedGraph);
  return patch;
}
