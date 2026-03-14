const DEFAULT_TYPE_GROUPS = {
  structure: ['file', 'service', 'api_endpoint', 'db_table', 'api_contract'],
  behavior: ['function', 'api_endpoint', 'db_field', 'api_contract'],
  all: ['service', 'file', 'function', 'api_endpoint', 'db_table', 'db_field', 'api_contract'],
};

export const getDefaultVisibleTypes = (perspective) => DEFAULT_TYPE_GROUPS[perspective] || DEFAULT_TYPE_GROUPS.structure;

export const normalizeNodeType = (value) => {
  const type = String(value || '').trim().toLowerCase();
  const aliases = {
    service: 'service', file: 'file', function: 'function', method: 'function',
    apiendpoint: 'api_endpoint', api_endpoint: 'api_endpoint', endpoint: 'api_endpoint', api: 'api_endpoint',
    apicontract: 'api_contract', api_contract: 'api_contract', contract: 'api_contract',
    dbtable: 'db_table', db_table: 'db_table', table: 'db_table', schema: 'db_table', database: 'db_table',
    dbfield: 'db_field', db_field: 'db_field', field: 'db_field',
    module: 'service', external_service: 'service', symbol: 'function',
  };
  return aliases[type] || 'file';
};

const getNodePath = (node) => node.path || node.file || node.name || node.id;

const getDirectory = (value) => {
  const normalized = String(value || '').replace(/\\/g, '/');
  const idx = normalized.lastIndexOf('/');
  return idx > 0 ? normalized.slice(0, idx) : '';
};

const getParentFileKey = (node) => {
  if (node.normalizedType === 'file') return node.id;
  const rawFile = node.file || '';
  if (rawFile) return `file:${String(rawFile).replace(/\\/g, '/')}`;
  if (typeof node.id === 'string' && node.id.startsWith('function:')) {
    const hashIndex = node.id.indexOf('#');
    return hashIndex > 9 ? `file:${node.id.slice(9, hashIndex)}` : null;
  }
  return null;
};

const createAdjacency = (edges) => {
  const adjacency = new Map();
  edges.forEach((edge) => {
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, new Set());
    if (!adjacency.has(edge.target)) adjacency.set(edge.target, new Set());
    adjacency.get(edge.source).add(edge.target);
    adjacency.get(edge.target).add(edge.source);
  });
  return adjacency;
};

const getNeighborhoodIds = (selectedId, edges, depth) => {
  if (!selectedId) return null;
  const adjacency = createAdjacency(edges);
  const seen = new Set([selectedId]);
  const queue = [{ id: selectedId, depth: 0 }];
  while (queue.length) {
    const current = queue.shift();
    if (current.depth >= depth) continue;
    for (const next of adjacency.get(current.id) || []) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push({ id: next, depth: current.depth + 1 });
    }
  }
  return seen;
};

export const computeNodeSizesByDepth = (nodes, edges) => {
  const indegree = new Map(nodes.map((node) => [node.id, 0]));
  const outward = new Map(nodes.map((node) => [node.id, []]));
  edges.forEach((edge) => {
    if (!indegree.has(edge.source) || !indegree.has(edge.target)) return;
    indegree.set(edge.target, (indegree.get(edge.target) || 0) + 1);
    outward.get(edge.source).push(edge.target);
  });
  let roots = nodes.filter((node) => (indegree.get(node.id) || 0) === 0).map((node) => node.id);
  if (!roots.length && nodes.length) roots = [nodes[0].id];
  const depth = new Map();
  const queue = roots.map((id) => ({ id, depth: 0 }));
  queue.forEach((item) => depth.set(item.id, 0));
  while (queue.length) {
    const current = queue.shift();
    for (const child of outward.get(current.id) || []) {
      const nextDepth = current.depth + 1;
      if (!depth.has(child) || nextDepth < depth.get(child)) {
        depth.set(child, nextDepth);
        queue.push({ id: child, depth: nextDepth });
      }
    }
  }
  nodes.forEach((node) => { if (!depth.has(node.id)) depth.set(node.id, 0); });
  const maxDepth = Math.max(0, ...depth.values());
  return new Map(nodes.map((node) => {
    const ratio = maxDepth ? (depth.get(node.id) || 0) / maxDepth : 0;
    return [node.id, Math.round(112 - ratio * 100)];
  }));
};

export const buildDisplayGraph = (graphData, options) => {
  const normalizedNodes = (graphData.nodes || []).map((node) => {
    const path = getNodePath(node);
    return {
      ...node,
      path,
      normalizedType: normalizeNodeType(node.type),
      directory: getDirectory(path),
      parentFileId: getParentFileKey(node),
    };
  });
  const nodeMap = new Map(normalizedNodes.map((node) => [node.id, node]));
  const rawEdges = (graphData.edges || []).filter((edge) => edge.source !== edge.target && nodeMap.has(edge.source) && nodeMap.has(edge.target));
  const baseTypes = options.scope === 'local'
    ? DEFAULT_TYPE_GROUPS.all
    : options.activeTypes?.length
    ? options.activeTypes
    : getDefaultVisibleTypes(options.perspective);
  const visibleTypes = new Set(baseTypes);
  const neighborhood = options.scope === 'local' ? getNeighborhoodIds(options.selectedNodeId, rawEdges, options.localDepth) : null;
  const isExpandedFile = (id) => options.expandedFiles?.has(id) || id === options.selectedNodeId;
  const collapsedFolderIds = new Set();
  const visibleRawNodes = normalizedNodes.filter((node) => {
    if (neighborhood && !neighborhood.has(node.id)) return false;
    const isExpandedDetail = (node.normalizedType === 'function' || node.normalizedType === 'db_field') && options.scope !== 'local' && isExpandedFile(node.parentFileId);
    if (!visibleTypes.has(node.normalizedType) && !isExpandedDetail) return false;
    if ((node.normalizedType === 'function' || node.normalizedType === 'db_field') && options.scope !== 'local' && !isExpandedFile(node.parentFileId)) return false;
    return true;
  });
  const rawVisibleIds = new Set(visibleRawNodes.map((node) => node.id));
  const mapNodeId = (node) => {
    if (options.scope === 'local') return node.id;
    if (options.perspective !== 'structure') return node.id;
    if (node.normalizedType !== 'file' || !node.directory || options.expandedFolders?.has(node.directory)) return node.id;
    collapsedFolderIds.add(node.directory);
    return `folder:${node.directory}`;
  };
  const displayNodes = new Map();
  visibleRawNodes.forEach((node) => {
    const mappedId = mapNodeId(node);
    if (mappedId.startsWith('folder:')) {
      if (!displayNodes.has(mappedId)) {
        displayNodes.set(mappedId, { id: mappedId, label: node.directory.split('/').pop(), path: node.directory, type: 'folder', isSynthetic: true, memberCount: 0 });
      }
      displayNodes.get(mappedId).memberCount += 1;
      return;
    }
    displayNodes.set(mappedId, { id: mappedId, label: node.name || node.label || node.id, path: node.path, type: node.normalizedType, lang: node.language || node.lang, parentFileId: node.parentFileId, isSynthetic: false });
  });
  const edgeMap = new Map();
  rawEdges.forEach((edge) => {
    if (!rawVisibleIds.has(edge.source) || !rawVisibleIds.has(edge.target)) return;
    const sourceId = mapNodeId(nodeMap.get(edge.source));
    const targetId = mapNodeId(nodeMap.get(edge.target));
    if (!sourceId || !targetId || sourceId === targetId) return;
    const key = `${sourceId}->${targetId}:${edge.type || 'RELATED'}`;
    const current = edgeMap.get(key) || { id: key, source: sourceId, target: targetId, edgeType: edge.type || 'RELATED', count: 0 };
    current.count += 1;
    edgeMap.set(key, current);
  });
  const displayEdges = [...edgeMap.values()];
  if (options.hideLeafNodes && options.scope !== 'local') {
    const degree = new Map([...displayNodes.keys()].map((id) => [id, 0]));
    displayEdges.forEach((edge) => {
      degree.set(edge.source, (degree.get(edge.source) || 0) + 1);
      degree.set(edge.target, (degree.get(edge.target) || 0) + 1);
    });
    [...displayNodes.values()].forEach((node) => {
      if (node.isSynthetic || node.id === options.selectedNodeId) return;
      if ((node.type === 'function' || node.type === 'db_field') && (degree.get(node.id) || 0) <= 1) displayNodes.delete(node.id);
    });
  }
  const finalNodes = [...displayNodes.values()];
  const finalNodeIds = new Set(finalNodes.map((node) => node.id));
  const finalEdges = displayEdges.filter((edge) => finalNodeIds.has(edge.source) && finalNodeIds.has(edge.target));
  const sizes = computeNodeSizesByDepth(finalNodes, finalEdges);
  return {
    nodes: finalNodes.map((node) => ({ ...node, nodeSize: node.type === 'folder' ? Math.max(54, Math.min(100, 42 + (node.memberCount || 1) * 4)) : sizes.get(node.id) || 44 })),
    links: finalEdges,
    collapsedFolders: collapsedFolderIds,
  };
};