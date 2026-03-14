# RTK QUERY vs TRADITIONAL REDUX - QUICK REFERENCE

## 📊 COMPARISON TABLE

| Feature | Traditional Redux | RTK Query |
|---------|------------------|-----------|
| **Lines of code** | 50-100 lines | 10-20 lines |
| **Boilerplate** | High (actions, reducers, thunks) | Minimal (just endpoints) |
| **Caching** | Manual implementation | Automatic |
| **Loading states** | Manual tracking | Auto-generated |
| **Error handling** | Manual try-catch everywhere | Built-in |
| **Data refetching** | Manual dispatching | Automatic on invalidation |
| **Optimistic updates** | Complex manual code | Simple hooks API |
| **DevTools** | Yes | Yes + Query Inspector |
| **TypeScript** | Manual types | Auto-generated types |

---

## 🔄 SAME TASK - DIFFERENT APPROACHES

### Task: Fetch users, display loading, handle errors

#### TRADITIONAL REDUX (80+ lines):
```javascript
// 1. Action types
const FETCH_USERS_REQUEST = 'FETCH_USERS_REQUEST';
const FETCH_USERS_SUCCESS = 'FETCH_USERS_SUCCESS';
const FETCH_USERS_FAILURE = 'FETCH_USERS_FAILURE';

// 2. Action creators
const fetchUsersRequest = () => ({ type: FETCH_USERS_REQUEST });
const fetchUsersSuccess = (users) => ({ 
  type: FETCH_USERS_SUCCESS, 
  payload: users 
});
const fetchUsersFailure = (error) => ({ 
  type: FETCH_USERS_FAILURE, 
  payload: error 
});

// 3. Initial state
const initialState = {
  users: [],
  loading: false,
  error: null,
};

// 4. Reducer
const usersReducer = (state = initialState, action) => {
  switch (action.type) {
    case FETCH_USERS_REQUEST:
      return { ...state, loading: true, error: null };
    case FETCH_USERS_SUCCESS:
      return { ...state, loading: false, users: action.payload };
    case FETCH_USERS_FAILURE:
      return { ...state, loading: false, error: action.payload };
    default:
      return state;
  }
};

// 5. Thunk
const fetchUsers = () => async (dispatch) => {
  dispatch(fetchUsersRequest());
  try {
    const response = await fetch('/api/users');
    const data = await response.json();
    dispatch(fetchUsersSuccess(data));
  } catch (error) {
    dispatch(fetchUsersFailure(error.message));
  }
};

// 6. Component
const UsersComponent = () => {
  const dispatch = useDispatch();
  const { users, loading, error } = useSelector(state => state.users);
  
  useEffect(() => {
    dispatch(fetchUsers());
  }, [dispatch]);
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  
  return (
    <div>
      {users.map(user => <div key={user.id}>{user.name}</div>)}
    </div>
  );
};
```

#### RTK QUERY (15 lines):
```javascript
// 1. Define endpoint
export const api = createApi({
  baseQuery: fetchBaseQuery({ baseURL: '/api' }),
  endpoints: (builder) => ({
    getUsers: builder.query({
      query: () => '/users',
    }),
  }),
});

export const { useGetUsersQuery } = api;

// 2. Component
const UsersComponent = () => {
  const { data: users, isLoading, error } = useGetUsersQuery();
  
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  
  return (
    <div>
      {users?.map(user => <div key={user.id}>{user.name}</div>)}
    </div>
  );
};
```

**Result: 80+ lines → 15 lines (81% reduction!)**

---

## 🎯 WHEN TO USE WHAT

### Use RTK Query When:
✅ Fetching data from APIs  
✅ Need automatic caching  
✅ Want automatic refetching  
✅ CRUD operations  
✅ Real-time data with polling  
✅ Working with REST or GraphQL APIs  

### Use Traditional Redux (Regular Slices) When:
✅ UI state (modals, tooltips, sidebars)  
✅ Form state  
✅ Theme/locale preferences  
✅ Auth tokens and user session  
✅ Client-side only state  
✅ Complex state transformations  

### Best Practice: **Use Both Together!**
```javascript
// Store setup
export const store = configureStore({
  reducer: {
    // RTK Query for server data
    [api.reducerPath]: api.reducer,
    
    // Regular slices for client state
    ui: uiSlice.reducer,
    auth: authSlice.reducer,
    theme: themeSlice.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(api.middleware),
});
```

---

## 🚀 MIGRATION CHECKLIST

Migrating from Traditional Redux to RTK Query:

1. ✅ Install packages
   ```bash
   npm install @reduxjs/toolkit react-redux
   ```

2. ✅ Create API slice
   - Define base query
   - Add endpoints
   - Export hooks

3. ✅ Update store
   - Add API reducer
   - Add API middleware

4. ✅ Update components
   - Replace `useDispatch` + thunks with hooks
   - Replace `useSelector` with query hooks
   - Remove manual loading/error state

5. ✅ Remove old code
   - Delete action types
   - Delete action creators
   - Delete thunks
   - Delete reducers for API data

6. ✅ Test thoroughly
   - Verify data fetching
   - Check cache behavior
   - Test mutations
   - Verify error handling

---

## 🔍 RTK QUERY HOOK PATTERNS

### Basic Query Hook
```javascript
const { data, error, isLoading } = useGetUsersQuery();
```

### Query with Arguments
```javascript
const { data } = useGetUserQuery(userId);
```

### Conditional Query (Skip)
```javascript
const { data } = useGetUserQuery(userId, { skip: !userId });
```

### Polling Query
```javascript
const { data } = useGetUsersQuery(undefined, {
  pollingInterval: 3000, // refetch every 3s
});
```

### Lazy Query
```javascript
const [trigger, result] = useLazyGetUserQuery();
// Call manually: trigger(userId);
```

### Mutation Hook
```javascript
const [createUser, { isLoading, error }] = useCreateUserMutation();

// Call it:
await createUser(userData).unwrap();
```

---

## 💾 STATE STRUCTURE COMPARISON

### Traditional Redux State:
```javascript
{
  users: {
    list: [],
    loading: false,
    error: null,
  },
  posts: {
    list: [],
    loading: false,
    error: null,
  },
  // Repeat for every resource...
}
```

### RTK Query State:
```javascript
{
  api: {
    queries: {
      'getUsers(undefined)': {
        status: 'fulfilled',
        data: [...],
      },
      'getPosts(undefined)': {
        status: 'fulfilled',
        data: [...],
      },
    },
    mutations: {...},
    provided: {...},
    subscriptions: {...},
  },
  // Your regular slices
  ui: {...},
  auth: {...},
}
```

**Notice:** RTK Query manages its own normalized structure!

---

## 🎨 BEST PRACTICES

1. **File Structure**
   ```
   src/
   ├── store/
   │   ├── store.js           (store config)
   │   ├── apiSlice.js        (RTK Query API)
   │   └── slices/
   │       ├── uiSlice.js     (UI state)
   │       └── authSlice.js   (Auth state)
   ```

2. **Naming Conventions**
   - Queries: `getUsers`, `getUserById`, `searchPosts`
   - Mutations: `createUser`, `updateUser`, `deleteUser`
   - Hooks: Auto-generated with `use` prefix

3. **Error Handling**
   ```javascript
   try {
     await mutation(data).unwrap();
     // Success
   } catch (err) {
     // Handle error
     console.error(err.data?.message);
   }
   ```

4. **Cache Tags Organization**
   ```javascript
   tagTypes: ['User', 'Post', 'Comment'],
   
   // Provide tags
   providesTags: (result, error, id) => [
     { type: 'User', id },
     { type: 'User', id: 'LIST' },
   ],
   
   // Invalidate tags
   invalidatesTags: [{ type: 'User', id: 'LIST' }],
   ```

---

## 📈 PERFORMANCE BENEFITS

| Metric | Traditional Redux | RTK Query |
|--------|------------------|-----------|
| Bundle size | Manual (~2KB) | Auto (~9KB) |
| Development time | ~2 hours | ~15 minutes |
| Bugs | More (manual code) | Fewer (tested library) |
| Caching | Manual | Automatic |
| Network requests | Often duplicate | Deduplicated |
| Re-renders | Many | Optimized |

---

## 🎓 LEARNING RESOURCES

1. **Official Docs**
   - https://redux-toolkit.js.org/rtk-query/overview

2. **Key Concepts to Master**
   - Queries vs Mutations
   - Cache tags and invalidation
   - Optimistic updates
   - Transforming responses
   - Error handling

3. **Common Patterns**
   - Pagination
   - Infinite scroll
   - Polling
   - Prefetching
   - Optimistic UI updates

---

## 🎯 DECISION FLOWCHART

```
Need to manage state?
│
├─ Is it SERVER data? (from API)
│  └─ YES → Use RTK Query ✅
│
└─ Is it CLIENT data? (UI state, preferences)
   └─ YES → Use Regular Redux Slice ✅
```

---

## 💡 PRO TIPS

1. **Don't overthink** - Start with RTK Query hooks, use selectors only when needed

2. **Combine approaches** - RTK Query for data + regular slices for UI = Perfect!

3. **Use TypeScript** - RTK Query has AMAZING TypeScript support

4. **DevTools are your friend** - Install Redux DevTools Extension

5. **Read the cache** - Use the Query Inspector in DevTools

6. **Don't fight the cache** - Trust RTK Query's caching, it's smarter than you think 😄

---

## ✨ FINAL RECOMMENDATION

For your app:
- ✅ Keep **AuthContext** for authentication (simple, works great)
- ✅ Use **RTK Query** for all API data (equipment, teams, requests)
- ✅ Add **UI slice** if you need global UI state (modals, filters, etc.)

This gives you the best of all worlds! 🚀