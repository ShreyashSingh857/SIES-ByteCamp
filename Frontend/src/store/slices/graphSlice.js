import { createSlice } from '@reduxjs/toolkit';
import { mockGraphData, mockRepos } from '../../assets/mockdata';

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
    repos: mockRepos,
    scanStatus: 'idle', // 'idle' | 'scanning' | 'done' | 'error'
    scanProgress: 0,
    graphData: mockGraphData,
    selectedNode: null,
    directImpact: [],
    transitiveImpact: [],
    filterLangs: [],
    filterTypes: [],
  },
  reducers: {
    setSelectedNode(state, action) {
      state.selectedNode = action.payload;
      const impact = computeImpact(state.graphData, action.payload);
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