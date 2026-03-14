// ============================================
// CUSTOM HOOKS FOR UI SLICE
// Makes it even easier to use in components!
// ============================================

import { useSelector, useDispatch } from 'react-redux';
import { useCallback, useEffect } from 'react';
import * as uiActions from './uiSlice';

// ==========================================
// MODAL HOOKS
// ==========================================

export const useModal = (modalName) => {
  const dispatch = useDispatch();
  const modal = useSelector(state => state.ui.modals[modalName]);

  const open = useCallback((data = null) => {
    dispatch(uiActions.openModal({ name: modalName, data }));
  }, [dispatch, modalName]);

  const close = useCallback(() => {
    dispatch(uiActions.closeModal(modalName));
  }, [dispatch, modalName]);

  const updateData = useCallback((data) => {
    dispatch(uiActions.updateModalData({ name: modalName, data }));
  }, [dispatch, modalName]);

  return {
    isOpen: modal?.isOpen || false,
    data: modal?.data || null,
    open,
    close,
    updateData,
  };
};

// Usage:
// const createModal = useModal('createUser');
// createModal.open({ name: 'John' });
// createModal.close();

// ==========================================
// NOTIFICATION HOOKS
// ==========================================

export const useNotification = () => {
  const dispatch = useDispatch();

  const showSuccess = useCallback((message, duration = 3000) => {
    dispatch(uiActions.addNotification({
      type: 'success',
      message,
      duration,
    }));
  }, [dispatch]);

  const showError = useCallback((message, duration = 5000) => {
    dispatch(uiActions.addNotification({
      type: 'error',
      message,
      duration,
    }));
  }, [dispatch]);

  const showWarning = useCallback((message, duration = 4000) => {
    dispatch(uiActions.addNotification({
      type: 'warning',
      message,
      duration,
    }));
  }, [dispatch]);

  const showInfo = useCallback((message, duration = 3000) => {
    dispatch(uiActions.addNotification({
      type: 'info',
      message,
      duration,
    }));
  }, [dispatch]);

  return { showSuccess, showError, showWarning, showInfo };
};

// Usage:
// const notify = useNotification();
// notify.showSuccess('Item created!');
// notify.showError('Failed to save');

// ==========================================
// FILTERS HOOKS
// ==========================================

export const useFilters = () => {
  const dispatch = useDispatch();
  const filters = useSelector(state => state.ui.filters);

  const setSearch = useCallback((search) => {
    dispatch(uiActions.setSearch(search));
  }, [dispatch]);

  const setCategory = useCallback((category) => {
    dispatch(uiActions.setCategory(category));
  }, [dispatch]);

  const setStatus = useCallback((status) => {
    dispatch(uiActions.setStatus(status));
  }, [dispatch]);

  const setSortBy = useCallback((sortBy) => {
    dispatch(uiActions.setSortBy(sortBy));
  }, [dispatch]);

  const toggleSort = useCallback(() => {
    dispatch(uiActions.toggleSortOrder());
  }, [dispatch]);

  const addTag = useCallback((tag) => {
    dispatch(uiActions.addTag(tag));
  }, [dispatch]);

  const removeTag = useCallback((tag) => {
    dispatch(uiActions.removeTag(tag));
  }, [dispatch]);

  const reset = useCallback(() => {
    dispatch(uiActions.resetFilters());
  }, [dispatch]);

  const setMultiple = useCallback((updates) => {
    dispatch(uiActions.setFilter(updates));
  }, [dispatch]);

  return {
    filters,
    setSearch,
    setCategory,
    setStatus,
    setSortBy,
    toggleSort,
    addTag,
    removeTag,
    reset,
    setMultiple,
  };
};

// Usage:
// const { filters, setSearch, reset } = useFilters();
// setSearch('query');
// reset();

// ==========================================
// PAGINATION HOOKS
// ==========================================

export const usePagination = (totalItems) => {
  const dispatch = useDispatch();
  const pagination = useSelector(state => state.ui.pagination);

  useEffect(() => {
    if (totalItems !== undefined) {
      dispatch(uiActions.setTotalItems(totalItems));
    }
  }, [totalItems, dispatch]);

  const setPage = useCallback((page) => {
    dispatch(uiActions.setPage(page));
  }, [dispatch]);

  const setPageSize = useCallback((size) => {
    dispatch(uiActions.setPageSize(size));
  }, [dispatch]);

  const nextPage = useCallback(() => {
    dispatch(uiActions.nextPage());
  }, [dispatch]);

  const previousPage = useCallback(() => {
    dispatch(uiActions.previousPage());
  }, [dispatch]);

  const totalPages = Math.ceil(pagination.totalItems / pagination.pageSize);
  const hasNext = pagination.currentPage < totalPages;
  const hasPrevious = pagination.currentPage > 1;

  return {
    currentPage: pagination.currentPage,
    pageSize: pagination.pageSize,
    totalItems: pagination.totalItems,
    totalPages,
    hasNext,
    hasPrevious,
    setPage,
    setPageSize,
    nextPage,
    previousPage,
  };
};

// Usage:
// const { currentPage, nextPage, hasNext } = usePagination(100);
// if (hasNext) nextPage();

// ==========================================
// VIEW MODE HOOKS
// ==========================================

export const useViewMode = () => {
  const dispatch = useDispatch();
  const viewMode = useSelector(state => state.ui.viewMode);

  const setMode = useCallback((mode) => {
    dispatch(uiActions.setViewMode(mode));
  }, [dispatch]);

  const toggle = useCallback(() => {
    dispatch(uiActions.toggleViewMode());
  }, [dispatch]);

  return {
    viewMode,
    setMode,
    toggle,
    isGrid: viewMode === 'grid',
    isList: viewMode === 'list',
    isKanban: viewMode === 'kanban',
    isTable: viewMode === 'table',
  };
};

// Usage:
// const { viewMode, setMode, isGrid } = useViewMode();
// if (isGrid) { /* render grid */ }

// ==========================================
// THEME HOOKS
// ==========================================

export const useTheme = () => {
  const dispatch = useDispatch();
  const theme = useSelector(state => state.ui.theme);

  const toggleMode = useCallback(() => {
    dispatch(uiActions.toggleTheme());
  }, [dispatch]);

  const setMode = useCallback((mode) => {
    dispatch(uiActions.setThemeMode(mode));
  }, [dispatch]);

  const setPrimaryColor = useCallback((color) => {
    dispatch(uiActions.setPrimaryColor(color));
  }, [dispatch]);

  const setFontSize = useCallback((size) => {
    dispatch(uiActions.setFontSize(size));
  }, [dispatch]);

  // Apply theme to DOM
  useEffect(() => {
    document.body.setAttribute('data-theme', theme.mode);
    document.documentElement.style.setProperty('--primary-color', theme.primaryColor);
    document.documentElement.style.setProperty('--font-size', theme.fontSize);
  }, [theme]);

  return {
    theme,
    toggleMode,
    setMode,
    setPrimaryColor,
    setFontSize,
    isDark: theme.mode === 'dark',
    isLight: theme.mode === 'light',
  };
};

// Usage:
// const { isDark, toggleMode } = useTheme();
// <button onClick={toggleMode}>{isDark ? 'Light' : 'Dark'}</button>

// ==========================================
// SELECTION HOOKS
// ==========================================

export const useSelection = () => {
  const dispatch = useDispatch();
  const selection = useSelector(state => state.ui.selection);

  const toggle = useCallback((id) => {
    dispatch(uiActions.toggleSelection(id));
  }, [dispatch]);

  const selectAll = useCallback((ids) => {
    dispatch(uiActions.selectAll(ids));
  }, [dispatch]);

  const deselectAll = useCallback(() => {
    dispatch(uiActions.deselectAll());
  }, [dispatch]);

  const isSelected = useCallback((id) => {
    return selection.selectedIds.includes(id);
  }, [selection.selectedIds]);

  return {
    selectedIds: selection.selectedIds,
    isSelectAll: selection.isSelectAll,
    count: selection.selectedIds.length,
    toggle,
    selectAll,
    deselectAll,
    isSelected,
    hasSelection: selection.selectedIds.length > 0,
  };
};

// Usage:
// const { selectedIds, toggle, hasSelection } = useSelection();
// <input checked={isSelected(id)} onChange={() => toggle(id)} />

// ==========================================
// DRAWER HOOKS
// ==========================================

export const useDrawer = (side = 'right') => {
  const dispatch = useDispatch();
  const drawer = useSelector(state => state.ui.drawers[side]);

  const open = useCallback((content = null) => {
    dispatch(uiActions.openDrawer({ side, content }));
  }, [dispatch, side]);

  const close = useCallback(() => {
    dispatch(uiActions.closeDrawer(side));
  }, [dispatch, side]);

  const toggle = useCallback(() => {
    dispatch(uiActions.toggleDrawer(side));
  }, [dispatch, side]);

  return {
    isOpen: drawer?.isOpen || false,
    content: drawer?.content || null,
    open,
    close,
    toggle,
  };
};

// Usage:
// const drawer = useDrawer('right');
// drawer.open('filters');
// drawer.close();

// ==========================================
// SIDEBAR HOOKS
// ==========================================

export const useSidebar = () => {
  const dispatch = useDispatch();
  const sidebar = useSelector(state => state.ui.sidebar);

  const toggle = useCallback(() => {
    dispatch(uiActions.toggleSidebar());
  }, [dispatch]);

  const setOpen = useCallback((isOpen) => {
    dispatch(uiActions.setSidebarOpen(isOpen));
  }, [dispatch]);

  const toggleCollapse = useCallback(() => {
    dispatch(uiActions.toggleSidebarCollapse());
  }, [dispatch]);

  const setActiveSection = useCallback((section) => {
    dispatch(uiActions.setActiveSection(section));
  }, [dispatch]);

  return {
    isOpen: sidebar.isOpen,
    isCollapsed: sidebar.isCollapsed,
    activeSection: sidebar.activeSection,
    toggle,
    setOpen,
    toggleCollapse,
    setActiveSection,
  };
};

// Usage:
// const { isOpen, toggle, activeSection } = useSidebar();

// ==========================================
// LOADING HOOKS
// ==========================================

export const useLoading = (key = 'global') => {
  const dispatch = useDispatch();
  const isLoading = useSelector(state => state.ui.loading[key]);

  const setLoading = useCallback((value) => {
    dispatch(uiActions.setLoading({ key, value }));
  }, [dispatch, key]);

  const startLoading = useCallback(() => {
    setLoading(true);
  }, [setLoading]);

  const stopLoading = useCallback(() => {
    setLoading(false);
  }, [setLoading]);

  return {
    isLoading: isLoading || false,
    setLoading,
    startLoading,
    stopLoading,
  };
};

// Usage:
// const { isLoading, startLoading, stopLoading } = useLoading('uploadingFile');

// ==========================================
// ONBOARDING HOOKS
// ==========================================

export const useOnboarding = () => {
  const dispatch = useDispatch();
  const onboarding = useSelector(state => state.ui.onboarding);

  const start = useCallback(() => {
    dispatch(uiActions.startOnboarding());
  }, [dispatch]);

  const next = useCallback(() => {
    dispatch(uiActions.nextOnboardingStep());
  }, [dispatch]);

  const previous = useCallback(() => {
    dispatch(uiActions.previousOnboardingStep());
  }, [dispatch]);

  const skip = useCallback(() => {
    dispatch(uiActions.skipOnboarding());
  }, [dispatch]);

  const complete = useCallback(() => {
    dispatch(uiActions.completeOnboarding());
  }, [dispatch]);

  return {
    isActive: onboarding.isActive,
    currentStep: onboarding.currentStep,
    completedSteps: onboarding.completedSteps,
    skipped: onboarding.skipped,
    start,
    next,
    previous,
    skip,
    complete,
  };
};

// Usage:
// const { isActive, currentStep, next, skip } = useOnboarding();

// ==========================================
// COMPARISON HOOKS
// ==========================================

export const useComparison = () => {
  const dispatch = useDispatch();
  const comparison = useSelector(state => state.ui.comparison);

  const toggle = useCallback(() => {
    dispatch(uiActions.toggleComparison());
  }, [dispatch]);

  const add = useCallback((item) => {
    dispatch(uiActions.addToComparison(item));
  }, [dispatch]);

  const remove = useCallback((id) => {
    dispatch(uiActions.removeFromComparison(id));
  }, [dispatch]);

  const clear = useCallback(() => {
    dispatch(uiActions.clearComparison());
  }, [dispatch]);

  const isInComparison = useCallback((id) => {
    return comparison.items.some(item => item.id === id);
  }, [comparison.items]);

  return {
    isActive: comparison.isActive,
    items: comparison.items,
    count: comparison.items.length,
    toggle,
    add,
    remove,
    clear,
    isInComparison,
  };
};

// Usage:
// const { items, add, isInComparison } = useComparison();
// if (!isInComparison(id)) add(product);

// ==========================================
// QUICK ACTIONS HOOKS
// ==========================================

export const useQuickActions = () => {
  const dispatch = useDispatch();
  const quickActions = useSelector(state => state.ui.quickActions);

  const toggle = useCallback(() => {
    dispatch(uiActions.toggleQuickActions());
  }, [dispatch]);

  const addRecentSearch = useCallback((search) => {
    dispatch(uiActions.addRecentSearch(search));
  }, [dispatch]);

  const clearRecentSearches = useCallback(() => {
    dispatch(uiActions.clearRecentSearches());
  }, [dispatch]);

  return {
    isOpen: quickActions.isOpen,
    recentSearches: quickActions.recentSearches,
    toggle,
    addRecentSearch,
    clearRecentSearches,
  };
};

// ==========================================
// COMBINED HOOK FOR COMMON USE CASES
// ==========================================

export const useUI = () => {
  const notify = useNotification();
  const filters = useFilters();
  const pagination = usePagination();
  const viewMode = useViewMode();
  const theme = useTheme();
  const selection = useSelection();

  return {
    notify,
    filters,
    pagination,
    viewMode,
    theme,
    selection,
  };
};

// Usage:
// const { notify, filters, viewMode } = useUI();
// notify.showSuccess('Saved!');
// filters.setSearch('query');
// viewMode.setMode('grid');