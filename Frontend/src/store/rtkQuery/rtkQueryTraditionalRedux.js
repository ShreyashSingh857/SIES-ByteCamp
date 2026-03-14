// ============================================
// USING RTK QUERY WITH TRADITIONAL REDUX PATTERNS
// (useSelector, useDispatch, actions, state)
// ============================================

import { useSelector, useDispatch } from 'react-redux';
import { apiSlice } from './apiSlice';

// ============================================
// METHOD 1: Using Selectors to Access Query State
// ============================================

export const PostsListWithSelector = () => {
  const dispatch = useDispatch();
  
  // Access query state using selectors
  const postsQuery = useSelector(
    (state) => apiSlice.endpoints.getPosts.select()(state)
  );
  
  const {
    data: posts,
    isLoading,
    isFetching,
    error,
    status,
  } = postsQuery;
  
  // Manually trigger the query
  const handleRefresh = () => {
    dispatch(apiSlice.endpoints.getPosts.initiate());
  };
  
  if (isLoading) return <div>Loading...</div>;
  
  return (
    <div>
      <button onClick={handleRefresh}>Refresh</button>
      {posts?.map((post) => (
        <div key={post.id}>{post.title}</div>
      ))}
    </div>
  );
};

// ============================================
// METHOD 2: Accessing Specific Query by Argument
// ============================================

export const PostDetailWithSelector = ({ postId }) => {
  const dispatch = useDispatch();
  
  // Select specific query by its argument
  const postQuery = useSelector(
    (state) => apiSlice.endpoints.getPost.select(postId)(state)
  );
  
  const { data: post, isLoading } = postQuery;
  
  // Manually initiate query with argument
  const loadPost = () => {
    dispatch(apiSlice.endpoints.getPost.initiate(postId));
  };
  
  React.useEffect(() => {
    loadPost();
  }, [postId]);
  
  if (isLoading) return <div>Loading...</div>;
  
  return (
    <div>
      <h1>{post?.title}</h1>
      <p>{post?.content}</p>
    </div>
  );
};

// ============================================
// METHOD 3: Using util.getRunningQueriesThunk
// ============================================

export const ServerSideDataFetch = () => {
  const dispatch = useDispatch();
  
  // This is useful for SSR or prefetching
  React.useEffect(() => {
    // Dispatch the query
    const promise = dispatch(apiSlice.endpoints.getPosts.initiate());
    
    // Cleanup: unsubscribe when component unmounts
    return () => {
      promise.unsubscribe();
    };
  }, [dispatch]);
  
  // Access the data
  const posts = useSelector((state) => 
    apiSlice.endpoints.getPosts.select()(state).data
  );
  
  return <div>{/* Render posts */}</div>;
};

// ============================================
// METHOD 4: Manual Cache Manipulation
// ============================================

export const ManualCacheUpdate = () => {
  const dispatch = useDispatch();
  
  const handleOptimisticUpdate = (postId, newTitle) => {
    // Manually update the cache
    dispatch(
      apiSlice.util.updateQueryData('getPosts', undefined, (draft) => {
        const post = draft.find((p) => p.id === postId);
        if (post) {
          post.title = newTitle;
        }
      })
    );
  };
  
  const handleInvalidateCache = () => {
    // Invalidate specific tags
    dispatch(
      apiSlice.util.invalidateTags([{ type: 'Post', id: 'LIST' }])
    );
  };
  
  const handleResetCache = () => {
    // Reset entire API state
    dispatch(apiSlice.util.resetApiState());
  };
  
  return (
    <div>
      <button onClick={() => handleOptimisticUpdate(1, 'New Title')}>
        Update Cache
      </button>
      <button onClick={handleInvalidateCache}>
        Invalidate Cache
      </button>
      <button onClick={handleResetCache}>
        Reset All Cache
      </button>
    </div>
  );
};

// ============================================
// METHOD 5: Combining RTK Query with Regular Slices
// ============================================

import { createSlice } from '@reduxjs/toolkit';

// Regular Redux slice for UI state
const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    selectedPostId: null,
    viewMode: 'grid',
    filters: {
      category: 'all',
      sortBy: 'date',
    },
  },
  reducers: {
    setSelectedPost: (state, action) => {
      state.selectedPostId = action.payload;
    },
    setViewMode: (state, action) => {
      state.viewMode = action.payload;
    },
    setFilter: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },
  },
});

export const { setSelectedPost, setViewMode, setFilter } = uiSlice.actions;

// Store configuration
import { configureStore } from '@reduxjs/toolkit';

export const store = configureStore({
  reducer: {
    [apiSlice.reducerPath]: apiSlice.reducer,
    ui: uiSlice.reducer,  // Regular slice
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(apiSlice.middleware),
});

// Using both RTK Query and regular Redux
export const PostsWithFilters = () => {
  const dispatch = useDispatch();
  
  // RTK Query data
  const { data: posts, isLoading } = useGetPostsQuery();
  
  // Regular Redux state
  const { viewMode, filters, selectedPostId } = useSelector((state) => state.ui);
  
  // Regular Redux actions
  const handleViewModeChange = (mode) => {
    dispatch(setViewMode(mode));
  };
  
  const handleFilterChange = (filter) => {
    dispatch(setFilter(filter));
  };
  
  const handleSelectPost = (postId) => {
    dispatch(setSelectedPost(postId));
  };
  
  // Filter posts based on Redux state
  const filteredPosts = React.useMemo(() => {
    if (!posts) return [];
    
    let result = posts;
    
    if (filters.category !== 'all') {
      result = result.filter((p) => p.category === filters.category);
    }
    
    if (filters.sortBy === 'date') {
      result = [...result].sort((a, b) => 
        new Date(b.createdAt) - new Date(a.createdAt)
      );
    }
    
    return result;
  }, [posts, filters]);
  
  return (
    <div>
      {/* View mode controls */}
      <button onClick={() => handleViewModeChange('grid')}>Grid</button>
      <button onClick={() => handleViewModeChange('list')}>List</button>
      
      {/* Filter controls */}
      <select onChange={(e) => handleFilterChange({ category: e.target.value })}>
        <option value="all">All Categories</option>
        <option value="tech">Tech</option>
        <option value="news">News</option>
      </select>
      
      {/* Render posts */}
      <div className={viewMode}>
        {filteredPosts.map((post) => (
          <div
            key={post.id}
            onClick={() => handleSelectPost(post.id)}
            className={selectedPostId === post.id ? 'selected' : ''}
          >
            {post.title}
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================
// METHOD 6: Accessing Query Status via Selector
// ============================================

export const QueryStatusMonitor = () => {
  // Access all queries and mutations status
  const queriesStatus = useSelector((state) => state.api.queries);
  const mutationsStatus = useSelector((state) => state.api.mutations);
  
  // Get specific query status
  const postsQueryStatus = useSelector((state) => {
    const queryKey = Object.keys(state.api.queries).find(
      key => key.startsWith('getPosts')
    );
    return queryKey ? state.api.queries[queryKey] : null;
  });
  
  return (
    <div>
      <h3>Query Status</h3>
      <pre>{JSON.stringify(postsQueryStatus, null, 2)}</pre>
      
      <h3>All Queries</h3>
      <pre>{JSON.stringify(queriesStatus, null, 2)}</pre>
    </div>
  );
};

// ============================================
// METHOD 7: Prefetching Data
// ============================================

export const PrefetchExample = () => {
  const dispatch = useDispatch();
  
  // Prefetch data on hover (for better UX)
  const handleMouseEnter = (postId) => {
    dispatch(apiSlice.endpoints.getPost.initiate(postId, {
      forceRefetch: false,  // Use cache if available
    }));
  };
  
  return (
    <div>
      {[1, 2, 3].map((id) => (
        <button
          key={id}
          onMouseEnter={() => handleMouseEnter(id)}
        >
          View Post {id}
        </button>
      ))}
    </div>
  );
};

// ============================================
// METHOD 8: Conditional Invalidation
// ============================================

export const ConditionalInvalidation = () => {
  const dispatch = useDispatch();
  const currentUser = useSelector((state) => state.auth.user);
  
  const handleCreatePost = async (postData) => {
    try {
      const result = await dispatch(
        apiSlice.endpoints.createPost.initiate(postData)
      ).unwrap();
      
      // Conditional cache invalidation based on user role
      if (currentUser.role === 'admin') {
        // Admins see all posts, invalidate everything
        dispatch(apiSlice.util.invalidateTags([
          { type: 'Post', id: 'LIST' },
        ]));
      } else {
        // Regular users only see their posts, invalidate selectively
        dispatch(apiSlice.util.invalidateTags([
          { type: 'Post', id: `USER-${currentUser.id}` },
        ]));
      }
      
      return result;
    } catch (error) {
      console.error('Failed to create post:', error);
    }
  };
  
  return <div>{/* Component JSX */}</div>;
};

// ============================================
// COMPLETE STATE STRUCTURE
// ============================================

/*
Your Redux state with RTK Query looks like this:

{
  api: {  // This is your apiSlice.reducerPath
    queries: {
      'getPosts(undefined)': {
        status: 'fulfilled',
        endpointName: 'getPosts',
        requestId: 'xyz123',
        data: [...],  // Your posts data
        startedTimeStamp: 1234567890,
        fulfilledTimeStamp: 1234567891,
      },
      'getPost(5)': {
        status: 'fulfilled',
        data: { id: 5, title: '...' },
        // ...
      },
    },
    mutations: {
      'createPost("abc")': {
        status: 'fulfilled',
        requestId: 'abc',
        // ...
      },
    },
    provided: {
      Post: {
        LIST: ['getPosts(undefined)'],
        5: ['getPost(5)'],
      },
    },
    subscriptions: {
      'getPosts(undefined)': {
        'xyz': { refCount: 1 },
      },
    },
    config: { ... },
  },
  ui: {  // Your regular slice
    selectedPostId: null,
    viewMode: 'grid',
    filters: { ... },
  },
  auth: {  // Another regular slice
    user: { ... },
    token: '...',
  },
}
*/

// ============================================
// ACCESSING CACHE DIRECTLY
// ============================================

export const DirectCacheAccess = () => {
  const dispatch = useDispatch();
  
  // Get cache entry directly
  const getCacheEntry = (queryName, queryArg) => {
    const state = store.getState();
    return apiSlice.endpoints[queryName].select(queryArg)(state);
  };
  
  // Example usage
  const postsCache = getCacheEntry('getPosts', undefined);
  console.log('Cached posts:', postsCache.data);
  
  // Check if data exists in cache
  const isPostCached = (postId) => {
    const state = store.getState();
    const result = apiSlice.endpoints.getPost.select(postId)(state);
    return result.status === 'fulfilled';
  };
  
  return <div>{/* Component JSX */}</div>;
};

// ============================================
// SUMMARY: When to Use Each Approach
// ============================================

/*
1. USE HOOKS (Recommended):
   - 99% of the time
   - Automatic subscription management
   - Clean, simple code

2. USE SELECTORS:
   - When you need fine-grained control
   - SSR/SSG scenarios
   - Prefetching
   - Complex cache manipulation

3. COMBINE WITH REGULAR SLICES:
   - UI state (modals, forms, filters)
   - App-level state (theme, locale)
   - Auth state (user, permissions)
   - Any non-server state

4. USE DISPATCH:
   - Manual cache invalidation
   - Prefetching on user actions
   - Optimistic updates
   - Server-side rendering
*/