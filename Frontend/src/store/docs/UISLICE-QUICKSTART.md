# UI SLICE STARTER KIT - QUICK START GUIDE

## 📦 What's Included

This UI slice template provides ready-to-use state management for:

✅ Modals & Dialogs  
✅ Sidebar & Navigation  
✅ Filters & Search  
✅ Pagination  
✅ View Modes (Grid/List/Kanban/Table)  
✅ Notifications/Toasts  
✅ Theme & Dark Mode  
✅ Bulk Selection  
✅ Drawers/Side Panels  
✅ Onboarding Tours  
✅ Comparison Mode  
✅ Loading States  
✅ Quick Actions  

---

## 🚀 Quick Start (3 Steps)

### Step 1: Install Dependencies

```bash
npm install @reduxjs/toolkit react-redux
```

### Step 2: Add to Your Store

```javascript
// store/store.js
import { configureStore } from '@reduxjs/toolkit';
import uiReducer from './uiSlice';

export const store = configureStore({
  reducer: {
    ui: uiReducer,
    // ... your other slices
  },
});
```

### Step 3: Wrap Your App

```javascript
// App.jsx
import { Provider } from 'react-redux';
import { store } from './store/store';

function App() {
  return (
    <Provider store={store}>
      {/* Your app components */}
    </Provider>
  );
}
```

---

## 💡 Usage Examples

### Example 1: Simple Modal

```javascript
import { useModal } from './uiSlice-hooks';

function CreateUserButton() {
  const createModal = useModal('createUser');
  
  return (
    <>
      <button onClick={() => createModal.open()}>Create User</button>
      
      {createModal.isOpen && (
        <div className="modal">
          <h2>Create User</h2>
          <form>
            {/* Form fields */}
            <button onClick={createModal.close}>Cancel</button>
          </form>
        </div>
      )}
    </>
  );
}
```

### Example 2: Toast Notifications

```javascript
import { useNotification } from './uiSlice-hooks';

function SaveButton() {
  const notify = useNotification();
  
  const handleSave = async () => {
    try {
      await saveData();
      notify.showSuccess('Saved successfully!');
    } catch (error) {
      notify.showError('Failed to save');
    }
  };
  
  return <button onClick={handleSave}>Save</button>;
}
```

### Example 3: Filters & Search

```javascript
import { useFilters } from './uiSlice-hooks';

function ProductList() {
  const { filters, setSearch, setCategory, reset } = useFilters();
  
  return (
    <div>
      <input
        value={filters.search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search..."
      />
      
      <select 
        value={filters.category}
        onChange={(e) => setCategory(e.target.value)}
      >
        <option value="all">All</option>
        <option value="electronics">Electronics</option>
      </select>
      
      <button onClick={reset}>Reset</button>
    </div>
  );
}
```

### Example 4: Dark Mode Toggle

```javascript
import { useTheme } from './uiSlice-hooks';

function ThemeToggle() {
  const { isDark, toggleMode } = useTheme();
  
  return (
    <button onClick={toggleMode}>
      {isDark ? '☀️ Light Mode' : '🌙 Dark Mode'}
    </button>
  );
}
```

### Example 5: Pagination

```javascript
import { usePagination } from './uiSlice-hooks';

function PaginatedList({ totalItems }) {
  const {
    currentPage,
    pageSize,
    totalPages,
    hasNext,
    hasPrevious,
    nextPage,
    previousPage,
  } = usePagination(totalItems);
  
  return (
    <div>
      <button onClick={previousPage} disabled={!hasPrevious}>
        Previous
      </button>
      <span>Page {currentPage} of {totalPages}</span>
      <button onClick={nextPage} disabled={!hasNext}>
        Next
      </button>
    </div>
  );
}
```

### Example 6: View Mode Switcher

```javascript
import { useViewMode } from './uiSlice-hooks';

function ViewSwitcher() {
  const { viewMode, setMode, isGrid, isList } = useViewMode();
  
  return (
    <div>
      <button
        className={isGrid ? 'active' : ''}
        onClick={() => setMode('grid')}
      >
        Grid
      </button>
      <button
        className={isList ? 'active' : ''}
        onClick={() => setMode('list')}
      >
        List
      </button>
    </div>
  );
}
```

### Example 7: Bulk Selection

```javascript
import { useSelection } from './uiSlice-hooks';

function ItemsList({ items }) {
  const { selectedIds, toggle, selectAll, deselectAll, hasSelection } = useSelection();
  
  return (
    <div>
      <button onClick={() => selectAll(items.map(i => i.id))}>
        Select All
      </button>
      <button onClick={deselectAll}>Clear</button>
      
      {hasSelection && (
        <button>Delete Selected ({selectedIds.length})</button>
      )}
      
      {items.map(item => (
        <div key={item.id}>
          <input
            type="checkbox"
            checked={selectedIds.includes(item.id)}
            onChange={() => toggle(item.id)}
          />
          {item.name}
        </div>
      ))}
    </div>
  );
}
```

---

## 🎨 Customization

### Adding New Modal Types

```javascript
// In uiSlice.js, add to initialState.modals:
modals: {
  createUser: { isOpen: false, data: null },
  editUser: { isOpen: false, data: null },
  confirmDelete: { isOpen: false, data: null },
  // Add your custom modal here 👇
  customModal: { isOpen: false, data: null },
}
```

### Adding Custom Filters

```javascript
// In uiSlice.js, add to initialState.filters:
filters: {
  search: '',
  category: 'all',
  // Add your custom filter here 👇
  brand: 'all',
  inStock: true,
}

// Add reducer action:
setBrand: (state, action) => {
  state.filters.brand = action.payload;
},
```

### Custom Loading States

```javascript
// In uiSlice.js, add to initialState.loading:
loading: {
  global: false,
  uploadingFile: false,
  // Add your custom loading state here 👇
  generatingReport: false,
  sendingEmail: false,
}
```

---

## 📚 Available Hooks Reference

| Hook | Purpose | Example |
|------|---------|---------|
| `useModal(name)` | Manage modals | `const modal = useModal('createUser')` |
| `useNotification()` | Show toasts | `notify.showSuccess('Done!')` |
| `useFilters()` | Filter management | `const { filters, setSearch } = useFilters()` |
| `usePagination(total)` | Pagination | `const { currentPage, nextPage } = usePagination(100)` |
| `useViewMode()` | View modes | `const { viewMode, setMode } = useViewMode()` |
| `useTheme()` | Theme control | `const { isDark, toggleMode } = useTheme()` |
| `useSelection()` | Bulk select | `const { selectedIds, toggle } = useSelection()` |
| `useDrawer(side)` | Side panels | `const drawer = useDrawer('right')` |
| `useSidebar()` | Sidebar state | `const { isOpen, toggle } = useSidebar()` |
| `useLoading(key)` | Loading states | `const { isLoading, startLoading } = useLoading()` |
| `useOnboarding()` | Tours | `const { isActive, next } = useOnboarding()` |
| `useComparison()` | Compare items | `const { items, add } = useComparison()` |

---

## 🎯 Common Patterns

### Pattern 1: Form with Notifications

```javascript
function CreateItemForm() {
  const modal = useModal('createItem');
  const notify = useNotification();
  
  const handleSubmit = async (data) => {
    try {
      await createItem(data);
      notify.showSuccess('Item created!');
      modal.close();
    } catch (error) {
      notify.showError('Failed to create item');
    }
  };
  
  return (
    <>
      <button onClick={modal.open}>Create Item</button>
      {modal.isOpen && (
        <form onSubmit={handleSubmit}>
          {/* form fields */}
        </form>
      )}
    </>
  );
}
```

### Pattern 2: Filtered & Paginated List

```javascript
function ProductsList({ products }) {
  const { filters, setSearch, setCategory } = useFilters();
  const { currentPage, nextPage, previousPage } = usePagination(products.length);
  const { viewMode, setMode } = useViewMode();
  
  // Filter products
  const filtered = products.filter(p => 
    p.name.includes(filters.search) &&
    (filters.category === 'all' || p.category === filters.category)
  );
  
  // Paginate
  const paginated = filtered.slice(
    (currentPage - 1) * 10,
    currentPage * 10
  );
  
  return (
    <div>
      <input onChange={(e) => setSearch(e.target.value)} />
      <select onChange={(e) => setCategory(e.target.value)}>
        <option value="all">All</option>
      </select>
      
      <div className={`view-${viewMode}`}>
        {paginated.map(product => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
      
      <button onClick={previousPage}>Prev</button>
      <button onClick={nextPage}>Next</button>
    </div>
  );
}
```

### Pattern 3: Dashboard with Everything

```javascript
function Dashboard() {
  const { isDark } = useTheme();
  const { isOpen, toggle } = useSidebar();
  const notify = useNotification();
  
  return (
    <div className={isDark ? 'dark' : 'light'}>
      <Sidebar isOpen={isOpen} toggle={toggle} />
      <main>
        <Filters />
        <ViewModeSwitcher />
        <DataTable />
        <Pagination />
      </main>
      <NotificationContainer />
    </div>
  );
}
```

---

## 🔧 Integration with RTK Query

```javascript
import { useGetProductsQuery } from './apiSlice';
import { useFilters, usePagination } from './uiSlice-hooks';

function ProductsPage() {
  const { filters } = useFilters();
  const { currentPage, pageSize } = usePagination();
  
  // RTK Query automatically uses filters and pagination
  const { data, isLoading } = useGetProductsQuery({
    search: filters.search,
    category: filters.category,
    page: currentPage,
    limit: pageSize,
  });
  
  return <div>{/* Render products */}</div>;
}
```

---

## 🎁 Bonus: Persistence

To save UI state across sessions:

```javascript
// Add redux-persist
import { persistReducer } from 'redux-persist';
import storage from 'redux-persist/lib/storage';

const persistConfig = {
  key: 'ui',
  storage,
  whitelist: ['theme', 'sidebar', 'filters'], // What to persist
};

const persistedReducer = persistReducer(persistConfig, uiReducer);
```

---

## ✨ Tips for Hackathons

1. **Start with modals & notifications** - Most apps need these
2. **Add filters if you have lists** - Users love filtering
3. **Dark mode = instant points** - Use `useTheme()` hook
4. **Onboarding tour impresses judges** - Use `useOnboarding()`
5. **Comparison mode for e-commerce** - Use `useComparison()`

---

## 📝 File Structure

```
src/
├── store/
│   ├── store.js           ← Redux store setup
│   ├── uiSlice.js         ← UI state slice
│   ├── uiSlice-hooks.js   ← Custom hooks
│   └── apiSlice.js        ← RTK Query (optional)
├── components/
│   ├── Modal.jsx
│   ├── Notification.jsx
│   └── ...
└── App.jsx
```

---

## 🚨 Common Mistakes to Avoid

❌ **Don't** put API data in UI slice (use RTK Query)  
❌ **Don't** store form values here (use local state or form libraries)  
❌ **Don't** forget to reset filters when needed  
✅ **Do** use custom hooks for cleaner code  
✅ **Do** combine with RTK Query for complete solution  
✅ **Do** customize the template for your needs  

---

## 🎓 Next Steps

1. Copy `uiSlice.js` to your project
2. Copy `uiSlice-hooks.js` for easier usage
3. Add to your Redux store
4. Start using hooks in components
5. Customize for your specific needs

---

## 💪 You're Ready!

This template saves you hours of boilerplate code. Just drop it into your project and start building features!

Happy coding! 🚀