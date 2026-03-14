import { createSlice } from '@reduxjs/toolkit';

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
      const { id } = action.payload || {};
      const nodeId = id !== undefined ? id : action.payload;
      state.selectedNode = nodeId;
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
