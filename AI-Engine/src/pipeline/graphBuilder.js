function createGraphBuilder() {
  const nodeMap = new Map();
  const edgeMap = new Map();

  function upsertNode(node) {
    if (!nodeMap.has(node.id)) {
      nodeMap.set(node.id, node);
    }
    return nodeMap.get(node.id);
  }

  function upsertEdge(edge) {
    const key = `${edge.from}|${edge.type}|${edge.to}`;
    if (!edgeMap.has(key)) {
      edgeMap.set(key, edge);
    }
    return edgeMap.get(key);
  }

  return {
    upsertNode,
    upsertEdge,
    toJSON() {
      return {
        nodes: Array.from(nodeMap.values()),
        edges: Array.from(edgeMap.values()),
      };
    },
  };
}

module.exports = {
  createGraphBuilder,
};
