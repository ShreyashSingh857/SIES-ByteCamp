import { createSlice } from '@reduxjs/toolkit';

// BFS to compute directly and transitively impacted nodes from a selected node
function computeImpact(graphData, selectedNodeId) {
  if (!selectedNodeId) return { directImpact: [], transitiveImpact: [] };

  const { edges } = graphData;
  const directImpact = new Set();

  edges.forEach((edge) => {
    if (edge.source === selectedNodeId) directImpact.add(edge.target);
    if (edge.target === selectedNodeId) directImpact.add(edge.source);
  });

  const visited = new Set([selectedNodeId, ...directImpact]);
  const queue = [...directImpact];
  const transitiveImpact = new Set();

  while (queue.length > 0) {
    const current = queue.shift();
    edges.forEach((edge) => {
      const neighbor =
        edge.source === current
          ? edge.target
          : edge.target === current
          ? edge.source
          : null;

      if (neighbor && !visited.has(neighbor)) {
        visited.add(neighbor);
        transitiveImpact.add(neighbor);
        queue.push(neighbor);
      }
    });
  }

  return {
    directImpact: [...directImpact],
    transitiveImpact: [...transitiveImpact],
  };
}

const graphSlice = createSlice({
  name: 'graph',
  initialState: {
    repos: [],
    scanStatus: 'idle', // 'idle' | 'scanning' | 'done' | 'error'
    scanProgress: 0,
    graphData: { nodes: [], edges: [] },
    selectedNode: null,
    directImpact: [],
    transitiveImpact: [],
    filterLangs: [],
    filterTypes: [],
    // Phase 2: track active scan context
    currentRepoId: localStorage.getItem('currentRepoId') || null,
    currentScanId: localStorage.getItem('currentScanId') || null,
  },
  reducers: {
    setSelectedNode(state, action) {
      const { id, graphData } = action.payload || {};
      const nodeId = id !== undefined ? id : action.payload;
      const dataToUse = graphData || state.graphData;

      
      state.selectedNode = nodeId;
      const impact = computeImpact(dataToUse, nodeId);
      state.directImpact = impact.directImpact;
      state.transitiveImpact = impact.transitiveImpact;
    },
    clearSelection(state) {
      state.selectedNode = null;
      state.directImpact = [];
      state.transitiveImpact = [];
    },
    setScanStatus(state, action) {
      state.scanStatus = action.payload;
    },
    setScanProgress(state, action) {
      state.scanProgress = action.payload;
    },
    addRepo(state, action) {
      state.repos.unshift(action.payload);
    },
    updateRepoStatus(state, action) {
      const { id, status, nodes, edges } = action.payload;
      const repo = state.repos.find((r) => r.id === id);
      if (repo) {
        repo.status = status;
        if (nodes !== undefined) repo.nodes = nodes;
        if (edges !== undefined) repo.edges = edges;
      }
    },
    removeRepo(state, action) {
      state.repos = state.repos.filter((r) => r.id !== action.payload);
    },
    setFilterLangs(state, action) {
      state.filterLangs = action.payload;
    },
    setFilterTypes(state, action) {
      state.filterTypes = action.payload;
    },
    // Set the active repoId + scanId after a successful scan+seed cycle
    setCurrentRepoInfo(state, action) {
      const { repoId, scanId } = action.payload;
      state.currentRepoId = repoId;
      state.currentScanId = scanId;
      if (repoId) localStorage.setItem('currentRepoId', repoId);
      else localStorage.removeItem('currentRepoId');
      if (scanId) localStorage.setItem('currentScanId', scanId);
      else localStorage.removeItem('currentScanId');
    },
  },
});

export const {
  setSelectedNode,
  clearSelection,
  setScanStatus,
  setScanProgress,
  addRepo,
  removeRepo,
  updateRepoStatus,
  setFilterLangs,
  setFilterTypes,
  setCurrentRepoInfo,
} = graphSlice.actions;

export default graphSlice.reducer;
