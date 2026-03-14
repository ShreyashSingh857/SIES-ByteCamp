// Centralized re-exports for store actions and store instance
import {toggleTheme, setTheme} from "./slices/themeSlice.js";
import {
  setSelectedNode,
  clearSelection,
  setScanStatus,
  setScanProgress,
  addRepo,
  removeRepo,
  updateRepoStatus,
  setFilterLangs,
  setFilterTypes,
  setGraphData,
  applyGraphPatch,
  setCurrentRepoInfo,
} from "./slices/graphSlice.js";

export {
  toggleTheme,
  setTheme,
  setSelectedNode,
  clearSelection,
  setScanStatus,
  setScanProgress,
  addRepo,
  removeRepo,
  updateRepoStatus,
  setFilterLangs,
  setFilterTypes,
  setGraphData,
  applyGraphPatch,
  setCurrentRepoInfo,
};
export { default as store } from "./store.js";
