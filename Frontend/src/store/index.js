// for easier imports
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
  setCurrentRepoInfo,
};
export { default as store } from "./store.js";