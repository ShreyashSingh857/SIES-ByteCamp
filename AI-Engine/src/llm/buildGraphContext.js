function takeTopEntries(items, max) {
  return items.slice(0, Math.max(0, max));
}

function buildGraphContext(graph, options = {}) {
  const maxNodes = options.maxNodes ?? 500;
  const maxEdges = options.maxEdges ?? 1000;

  const nodes = takeTopEntries(graph.nodes ?? [], maxNodes);
  const edges = takeTopEntries(graph.edges ?? [], maxEdges);

  return {
    repositoryPath: graph.repositoryPath,
    summary: graph.summary,
    nodes,
    edges,
    metadata: {
      truncatedNodes: Math.max(0, (graph.nodes?.length ?? 0) - nodes.length),
      truncatedEdges: Math.max(0, (graph.edges?.length ?? 0) - edges.length),
    },
  };
}

module.exports = {
  buildGraphContext,
};
