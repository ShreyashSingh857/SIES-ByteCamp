// slice to manage API interactions using RTK Query
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const API_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: API_URL,
    credentials: 'include',
    prepareHeaders: (headers) => {
      const token = localStorage.getItem('accessToken');
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: ['Graph'],
  endpoints: (builder) => ({
    // REPO SCAN ENDPOINT
    scanRepo: builder.mutation({
      query: (data) => ({
        url: '/scan',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Graph'],
      transformResponse: (response) => response.data,
    }),
    
    // GRAPH ENDPOINT
    getGraph: builder.query({
      query: () => '/graph',
      providesTags: ['Graph'],
      transformResponse: (response) => response.data,
    }),
  }),
});

// Export hooks for usage in components
export const {
  useScanRepoMutation,
  useGetGraphQuery,
} = apiSlice;