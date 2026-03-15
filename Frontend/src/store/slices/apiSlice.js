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
    // POST /api/scan — Clone a repo and parse it. Returns { data: { repoId, graphApi, parserSummary, ... } }
    scanRepo: builder.mutation({
      query: (data) => ({
        url: '/scan',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Graph'],
      transformResponse: (response) => response.data,
    }),

    // GET /api/graph/:repoId — Get graph for a specific repoId
    getGraph: builder.query({
      query: (repoId) => `/graph/${repoId}`,
      providesTags: ['Graph'],
      transformResponse: (response) => response.data,
    }),

    // DELETE /api/graph/:repoId — Delete stored graph for a repo
    deleteGraph: builder.mutation({
      query: (repoId) => ({
        url: `/graph/${repoId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Graph'],
    }),

    // POST /api/db/seed/schema — Creates Neo4j constraints & indexes
    seedSchema: builder.mutation({
      query: () => ({
        url: '/db/seed/schema',
        method: 'POST',
      }),
    }),

    // POST /api/db/seed/graph/:repoId — Seeds the stored parser output into Neo4j. Returns { data: { repoId, scanId, fileCount, ... } }
    seedGraph: builder.mutation({
      query: ({ repoId, scanId, repoUrl }) => ({
        url: `/db/seed/graph/${repoId}`,
        method: 'POST',
        body: { scanId, repoUrl },
      }),
      transformResponse: (response) => response.data,
    }),

    // GET /api/metrics/:scanId — Returns totalServices + totalDependencies from Neo4j
    getMetrics: builder.query({
      query: (scanId) => `/metrics/${scanId}`,
      transformResponse: (response) => response.data,
    }),

    // GET /api/impact/files?scanId={scanId}&filePath={filePath} — live related files from Neo4j
    getFileRelations: builder.query({
      query: ({ scanId, filePath }) =>
        `/impact/files?scanId=${encodeURIComponent(scanId)}&filePath=${encodeURIComponent(filePath)}`,
      transformResponse: (response) => response.data,
    }),

    // GET /api/editor/file?repoId=...&filePath=... — read local editable file content
    getEditableFile: builder.query({
      query: ({ repoId, filePath }) =>
        `/editor/file?repoId=${encodeURIComponent(repoId)}&filePath=${encodeURIComponent(filePath)}`,
      transformResponse: (response) => response.data,
    }),

    // POST /api/editor/impact-preview — preview impact for unsaved editor changes
    previewEditorImpact: builder.mutation({
      query: (body) => ({
        url: '/editor/impact-preview',
        method: 'POST',
        body,
      }),
      transformResponse: (response) => response.data,
    }),

    // POST /api/editor/file/save — save file after impact acknowledgement
    saveEditedFile: builder.mutation({
      query: (body) => ({
        url: '/editor/file/save',
        method: 'POST',
        body,
      }),
      transformResponse: (response) => response.data,
      invalidatesTags: ['Graph'],
    }),

    // GET /api/health — Liveness check
    getHealth: builder.query({
      query: () => '/health',
    }),

    // GET /api/help — All help topics
    getHelpTopics: builder.query({
      query: () => '/help',
      transformResponse: (response) => response.data,
    }),

    // GET /api/help/search?q={keyword} — Search help topics
    searchHelp: builder.query({
      query: (keyword) => `/help/search?q=${encodeURIComponent(keyword)}`,
      transformResponse: (response) => response.data,
    }),

    // GET /api/help/:id — Single help topic
    getHelpTopicById: builder.query({
      query: (id) => `/help/${id}`,
      transformResponse: (response) => response.data,
    }),
  }),
});

export const {
  useScanRepoMutation,
  useGetGraphQuery,
  useDeleteGraphMutation,
  useSeedSchemaMutation,
  useSeedGraphMutation,
  useGetMetricsQuery,
  useGetFileRelationsQuery,
  useGetEditableFileQuery,
  usePreviewEditorImpactMutation,
  useSaveEditedFileMutation,
  useGetHealthQuery,
  useGetHelpTopicsQuery,
  useSearchHelpQuery,
  useGetHelpTopicByIdQuery,
} = apiSlice;