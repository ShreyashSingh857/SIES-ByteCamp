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
      const { id, status } = action.payload;
      const repo = state.repos.find((r) => r.id === id);
      if (repo) repo.status = status;
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
} = graphSlice.actions;

export default graphSlice.reducer;
