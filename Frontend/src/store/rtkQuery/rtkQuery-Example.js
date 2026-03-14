// ============================================
// COMPLETE RTK QUERY EXAMPLE - BLOG APP
// ============================================

import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

// 1. CREATE THE API SLICE
export const blogApi = createApi({
  reducerPath: 'blogApi',
  
  baseQuery: fetchBaseQuery({
    baseURL: 'https://api.example.com/v1',
    prepareHeaders: (headers, { getState }) => {
      // Access Redux state if needed
      const token = getState().auth.token;
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  
  tagTypes: ['Post', 'Comment', 'User'],
  
  endpoints: (builder) => ({
    // ============ QUERIES (GET) ============
    
    // Get all posts
    getPosts: builder.query({
      query: ({ page = 1, limit = 10 }) => ({
        url: '/posts',
        params: { page, limit },
      }),
      // Provide tags for each post + a LIST tag
      providesTags: (result) =>
        result?.data
          ? [
              ...result.data.map(({ id }) => ({ type: 'Post', id })),
              { type: 'Post', id: 'LIST' },
            ]
          : [{ type: 'Post', id: 'LIST' }],
      // Transform response
      transformResponse: (response) => response.data,
      // Keep cached for 5 minutes
      keepUnusedDataFor: 300,
    }),
    
    // Get single post with comments
    getPost: builder.query({
      query: (id) => `/posts/${id}`,
      providesTags: (result, error, id) => [
        { type: 'Post', id },
        { type: 'Comment', id: 'LIST' },
      ],
      transformResponse: (response) => response.data,
    }),
    
    // Search posts
    searchPosts: builder.query({
      query: (searchTerm) => ({
        url: '/posts/search',
        params: { q: searchTerm },
      }),
      // Don't cache search results as aggressively
      keepUnusedDataFor: 60,
    }),
    
    // Get comments for a post
    getComments: builder.query({
      query: (postId) => `/posts/${postId}/comments`,
      providesTags: (result, error, postId) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Comment', id })),
              { type: 'Comment', id: `LIST-${postId}` },
            ]
          : [{ type: 'Comment', id: `LIST-${postId}` }],
    }),
    
    // ============ MUTATIONS (POST, PUT, DELETE) ============
    
    // Create post
    createPost: builder.mutation({
      query: (newPost) => ({
        url: '/posts',
        method: 'POST',
        body: newPost,
      }),
      // Invalidate the list so it refetches
      invalidatesTags: [{ type: 'Post', id: 'LIST' }],
      transformResponse: (response) => response.data,
    }),
    
    // Update post
    updatePost: builder.mutation({
      query: ({ id, ...patch }) => ({
        url: `/posts/${id}`,
        method: 'PATCH',
        body: patch,
      }),
      // Invalidate both the specific post AND the list
      invalidatesTags: (result, error, { id }) => [
        { type: 'Post', id },
        { type: 'Post', id: 'LIST' },
      ],
      // Optimistic update
      async onQueryStarted({ id, ...patch }, { dispatch, queryFulfilled }) {
        // Update cache optimistically
        const patchResult = dispatch(
          blogApi.util.updateQueryData('getPosts', undefined, (draft) => {
            const post = draft.find((p) => p.id === id);
            if (post) {
              Object.assign(post, patch);
            }
          })
        );
        
        try {
          await queryFulfilled;
        } catch {
          patchResult.undo();
        }
      },
    }),
    
    // Delete post
    deletePost: builder.mutation({
      query: (id) => ({
        url: `/posts/${id}`,
        method: 'DELETE',
      }),
      // Invalidate the deleted post and the list
      invalidatesTags: (result, error, id) => [
        { type: 'Post', id },
        { type: 'Post', id: 'LIST' },
      ],
    }),
    
    // Add comment
    addComment: builder.mutation({
      query: ({ postId, ...comment }) => ({
        url: `/posts/${postId}/comments`,
        method: 'POST',
        body: comment,
      }),
      // Invalidate comments for this specific post
      invalidatesTags: (result, error, { postId }) => [
        { type: 'Comment', id: `LIST-${postId}` },
      ],
    }),
    
    // Like post
    likePost: builder.mutation({
      query: (postId) => ({
        url: `/posts/${postId}/like`,
        method: 'POST',
      }),
      // Optimistically update like count
      async onQueryStarted(postId, { dispatch, queryFulfilled }) {
        const patchResult = dispatch(
          blogApi.util.updateQueryData('getPost', postId, (draft) => {
            draft.likes = (draft.likes || 0) + 1;
            draft.isLiked = true;
          })
        );
        
        try {
          await queryFulfilled;
        } catch {
          patchResult.undo();
        }
      },
    }),
  }),
});

// Export hooks
export const {
  useGetPostsQuery,
  useGetPostQuery,
  useSearchPostsQuery,
  useGetCommentsQuery,
  useCreatePostMutation,
  useUpdatePostMutation,
  useDeletePostMutation,
  useAddCommentMutation,
  useLikePostMutation,
  
  // Lazy query hooks
  useLazyGetPostQuery,
  useLazySearchPostsQuery,
} = blogApi;


// ============================================
// COMPONENT EXAMPLES
// ============================================

import React, { useState } from 'react';

// Example 1: Posts List
export const PostsList = () => {
  const [page, setPage] = useState(1);
  
  const {
    data: posts,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useGetPostsQuery({ page, limit: 10 });
  
  const [deletePost] = useDeletePostMutation();
  
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  
  return (
    <div>
      <button onClick={refetch}>Refresh</button>
      
      {isFetching && <div>Updating...</div>}
      
      {posts?.map((post) => (
        <div key={post.id}>
          <h3>{post.title}</h3>
          <p>{post.content}</p>
          <button onClick={() => deletePost(post.id)}>Delete</button>
        </div>
      ))}
      
      <button onClick={() => setPage(p => p - 1)} disabled={page === 1}>
        Previous
      </button>
      <button onClick={() => setPage(p => p + 1)}>
        Next
      </button>
    </div>
  );
};

// Example 2: Create Post Form
export const CreatePostForm = () => {
  const [createPost, { isLoading, isSuccess, error }] = useCreatePostMutation();
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    try {
      const result = await createPost({
        title: formData.get('title'),
        content: formData.get('content'),
      }).unwrap();
      
      console.log('Post created:', result);
      e.target.reset();
    } catch (err) {
      console.error('Failed to create post:', err);
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <input name="title" placeholder="Title" required />
      <textarea name="content" placeholder="Content" required />
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Creating...' : 'Create Post'}
      </button>
      {isSuccess && <p>Post created successfully!</p>}
      {error && <p>Error: {error.data?.message}</p>}
    </form>
  );
};

// Example 3: Post Detail with Comments
export const PostDetail = ({ postId }) => {
  const { data: post, isLoading: postLoading } = useGetPostQuery(postId);
  const { data: comments, isLoading: commentsLoading } = useGetCommentsQuery(postId);
  const [addComment, { isLoading: addingComment }] = useAddCommentMutation();
  const [likePost] = useLikePostMutation();
  
  if (postLoading) return <div>Loading post...</div>;
  
  return (
    <div>
      <h1>{post.title}</h1>
      <p>{post.content}</p>
      <button onClick={() => likePost(postId)}>
        👍 {post.likes} {post.isLiked ? '(Liked)' : ''}
      </button>
      
      <h2>Comments</h2>
      {commentsLoading ? (
        <div>Loading comments...</div>
      ) : (
        comments?.map((comment) => (
          <div key={comment.id}>
            <p>{comment.text}</p>
            <small>By {comment.author}</small>
          </div>
        ))
      )}
      
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const text = e.target.elements.comment.value;
          await addComment({ postId, text }).unwrap();
          e.target.reset();
        }}
      >
        <input name="comment" placeholder="Add comment..." />
        <button type="submit" disabled={addingComment}>
          Post Comment
        </button>
      </form>
    </div>
  );
};

// Example 4: Search with Lazy Query
export const SearchPosts = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [trigger, { data, isLoading, isFetching }] = useLazySearchPostsQuery();
  
  const handleSearch = () => {
    if (searchTerm.trim()) {
      trigger(searchTerm);
    }
  };
  
  return (
    <div>
      <input
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Search posts..."
      />
      <button onClick={handleSearch} disabled={isLoading}>
        Search
      </button>
      
      {isFetching && <div>Searching...</div>}
      
      {data?.map((post) => (
        <div key={post.id}>
          <h3>{post.title}</h3>
        </div>
      ))}
    </div>
  );
};

// Example 5: Conditional Query (Skip)
export const UserProfile = ({ userId }) => {
  const [showPosts, setShowPosts] = useState(false);
  
  // Only fetch when showPosts is true
  const { data: posts } = useGetPostsQuery(
    { userId },
    { skip: !showPosts || !userId }
  );
  
  return (
    <div>
      <button onClick={() => setShowPosts(!showPosts)}>
        {showPosts ? 'Hide' : 'Show'} Posts
      </button>
      
      {showPosts && posts?.map((post) => (
        <div key={post.id}>{post.title}</div>
      ))}
    </div>
  );
};

// Example 6: Polling (Auto-refresh)
export const LivePosts = () => {
  const { data: posts } = useGetPostsQuery(undefined, {
    pollingInterval: 5000,  // Refetch every 5 seconds
  });
  
  return (
    <div>
      <h2>Live Posts (auto-refreshing)</h2>
      {posts?.map((post) => (
        <div key={post.id}>{post.title}</div>
      ))}
    </div>
  );
};