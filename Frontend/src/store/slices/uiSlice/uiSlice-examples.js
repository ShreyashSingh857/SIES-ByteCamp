// ============================================
// UI SLICE - COMPONENT USAGE EXAMPLES
// Copy these patterns for your projects!
// ============================================

import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  openModal,
  closeModal,
  toggleSidebar,
  setFilter,
  setSearch,
  setPage,
  setViewMode,
  addNotification,
  removeNotification,
  toggleTheme,
  toggleSelection,
  selectAll,
  deselectAll,
  addToComparison,
  startOnboarding,
  nextOnboardingStep,
  openDrawer,
  closeDrawer,
  // ... import other actions as needed
} from './uiSlice';

// ============================================
// EXAMPLE 1: MODAL MANAGEMENT
// ============================================

export const ModalExample = () => {
  const dispatch = useDispatch();
  const createUserModal = useSelector(state => state.ui.modals.createUser);
  const editUserModal = useSelector(state => state.ui.modals.editUser);

  const handleOpenCreate = () => {
    dispatch(openModal({ name: 'createUser' }));
  };

  const handleOpenEdit = (user) => {
    dispatch(openModal({ name: 'editUser', data: user }));
  };

  const handleCloseCreate = () => {
    dispatch(closeModal('createUser'));
  };

  return (
    <div>
      <button onClick={handleOpenCreate}>Create User</button>
      <button onClick={() => handleOpenEdit({ id: 1, name: 'John' })}>
        Edit User
      </button>

      {/* Create User Modal */}
      {createUserModal.isOpen && (
        <div className="modal">
          <div className="modal-content">
            <h2>Create New User</h2>
            <form>
              <input placeholder="Name" />
              <input placeholder="Email" />
              <button type="submit">Create</button>
              <button type="button" onClick={handleCloseCreate}>Cancel</button>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editUserModal.isOpen && (
        <div className="modal">
          <div className="modal-content">
            <h2>Edit User</h2>
            <form>
              <input defaultValue={editUserModal.data?.name} />
              <input defaultValue={editUserModal.data?.email} />
              <button type="submit">Update</button>
              <button type="button" onClick={() => dispatch(closeModal('editUser'))}>
                Cancel
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// EXAMPLE 2: SIDEBAR WITH NAVIGATION
// ============================================

export const SidebarExample = () => {
  const dispatch = useDispatch();
  const sidebar = useSelector(state => state.ui.sidebar);

  return (
    <div className={`app-layout ${sidebar.isOpen ? 'sidebar-open' : ''}`}>
      {/* Sidebar */}
      <aside className={`sidebar ${sidebar.isCollapsed ? 'collapsed' : ''}`}>
        <nav>
          <button
            className={sidebar.activeSection === 'dashboard' ? 'active' : ''}
            onClick={() => dispatch({ 
              type: 'ui/setActiveSection', 
              payload: 'dashboard' 
            })}
          >
            Dashboard
          </button>
          <button
            className={sidebar.activeSection === 'users' ? 'active' : ''}
            onClick={() => dispatch({ 
              type: 'ui/setActiveSection', 
              payload: 'users' 
            })}
          >
            Users
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main>
        <button onClick={() => dispatch(toggleSidebar())}>
          Toggle Sidebar
        </button>
        <div>Content for {sidebar.activeSection}</div>
      </main>
    </div>
  );
};

// ============================================
// EXAMPLE 3: ADVANCED FILTERS
// ============================================

export const FiltersExample = () => {
  const dispatch = useDispatch();
  const filters = useSelector(state => state.ui.filters);

  const handleSearchChange = (e) => {
    dispatch(setSearch(e.target.value));
  };

  const handleCategoryChange = (category) => {
    dispatch(setFilter({ category }));
  };

  const handlePriceChange = (min, max) => {
    dispatch(setFilter({ price: { min, max } }));
  };

  const handleTagAdd = (tag) => {
    dispatch({ type: 'ui/addTag', payload: tag });
  };

  const handleTagRemove = (tag) => {
    dispatch({ type: 'ui/removeTag', payload: tag });
  };

  const handleReset = () => {
    dispatch({ type: 'ui/resetFilters' });
  };

  return (
    <div className="filters-panel">
      {/* Search */}
      <input
        type="text"
        placeholder="Search..."
        value={filters.search}
        onChange={handleSearchChange}
      />

      {/* Category Filter */}
      <select 
        value={filters.category} 
        onChange={(e) => handleCategoryChange(e.target.value)}
      >
        <option value="all">All Categories</option>
        <option value="electronics">Electronics</option>
        <option value="books">Books</option>
        <option value="clothing">Clothing</option>
      </select>

      {/* Status Filter */}
      <select 
        value={filters.status}
        onChange={(e) => dispatch(setFilter({ status: e.target.value }))}
      >
        <option value="all">All Status</option>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </select>

      {/* Price Range */}
      <div className="price-range">
        <input
          type="number"
          placeholder="Min"
          value={filters.price.min}
          onChange={(e) => handlePriceChange(+e.target.value, filters.price.max)}
        />
        <input
          type="number"
          placeholder="Max"
          value={filters.price.max}
          onChange={(e) => handlePriceChange(filters.price.min, +e.target.value)}
        />
      </div>

      {/* Tags */}
      <div className="tags">
        {filters.tags.map(tag => (
          <span key={tag} className="tag">
            {tag}
            <button onClick={() => handleTagRemove(tag)}>×</button>
          </span>
        ))}
        <button onClick={() => handleTagAdd('new-tag')}>Add Tag</button>
      </div>

      {/* Sort */}
      <select
        value={filters.sortBy}
        onChange={(e) => dispatch(setFilter({ sortBy: e.target.value }))}
      >
        <option value="createdAt">Date Created</option>
        <option value="name">Name</option>
        <option value="price">Price</option>
      </select>
      
      <button onClick={() => dispatch({ type: 'ui/toggleSortOrder' })}>
        {filters.sortOrder === 'asc' ? '↑' : '↓'}
      </button>

      {/* Reset */}
      <button onClick={handleReset}>Reset Filters</button>
    </div>
  );
};

// ============================================
// EXAMPLE 4: PAGINATION
// ============================================

export const PaginationExample = ({ totalItems }) => {
  const dispatch = useDispatch();
  const pagination = useSelector(state => state.ui.pagination);

  useEffect(() => {
    dispatch({ type: 'ui/setTotalItems', payload: totalItems });
  }, [totalItems, dispatch]);

  const totalPages = Math.ceil(pagination.totalItems / pagination.pageSize);

  return (
    <div className="pagination">
      <button
        onClick={() => dispatch({ type: 'ui/previousPage' })}
        disabled={pagination.currentPage === 1}
      >
        Previous
      </button>

      <span>
        Page {pagination.currentPage} of {totalPages}
      </span>

      <button
        onClick={() => dispatch({ type: 'ui/nextPage' })}
        disabled={pagination.currentPage >= totalPages}
      >
        Next
      </button>

      <select
        value={pagination.pageSize}
        onChange={(e) => dispatch({ 
          type: 'ui/setPageSize', 
          payload: Number(e.target.value) 
        })}
      >
        <option value={10}>10 per page</option>
        <option value={25}>25 per page</option>
        <option value={50}>50 per page</option>
        <option value={100}>100 per page</option>
      </select>
    </div>
  );
};

// ============================================
// EXAMPLE 5: VIEW MODE TOGGLE
// ============================================

export const ViewModeExample = () => {
  const dispatch = useDispatch();
  const viewMode = useSelector(state => state.ui.viewMode);

  return (
    <div className="view-mode-controls">
      <button
        className={viewMode === 'grid' ? 'active' : ''}
        onClick={() => dispatch(setViewMode('grid'))}
      >
        Grid
      </button>
      <button
        className={viewMode === 'list' ? 'active' : ''}
        onClick={() => dispatch(setViewMode('list'))}
      >
        List
      </button>
      <button
        className={viewMode === 'kanban' ? 'active' : ''}
        onClick={() => dispatch(setViewMode('kanban'))}
      >
        Kanban
      </button>
      <button
        className={viewMode === 'table' ? 'active' : ''}
        onClick={() => dispatch(setViewMode('table'))}
      >
        Table
      </button>
    </div>
  );
};

// ============================================
// EXAMPLE 6: TOAST NOTIFICATIONS
// ============================================

export const NotificationsExample = () => {
  const dispatch = useDispatch();
  const notifications = useSelector(state => state.ui.notifications);

  const showSuccess = () => {
    dispatch(addNotification({
      type: 'success',
      message: 'Operation completed successfully!',
      duration: 3000,
    }));
  };

  const showError = () => {
    dispatch(addNotification({
      type: 'error',
      message: 'Something went wrong!',
      duration: 5000,
    }));
  };

  const showWarning = () => {
    dispatch(addNotification({
      type: 'warning',
      message: 'Please review this action',
      duration: 4000,
    }));
  };

  return (
    <>
      <div className="action-buttons">
        <button onClick={showSuccess}>Show Success</button>
        <button onClick={showError}>Show Error</button>
        <button onClick={showWarning}>Show Warning</button>
      </div>

      {/* Toast Container */}
      <div className="toast-container">
        {notifications.map((notif) => (
          <Toast key={notif.id} notification={notif} />
        ))}
      </div>
    </>
  );
};

const Toast = ({ notification }) => {
  const dispatch = useDispatch();

  useEffect(() => {
    const timer = setTimeout(() => {
      dispatch(removeNotification(notification.id));
    }, notification.duration);

    return () => clearTimeout(timer);
  }, [notification, dispatch]);

  return (
    <div className={`toast toast-${notification.type}`}>
      <span>{notification.message}</span>
      <button onClick={() => dispatch(removeNotification(notification.id))}>
        ×
      </button>
    </div>
  );
};

// ============================================
// EXAMPLE 7: THEME TOGGLE
// ============================================

export const ThemeToggle = () => {
  const dispatch = useDispatch();
  const theme = useSelector(state => state.ui.theme);

  useEffect(() => {
    document.body.className = theme.mode;
    document.documentElement.style.setProperty('--primary-color', theme.primaryColor);
  }, [theme]);

  return (
    <div className="theme-controls">
      <button onClick={() => dispatch(toggleTheme())}>
        {theme.mode === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode'}
      </button>

      <select
        value={theme.fontSize}
        onChange={(e) => dispatch({ 
          type: 'ui/setFontSize', 
          payload: e.target.value 
        })}
      >
        <option value="small">Small</option>
        <option value="medium">Medium</option>
        <option value="large">Large</option>
      </select>

      <input
        type="color"
        value={theme.primaryColor}
        onChange={(e) => dispatch({ 
          type: 'ui/setPrimaryColor', 
          payload: e.target.value 
        })}
      />
    </div>
  );
};

// ============================================
// EXAMPLE 8: BULK SELECTION
// ============================================

export const BulkSelectionExample = ({ items }) => {
  const dispatch = useDispatch();
  const selection = useSelector(state => state.ui.selection);

  const handleSelectAll = () => {
    const allIds = items.map(item => item.id);
    dispatch(selectAll(allIds));
  };

  const handleDeselectAll = () => {
    dispatch(deselectAll());
  };

  const handleToggleItem = (id) => {
    dispatch(toggleSelection(id));
  };

  const handleBulkDelete = () => {
    if (selection.selectedIds.length > 0) {
      console.log('Deleting:', selection.selectedIds);
      // Perform bulk delete
      dispatch(deselectAll());
    }
  };

  return (
    <div>
      <div className="bulk-actions">
        <button onClick={handleSelectAll}>Select All</button>
        <button onClick={handleDeselectAll}>Deselect All</button>
        
        {selection.selectedIds.length > 0 && (
          <button onClick={handleBulkDelete}>
            Delete Selected ({selection.selectedIds.length})
          </button>
        )}
      </div>

      <div className="items-list">
        {items.map(item => (
          <div key={item.id} className="item">
            <input
              type="checkbox"
              checked={selection.selectedIds.includes(item.id)}
              onChange={() => handleToggleItem(item.id)}
            />
            <span>{item.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================
// EXAMPLE 9: DRAWER/SIDE PANEL
// ============================================

export const DrawerExample = () => {
  const dispatch = useDispatch();
  const drawers = useSelector(state => state.ui.drawers);

  const handleOpenFilters = () => {
    dispatch(openDrawer({ 
      side: 'right', 
      content: 'filters' 
    }));
  };

  const handleOpenProfile = () => {
    dispatch(openDrawer({ 
      side: 'right', 
      content: 'profile' 
    }));
  };

  return (
    <div className="app">
      <button onClick={handleOpenFilters}>Open Filters</button>
      <button onClick={handleOpenProfile}>Open Profile</button>

      {/* Right Drawer */}
      {drawers.right.isOpen && (
        <div className="drawer drawer-right">
          <div className="drawer-header">
            <h3>
              {drawers.right.content === 'filters' ? 'Filters' : 'Profile'}
            </h3>
            <button onClick={() => dispatch(closeDrawer('right'))}>×</button>
          </div>
          <div className="drawer-content">
            {drawers.right.content === 'filters' && <FiltersExample />}
            {drawers.right.content === 'profile' && <div>Profile Content</div>}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// EXAMPLE 10: ONBOARDING TOUR
// ============================================

export const OnboardingExample = () => {
  const dispatch = useDispatch();
  const onboarding = useSelector(state => state.ui.onboarding);

  const steps = [
    { title: 'Welcome!', content: 'Welcome to our app!' },
    { title: 'Create Items', content: 'Click here to create new items' },
    { title: 'Manage Settings', content: 'Customize your experience' },
    { title: 'Done!', content: 'You\'re all set!' },
  ];

  useEffect(() => {
    // Start onboarding for new users
    const hasSeenOnboarding = localStorage.getItem('onboarding_completed');
    if (!hasSeenOnboarding) {
      dispatch(startOnboarding());
    }
  }, [dispatch]);

  const handleNext = () => {
    if (onboarding.currentStep < steps.length - 1) {
      dispatch(nextOnboardingStep());
    } else {
      dispatch({ type: 'ui/completeOnboarding' });
      localStorage.setItem('onboarding_completed', 'true');
    }
  };

  const handleSkip = () => {
    dispatch({ type: 'ui/skipOnboarding' });
    localStorage.setItem('onboarding_completed', 'true');
  };

  if (!onboarding.isActive) return null;

  const currentStep = steps[onboarding.currentStep];

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-card">
        <h2>{currentStep.title}</h2>
        <p>{currentStep.content}</p>
        
        <div className="onboarding-controls">
          <span>
            Step {onboarding.currentStep + 1} of {steps.length}
          </span>
          <div>
            <button onClick={handleSkip}>Skip</button>
            <button onClick={handleNext}>
              {onboarding.currentStep === steps.length - 1 ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// EXAMPLE 11: COMPARISON MODE
// ============================================

export const ComparisonExample = ({ products }) => {
  const dispatch = useDispatch();
  const comparison = useSelector(state => state.ui.comparison);

  const handleAddToCompare = (product) => {
    if (comparison.items.length < 4) {
      dispatch(addToComparison(product));
    }
  };

  const handleRemoveFromCompare = (id) => {
    dispatch({ type: 'ui/removeFromComparison', payload: id });
  };

  const handleClearCompare = () => {
    dispatch({ type: 'ui/clearComparison' });
  };

  return (
    <div>
      <button onClick={() => dispatch({ type: 'ui/toggleComparison' })}>
        {comparison.isActive ? 'Exit' : 'Start'} Comparison
      </button>

      {comparison.isActive && (
        <div className="comparison-bar">
          <div className="comparison-items">
            {comparison.items.map(item => (
              <div key={item.id} className="comparison-item">
                <span>{item.name}</span>
                <button onClick={() => handleRemoveFromCompare(item.id)}>×</button>
              </div>
            ))}
          </div>
          <button onClick={handleClearCompare}>Clear All</button>
          <button>Compare ({comparison.items.length})</button>
        </div>
      )}

      <div className="products-grid">
        {products.map(product => (
          <div key={product.id} className="product-card">
            <h3>{product.name}</h3>
            <p>${product.price}</p>
            {comparison.isActive && (
              <button
                onClick={() => handleAddToCompare(product)}
                disabled={
                  comparison.items.find(i => i.id === product.id) ||
                  comparison.items.length >= 4
                }
              >
                {comparison.items.find(i => i.id === product.id)
                  ? 'Added'
                  : 'Add to Compare'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================
// EXAMPLE 12: COMPLETE DASHBOARD
// ============================================

export const CompleteDashboard = () => {
  const dispatch = useDispatch();
  const viewMode = useSelector(state => state.ui.viewMode);
  const filters = useSelector(state => state.ui.filters);
  const pagination = useSelector(state => state.ui.pagination);
  const theme = useSelector(state => state.ui.theme);

  return (
    <div className={`dashboard theme-${theme.mode}`}>
      {/* Header */}
      <header className="dashboard-header">
        <h1>Dashboard</h1>
        <ThemeToggle />
      </header>

      {/* Filters Bar */}
      <div className="filters-bar">
        <FiltersExample />
        <ViewModeExample />
      </div>

      {/* Content Area */}
      <div className={`content-area view-${viewMode}`}>
        {/* Your content here based on viewMode */}
        <p>Current view: {viewMode}</p>
        <p>Search: {filters.search}</p>
        <p>Category: {filters.category}</p>
      </div>

      {/* Pagination */}
      <PaginationExample totalItems={100} />

      {/* Notifications */}
      <NotificationsExample />
    </div>
  );
};