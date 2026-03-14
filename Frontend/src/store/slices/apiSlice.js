// slice to manage API interactions using RTK Query
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseURL: API_URL,
    credentials: 'include',
    prepareHeaders: (headers) => {
      const token = localStorage.getItem('accessToken');
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: ['Equipment', 'Team', 'Request'],
  endpoints: (builder) => ({
    // EQUIPMENT ENDPOINTS
    getEquipment: builder.query({
      query: (params) => ({
        url: '/equipment',
        params,
      }),
      providesTags: (result) =>
        result?.data
          ? [
              ...result.data.map(({ _id }) => ({ type: 'Equipment', id: _id })),
              { type: 'Equipment', id: 'LIST' },
            ]
          : [{ type: 'Equipment', id: 'LIST' }],
      transformResponse: (response) => response.data,
    }),
    
    getEquipmentById: builder.query({
      query: (id) => `/equipment/${id}`,
      providesTags: (result, error, id) => [{ type: 'Equipment', id }],
      transformResponse: (response) => response.data,
    }),
    
    createEquipment: builder.mutation({
      query: (data) => ({
        url: '/equipment',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: [{ type: 'Equipment', id: 'LIST' }],
      transformResponse: (response) => response.data,
    }),
    
    updateEquipment: builder.mutation({
      query: ({ id, ...data }) => ({
        url: `/equipment/${id}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'Equipment', id },
        { type: 'Equipment', id: 'LIST' },
      ],
      transformResponse: (response) => response.data,
    }),
    
    deleteEquipment: builder.mutation({
      query: (id) => ({
        url: `/equipment/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'Equipment', id: 'LIST' }],
    }),
    
    scrapEquipment: builder.mutation({
      query: (id) => ({
        url: `/equipment/${id}/scrap`,
        method: 'PATCH',
      }),
      invalidatesTags: (result, error, id) => [
        { type: 'Equipment', id },
        { type: 'Equipment', id: 'LIST' },
      ],
      transformResponse: (response) => response.data,
    }),

    // TEAM ENDPOINTS
    getTeams: builder.query({
      query: () => '/teams',
      providesTags: (result) =>
        result?.data
          ? [
              ...result.data.map(({ _id }) => ({ type: 'Team', id: _id })),
              { type: 'Team', id: 'LIST' },
            ]
          : [{ type: 'Team', id: 'LIST' }],
      transformResponse: (response) => response.data,
    }),
    
    getTeamById: builder.query({
      query: (id) => `/teams/${id}`,
      providesTags: (result, error, id) => [{ type: 'Team', id }],
      transformResponse: (response) => response.data,
    }),
    
    createTeam: builder.mutation({
      query: (data) => ({
        url: '/teams',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: [{ type: 'Team', id: 'LIST' }],
      transformResponse: (response) => response.data,
    }),
    
    updateTeam: builder.mutation({
      query: ({ id, ...data }) => ({
        url: `/teams/${id}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'Team', id },
        { type: 'Team', id: 'LIST' },
      ],
      transformResponse: (response) => response.data,
    }),
    
    deleteTeam: builder.mutation({
      query: (id) => ({
        url: `/teams/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'Team', id: 'LIST' }],
    }),
    
    addTechnicianToTeam: builder.mutation({
      query: ({ teamId, technicianId }) => ({
        url: `/teams/${teamId}/technicians`,
        method: 'POST',
        body: { technicianId },
      }),
      invalidatesTags: (result, error, { teamId }) => [
        { type: 'Team', id: teamId },
        { type: 'Team', id: 'LIST' },
      ],
      transformResponse: (response) => response.data,
    }),
    
    removeTechnicianFromTeam: builder.mutation({
      query: ({ teamId, technicianId }) => ({
        url: `/teams/${teamId}/technicians`,
        method: 'DELETE',
        body: { technicianId },
      }),
      invalidatesTags: (result, error, { teamId }) => [
        { type: 'Team', id: teamId },
        { type: 'Team', id: 'LIST' },
      ],
      transformResponse: (response) => response.data,
    }),

    // REQUEST ENDPOINTS
    getRequests: builder.query({
      query: (params) => ({
        url: '/requests',
        params,
      }),
      providesTags: (result) =>
        result?.data
          ? [
              ...result.data.map(({ _id }) => ({ type: 'Request', id: _id })),
              { type: 'Request', id: 'LIST' },
            ]
          : [{ type: 'Request', id: 'LIST' }],
      transformResponse: (response) => response.data,
    }),
    
    getRequestById: builder.query({
      query: (id) => `/requests/${id}`,
      providesTags: (result, error, id) => [{ type: 'Request', id }],
      transformResponse: (response) => response.data,
    }),
    
    getKanbanRequests: builder.query({
      query: () => '/requests/kanban',
      providesTags: [{ type: 'Request', id: 'KANBAN' }],
      transformResponse: (response) => response.data,
    }),
    
    createRequest: builder.mutation({
      query: (data) => ({
        url: '/requests',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: [
        { type: 'Request', id: 'LIST' },
        { type: 'Request', id: 'KANBAN' },
      ],
      transformResponse: (response) => response.data,
    }),
    
    updateRequest: builder.mutation({
      query: ({ id, ...data }) => ({
        url: `/requests/${id}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'Request', id },
        { type: 'Request', id: 'LIST' },
        { type: 'Request', id: 'KANBAN' },
      ],
      transformResponse: (response) => response.data,
    }),
    
    updateRequestStatus: builder.mutation({
      query: ({ id, status, duration }) => ({
        url: `/requests/${id}/status`,
        method: 'PATCH',
        body: { status, duration },
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'Request', id },
        { type: 'Request', id: 'LIST' },
        { type: 'Request', id: 'KANBAN' },
      ],
      transformResponse: (response) => response.data,
    }),
    
    deleteRequest: builder.mutation({
      query: (id) => ({
        url: `/requests/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: [
        { type: 'Request', id: 'LIST' },
        { type: 'Request', id: 'KANBAN' },
      ],
    }),
  }),
});

// Export hooks for usage in components
export const {
  // Equipment
  useGetEquipmentQuery,
  useGetEquipmentByIdQuery,
  useCreateEquipmentMutation,
  useUpdateEquipmentMutation,
  useDeleteEquipmentMutation,
  useScrapEquipmentMutation,
  
  // Teams
  useGetTeamsQuery,
  useGetTeamByIdQuery,
  useCreateTeamMutation,
  useUpdateTeamMutation,
  useDeleteTeamMutation,
  useAddTechnicianToTeamMutation,
  useRemoveTechnicianFromTeamMutation,
  
  // Requests
  useGetRequestsQuery,
  useGetRequestByIdQuery,
  useGetKanbanRequestsQuery,
  useCreateRequestMutation,
  useUpdateRequestMutation,
  useUpdateRequestStatusMutation,
  useDeleteRequestMutation,
} = apiSlice;