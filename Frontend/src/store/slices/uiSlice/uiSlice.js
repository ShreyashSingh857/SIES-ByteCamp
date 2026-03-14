// ============================================
// UI SLICE - COMPREHENSIVE TEMPLATE
// ============================================

import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  // ==========================================
  // MODAL MANAGEMENT
  // ==========================================
  modals: {
    createUser: { isOpen: false, data: null },
    editUser: { isOpen: false, data: null },
    deleteConfirm: { isOpen: false, data: null },
    imagePreview: { isOpen: false, data: null },
    settings: { isOpen: false },
    profile: { isOpen: false },
  },

  // ==========================================
  // SIDEBAR & NAVIGATION
  // ==========================================
  sidebar: {
    isOpen: true,
    isCollapsed: false,
    activeSection: 'dashboard',
  },

  // ==========================================
  // FILTERS & SEARCH
  // ==========================================
  filters: {
    search: '',
    category: 'all',
    status: 'all',
    dateRange: { start: null, end: null },
    sortBy: 'createdAt',
    sortOrder: 'desc',
    tags: [],
    price: { min: 0, max: 1000 },
  },

  // ==========================================
  // PAGINATION
  // ==========================================
  pagination: {
    currentPage: 1,
    pageSize: 10,
    totalItems: 0,
  },

  // ==========================================
  // VIEW MODES
  // ==========================================
  viewMode: 'grid', // 'grid' | 'list' | 'kanban' | 'table'

  // ==========================================
  // TABS & ACTIVE SELECTIONS
  // ==========================================
  activeTabs: {
    main: 'overview',
    settings: 'general',
    profile: 'personal',
  },

  // ==========================================
  // LOADING & PROCESSING STATES
  // ==========================================
  loading: {
    global: false,
    uploadingFile: false,
    processing: false,
  },

  // ==========================================
  // NOTIFICATIONS & TOASTS
  // ==========================================
  notifications: [],
  // Format: { id, type: 'success'|'error'|'warning'|'info', message, duration }

  // ==========================================
  // THEME & PREFERENCES
  // ==========================================
  theme: {
    mode: 'light', // 'light' | 'dark'
    primaryColor: '#3b82f6',
    fontSize: 'medium', // 'small' | 'medium' | 'large'
  },

  // ==========================================
  // LAYOUT PREFERENCES
  // ==========================================
  layout: {
    compactMode: false,
    showToolbar: true,
    showFooter: true,
  },

  // ==========================================
  // FORM STATES
  // ==========================================
  forms: {
    isDirty: false,
    hasUnsavedChanges: false,
    activeForm: null,
  },

  // ==========================================
  // SELECTION & BULK ACTIONS
  // ==========================================
  selection: {
    selectedIds: [],
    isSelectAll: false,
    bulkAction: null,
  },

  // ==========================================
  // DRAWER/PANEL STATES
  // ==========================================
  drawers: {
    right: { isOpen: false, content: null },
    left: { isOpen: false, content: null },
  },

  // ==========================================
  // QUICK ACTIONS
  // ==========================================
  quickActions: {
    isOpen: false,
    recentSearches: [],
  },

  // ==========================================
  // TOUR/ONBOARDING
  // ==========================================
  onboarding: {
    isActive: false,
    currentStep: 0,
    completedSteps: [],
    skipped: false,
  },

  // ==========================================
  // COMPARISON MODE (for products, etc.)
  // ==========================================
  comparison: {
    isActive: false,
    items: [],
  },

  // ==========================================
  // DRAG & DROP
  // ==========================================
  dragDrop: {
    isDragging: false,
    draggedItem: null,
    dropZone: null,
  },
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    // ==========================================
    // MODAL ACTIONS
    // ==========================================
    openModal: (state, action) => {
      const { name, data } = action.payload;
      state.modals[name] = { isOpen: true, data };
    },
    
    closeModal: (state, action) => {
      const name = action.payload;
      state.modals[name] = { isOpen: false, data: null };
    },
    
    closeAllModals: (state) => {
      Object.keys(state.modals).forEach(key => {
        state.modals[key] = { isOpen: false, data: null };
      });
    },

    updateModalData: (state, action) => {
      const { name, data } = action.payload;
      if (state.modals[name]) {
        state.modals[name].data = data;
      }
    },

    // ==========================================
    // SIDEBAR ACTIONS
    // ==========================================
    toggleSidebar: (state) => {
      state.sidebar.isOpen = !state.sidebar.isOpen;
    },
    
    setSidebarOpen: (state, action) => {
      state.sidebar.isOpen = action.payload;
    },
    
    toggleSidebarCollapse: (state) => {
      state.sidebar.isCollapsed = !state.sidebar.isCollapsed;
    },
    
    setActiveSection: (state, action) => {
      state.sidebar.activeSection = action.payload;
    },

    // ==========================================
    // FILTER ACTIONS
    // ==========================================
    setFilter: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    
    setSearch: (state, action) => {
      state.filters.search = action.payload;
    },
    
    setCategory: (state, action) => {
      state.filters.category = action.payload;
    },
    
    setStatus: (state, action) => {
      state.filters.status = action.payload;
    },
    
    setDateRange: (state, action) => {
      state.filters.dateRange = action.payload;
    },
    
    setSortBy: (state, action) => {
      state.filters.sortBy = action.payload;
    },
    
    toggleSortOrder: (state) => {
      state.filters.sortOrder = state.filters.sortOrder === 'asc' ? 'desc' : 'asc';
    },
    
    addTag: (state, action) => {
      if (!state.filters.tags.includes(action.payload)) {
        state.filters.tags.push(action.payload);
      }
    },
    
    removeTag: (state, action) => {
      state.filters.tags = state.filters.tags.filter(tag => tag !== action.payload);
    },
    
    clearTags: (state) => {
      state.filters.tags = [];
    },
    
    setPriceRange: (state, action) => {
      state.filters.price = action.payload;
    },
    
    resetFilters: (state) => {
      state.filters = initialState.filters;
    },

    // ==========================================
    // PAGINATION ACTIONS
    // ==========================================
    setPage: (state, action) => {
      state.pagination.currentPage = action.payload;
    },
    
    setPageSize: (state, action) => {
      state.pagination.pageSize = action.payload;
      state.pagination.currentPage = 1; // Reset to first page
    },
    
    setTotalItems: (state, action) => {
      state.pagination.totalItems = action.payload;
    },
    
    nextPage: (state) => {
      const totalPages = Math.ceil(state.pagination.totalItems / state.pagination.pageSize);
      if (state.pagination.currentPage < totalPages) {
        state.pagination.currentPage += 1;
      }
    },
    
    previousPage: (state) => {
      if (state.pagination.currentPage > 1) {
        state.pagination.currentPage -= 1;
      }
    },

    // ==========================================
    // VIEW MODE ACTIONS
    // ==========================================
    setViewMode: (state, action) => {
      state.viewMode = action.payload;
    },
    
    toggleViewMode: (state) => {
      const modes = ['grid', 'list', 'kanban', 'table'];
      const currentIndex = modes.indexOf(state.viewMode);
      const nextIndex = (currentIndex + 1) % modes.length;
      state.viewMode = modes[nextIndex];
    },

    // ==========================================
    // TAB ACTIONS
    // ==========================================
    setActiveTab: (state, action) => {
      const { section, tab } = action.payload;
      state.activeTabs[section] = tab;
    },

    // ==========================================
    // LOADING ACTIONS
    // ==========================================
    setLoading: (state, action) => {
      const { key, value } = action.payload;
      state.loading[key] = value;
    },
    
    setGlobalLoading: (state, action) => {
      state.loading.global = action.payload;
    },

    // ==========================================
    // NOTIFICATION ACTIONS
    // ==========================================
    addNotification: (state, action) => {
      const notification = {
        id: Date.now() + Math.random(),
        type: 'info',
        duration: 3000,
        ...action.payload,
      };
      state.notifications.push(notification);
    },
    
    removeNotification: (state, action) => {
      state.notifications = state.notifications.filter(
        notif => notif.id !== action.payload
      );
    },
    
    clearNotifications: (state) => {
      state.notifications = [];
    },

    // ==========================================
    // THEME ACTIONS
    // ==========================================
    setThemeMode: (state, action) => {
      state.theme.mode = action.payload;
    },
    
    toggleTheme: (state) => {
      state.theme.mode = state.theme.mode === 'light' ? 'dark' : 'light';
    },
    
    setPrimaryColor: (state, action) => {
      state.theme.primaryColor = action.payload;
    },
    
    setFontSize: (state, action) => {
      state.theme.fontSize = action.payload;
    },

    // ==========================================
    // LAYOUT ACTIONS
    // ==========================================
    toggleCompactMode: (state) => {
      state.layout.compactMode = !state.layout.compactMode;
    },
    
    toggleToolbar: (state) => {
      state.layout.showToolbar = !state.layout.showToolbar;
    },
    
    toggleFooter: (state) => {
      state.layout.showFooter = !state.layout.showFooter;
    },

    // ==========================================
    // FORM ACTIONS
    // ==========================================
    setFormDirty: (state, action) => {
      state.forms.isDirty = action.payload;
    },
    
    setHasUnsavedChanges: (state, action) => {
      state.forms.hasUnsavedChanges = action.payload;
    },
    
    setActiveForm: (state, action) => {
      state.forms.activeForm = action.payload;
    },

    // ==========================================
    // SELECTION ACTIONS
    // ==========================================
    toggleSelection: (state, action) => {
      const id = action.payload;
      const index = state.selection.selectedIds.indexOf(id);
      
      if (index > -1) {
        state.selection.selectedIds.splice(index, 1);
      } else {
        state.selection.selectedIds.push(id);
      }
    },
    
    selectAll: (state, action) => {
      state.selection.selectedIds = action.payload;
      state.selection.isSelectAll = true;
    },
    
    deselectAll: (state) => {
      state.selection.selectedIds = [];
      state.selection.isSelectAll = false;
    },
    
    setBulkAction: (state, action) => {
      state.selection.bulkAction = action.payload;
    },

    // ==========================================
    // DRAWER ACTIONS
    // ==========================================
    openDrawer: (state, action) => {
      const { side, content } = action.payload;
      state.drawers[side] = { isOpen: true, content };
    },
    
    closeDrawer: (state, action) => {
      const side = action.payload;
      state.drawers[side] = { isOpen: false, content: null };
    },
    
    toggleDrawer: (state, action) => {
      const side = action.payload;
      state.drawers[side].isOpen = !state.drawers[side].isOpen;
    },

    // ==========================================
    // QUICK ACTIONS
    // ==========================================
    toggleQuickActions: (state) => {
      state.quickActions.isOpen = !state.quickActions.isOpen;
    },
    
    addRecentSearch: (state, action) => {
      const search = action.payload;
      // Remove if already exists
      state.quickActions.recentSearches = state.quickActions.recentSearches.filter(
        s => s !== search
      );
      // Add to beginning
      state.quickActions.recentSearches.unshift(search);
      // Keep only last 10
      state.quickActions.recentSearches = state.quickActions.recentSearches.slice(0, 10);
    },
    
    clearRecentSearches: (state) => {
      state.quickActions.recentSearches = [];
    },

    // ==========================================
    // ONBOARDING ACTIONS
    // ==========================================
    startOnboarding: (state) => {
      state.onboarding.isActive = true;
      state.onboarding.currentStep = 0;
      state.onboarding.skipped = false;
    },
    
    nextOnboardingStep: (state) => {
      state.onboarding.currentStep += 1;
      if (!state.onboarding.completedSteps.includes(state.onboarding.currentStep - 1)) {
        state.onboarding.completedSteps.push(state.onboarding.currentStep - 1);
      }
    },
    
    previousOnboardingStep: (state) => {
      if (state.onboarding.currentStep > 0) {
        state.onboarding.currentStep -= 1;
      }
    },
    
    skipOnboarding: (state) => {
      state.onboarding.isActive = false;
      state.onboarding.skipped = true;
    },
    
    completeOnboarding: (state) => {
      state.onboarding.isActive = false;
      state.onboarding.completedSteps.push(state.onboarding.currentStep);
    },

    // ==========================================
    // COMPARISON ACTIONS
    // ==========================================
    toggleComparison: (state) => {
      state.comparison.isActive = !state.comparison.isActive;
      if (!state.comparison.isActive) {
        state.comparison.items = [];
      }
    },
    
    addToComparison: (state, action) => {
      const item = action.payload;
      if (!state.comparison.items.find(i => i.id === item.id)) {
        state.comparison.items.push(item);
      }
    },
    
    removeFromComparison: (state, action) => {
      const id = action.payload;
      state.comparison.items = state.comparison.items.filter(item => item.id !== id);
    },
    
    clearComparison: (state) => {
      state.comparison.items = [];
    },

    // ==========================================
    // DRAG & DROP ACTIONS
    // ==========================================
    startDragging: (state, action) => {
      state.dragDrop.isDragging = true;
      state.dragDrop.draggedItem = action.payload;
    },
    
    endDragging: (state) => {
      state.dragDrop.isDragging = false;
      state.dragDrop.draggedItem = null;
      state.dragDrop.dropZone = null;
    },
    
    setDropZone: (state, action) => {
      state.dragDrop.dropZone = action.payload;
    },

    // ==========================================
    // RESET ALL
    // ==========================================
    resetUI: () => initialState,
  },
});

// Export actions
export const {
  // Modals
  openModal,
  closeModal,
  closeAllModals,
  updateModalData,
  
  // Sidebar
  toggleSidebar,
  setSidebarOpen,
  toggleSidebarCollapse,
  setActiveSection,
  
  // Filters
  setFilter,
  setSearch,
  setCategory,
  setStatus,
  setDateRange,
  setSortBy,
  toggleSortOrder,
  addTag,
  removeTag,
  clearTags,
  setPriceRange,
  resetFilters,
  
  // Pagination
  setPage,
  setPageSize,
  setTotalItems,
  nextPage,
  previousPage,
  
  // View Mode
  setViewMode,
  toggleViewMode,
  
  // Tabs
  setActiveTab,
  
  // Loading
  setLoading,
  setGlobalLoading,
  
  // Notifications
  addNotification,
  removeNotification,
  clearNotifications,
  
  // Theme
  setThemeMode,
  toggleTheme,
  setPrimaryColor,
  setFontSize,
  
  // Layout
  toggleCompactMode,
  toggleToolbar,
  toggleFooter,
  
  // Forms
  setFormDirty,
  setHasUnsavedChanges,
  setActiveForm,
  
  // Selection
  toggleSelection,
  selectAll,
  deselectAll,
  setBulkAction,
  
  // Drawers
  openDrawer,
  closeDrawer,
  toggleDrawer,
  
  // Quick Actions
  toggleQuickActions,
  addRecentSearch,
  clearRecentSearches,
  
  // Onboarding
  startOnboarding,
  nextOnboardingStep,
  previousOnboardingStep,
  skipOnboarding,
  completeOnboarding,
  
  // Comparison
  toggleComparison,
  addToComparison,
  removeFromComparison,
  clearComparison,
  
  // Drag & Drop
  startDragging,
  endDragging,
  setDropZone,
  
  // Reset
  resetUI,
} = uiSlice.actions;

// Selectors (for easy access in components)
export const selectModals = (state) => state.ui.modals;
export const selectModal = (name) => (state) => state.ui.modals[name];
export const selectSidebar = (state) => state.ui.sidebar;
export const selectFilters = (state) => state.ui.filters;
export const selectPagination = (state) => state.ui.pagination;
export const selectViewMode = (state) => state.ui.viewMode;
export const selectActiveTabs = (state) => state.ui.activeTabs;
export const selectLoading = (state) => state.ui.loading;
export const selectNotifications = (state) => state.ui.notifications;
export const selectTheme = (state) => state.ui.theme;
export const selectLayout = (state) => state.ui.layout;
export const selectForms = (state) => state.ui.forms;
export const selectSelection = (state) => state.ui.selection;
export const selectDrawers = (state) => state.ui.drawers;
export const selectQuickActions = (state) => state.ui.quickActions;
export const selectOnboarding = (state) => state.ui.onboarding;
export const selectComparison = (state) => state.ui.comparison;
export const selectDragDrop = (state) => state.ui.dragDrop;

export default uiSlice.reducer;