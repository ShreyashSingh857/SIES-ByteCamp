const CLUSTER_RULES = [
  { key: 'Tests', test: (p) => /test|spec|__tests__|\.test\.|\.spec\./i.test(p) },
  { key: 'Frontend', test: (p) => /^frontend\//i.test(p) || /\/(components|pages|views|ui)\//i.test(p) },
  { key: 'Backend', test: (p) => /\/(controllers|routes|middlewares|services)\//i.test(p) || /^backend\//i.test(p) },
  { key: 'Database', test: (p) => /\/(db|database|migrations|models|queries|schema)\//i.test(p) || /queries\./i.test(p) },
  { key: 'AI Engine', test: (p) => /^ai[\-_]engine\//i.test(p) || /\/(pipeline|llm|agent)\//i.test(p) },
  { key: 'Workers', test: (p) => /\/(workers|queues|jobs)\//i.test(p) },
  { key: 'Utilities', test: (p) => /\/(config|utils|helpers|lib|store|slices)\//i.test(p) },
];

const IMPORT_EXTENSIONS = ['', '.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs', '.py'];

export function assignCluster(filePath) {
  const normalizedPath = (filePath || '').replace(/\\/g, '/');
  const lowerPath = normalizedPath.toLowerCase();

  for (const rule of CLUSTER_RULES) {
    if (rule.test(lowerPath)) return rule.key;
  }

  const topLevel = normalizedPath.split('/')[0];
  return topLevel || 'Other';
}

function resolveRelativePath(fromFile, relativeImport) {
  const filePath = (fromFile || '').replace(/\\/g, '/');
  const importPath = (relativeImport || '').replace(/\\/g, '/');

  const pathParts = filePath.split('/');
  pathParts.pop();

  importPath.split('/').forEach((part) => {
    if (!part || part === '.') return;
    if (part === '..') {
      pathParts.pop();
      return;
    }
    pathParts.push(part);
  });

  return pathParts.join('/');
}

function resolveTargetFileId(fileNodeMap, resolvedPath) {
  for (const ext of IMPORT_EXTENSIONS) {
    const candidate = `file:${resolvedPath}${ext}`;
    if (fileNodeMap.has(candidate)) return candidate;
  }

  for (const ext of IMPORT_EXTENSIONS) {
    const indexCandidate = `file:${resolvedPath}/index${ext}`;
    if (fileNodeMap.has(indexCandidate)) return indexCandidate;
  }

  return null;
}

export function buildFileGraph(rawData) {
  const { nodes = [], edges = [] } = rawData || {};

  const fileNodeMap = new Map();
  nodes.forEach((node) => {
    if (node.type !== 'FILE' && node.type !== 'file') return;
    const id = node.id;
    const filePath = id.replace(/^file:/, '').replace(/\\/g, '/');
    fileNodeMap.set(id, {
      id,
      type: 'file',
      label: filePath.split('/').pop() || filePath,
      path: filePath,
      lang: node.language || node.lang || '',
      cluster: assignCluster(filePath),
      isSynthetic: false,
    });
  });

  const fileFunctions = new Map();
  nodes.forEach((node) => {
    if (node.type !== 'FUNCTION' && node.type !== 'function') return;
    const rawFile = (node.file || '').replace(/\\/g, '/');
    if (!rawFile) return;
    const fileId = rawFile.startsWith('file:') ? rawFile : `file:${rawFile}`;
    if (!fileNodeMap.has(fileId)) return;

    if (!fileFunctions.has(fileId)) fileFunctions.set(fileId, []);
    fileFunctions.get(fileId).push({
      id: node.id,
      label: node.name || node.label || node.id,
      type: 'function',
      line: node.line,
      parentFileId: fileId,
    });
  });

  const importEdgeMap = new Map();
  edges.forEach((edge) => {
    const edgeType = edge.type || edge.edgeType || 'IMPORTS';
    if (edgeType !== 'IMPORTS') return;

    const from = edge.from || edge.source;
    const to = edge.to || edge.target;
    if (!from || !to || !fileNodeMap.has(from)) return;
    if (!to.startsWith('module:.')) return;

    const fromPath = from.replace(/^file:/, '').replace(/\\/g, '/');
    const importPath = to.replace(/^module:/, '').replace(/\\/g, '/');
    const resolvedPath = resolveRelativePath(fromPath, importPath);
    const targetId = resolveTargetFileId(fileNodeMap, resolvedPath);
    if (!targetId || targetId === from) return;

    const dedupKey = `${from}→${targetId}`;
    if (!importEdgeMap.has(dedupKey)) {
      importEdgeMap.set(dedupKey, {
        id: dedupKey,
        source: from,
        target: targetId,
        edgeType: 'IMPORTS',
        count: 0,
      });
    }
    importEdgeMap.get(dedupKey).count += 1;
  });

  const callEdges = [];
  edges.forEach((edge) => {
    const edgeType = edge.type || edge.edgeType || '';
    if (edgeType !== 'CALLS') return;

    const source = edge.from || edge.source;
    const target = edge.to || edge.target;
    if (!source || !target || source === target) return;
    callEdges.push({
      id: `call-${source}→${target}`,
      source,
      target,
      edgeType: 'CALLS',
      count: 1,
    });
  });

  const clusters = new Map();
  fileNodeMap.forEach((node) => {
    if (!clusters.has(node.cluster)) {
      clusters.set(node.cluster, {
        id: `cluster:${node.cluster}`,
        label: node.cluster,
        memberCount: 0,
      });
    }
    clusters.get(node.cluster).memberCount += 1;
  });

  return {
    fileNodes: [...fileNodeMap.values()],
    fileEdges: [...importEdgeMap.values()],
    clusters: [...clusters.values()],
    fileFunctions,
    callEdges,
  };
}

export function computeFileSizes(fileNodes, fileEdges) {
  const degreeMap = new Map((fileNodes || []).map((node) => [node.id, 0]));

  (fileEdges || []).forEach((edge) => {
    degreeMap.set(edge.source, (degreeMap.get(edge.source) || 0) + 1);
    degreeMap.set(edge.target, (degreeMap.get(edge.target) || 0) + 1);
  });

  const maxDegree = Math.max(1, ...degreeMap.values());
  return new Map((fileNodes || []).map((node) => {
    const degreeRatio = (degreeMap.get(node.id) || 0) / maxDegree;
    return [node.id, Math.round(28 + degreeRatio * 42)];
  }));
}