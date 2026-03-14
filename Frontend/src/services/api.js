import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// axios instance
const api = axios.create({
    baseURL: API_URL,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});

// add token to requests
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('accessToken');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// handle token refresh
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            
            try {
                const response = await axios.post(`${API_URL}/auth/refresh-token`, {}, {
                    withCredentials: true,
                });
                
                const { accessToken } = response.data.data;
                localStorage.setItem('accessToken', accessToken);
                originalRequest.headers.Authorization = `Bearer ${accessToken}`;
                
                return api(originalRequest);
            } catch (refreshError) {
                // Refresh token failed, clear auth and redirect
                localStorage.removeItem('accessToken');
                localStorage.removeItem('user');
                window.location.href = '/login';
                return Promise.reject(refreshError);
            }
        }
        
        return Promise.reject(error);
    }
);

// Auth API
export const authAPI = {
    login: (email, password) => api.post('/auth/login', { email, password }),
    signup: (data) => api.post('/auth/register', data),
    logout: () => api.post('/auth/logout'),
    refreshToken: () => api.post('/auth/refresh-token'),
};

// User API
export const userAPI = {
    getCurrentUser: () => api.get('/users/me'),
    updateProfile: (data) => api.patch('/users/update', data),
    changePassword: (data) => api.post('/users/change-password', data),
    getAllTechnicians: () => api.get('/users/technicians'),
    getAll: (params) => api.get('/users', { params }),
};

// Equipment API
export const equipmentAPI = {
    getAll: (params) => api.get('/equipment', { params }),
    getById: (id) => api.get(`/equipment/${id}`),
    create: (data) => api.post('/equipment', data),
    update: (id, data) => api.put(`/equipment/${id}`, data),
    delete: (id) => api.delete(`/equipment/${id}`),
    scrap: (id) => api.patch(`/equipment/${id}/scrap`),
    getRequests: (id) => api.get(`/equipment/${id}/requests`),
};

// Team API
export const teamAPI = {
    getAll: () => api.get('/teams'),
    getById: (id) => api.get(`/teams/${id}`),
    create: (data) => api.post('/teams', data),
    update: (id, data) => api.put(`/teams/${id}`, data),
    delete: (id) => api.delete(`/teams/${id}`),
    addTechnician: (teamId, technicianId) => 
        api.post(`/teams/${teamId}/technicians`, { technicianId }),
    removeTechnician: (teamId, technicianId) => 
        api.delete(`/teams/${teamId}/technicians`, { data: { technicianId } }),
};

// Request API
export const requestAPI = {
    getAll: (params) => api.get('/requests', { params }),
    getById: (id) => api.get(`/requests/${id}`),
    create: (data) => api.post('/requests', data),
    update: (id, data) => api.put(`/requests/${id}`, data),
    delete: (id) => api.delete(`/requests/${id}`),
    updateStatus: (id, status, duration) => 
        api.patch(`/requests/${id}/status`, { status, duration }),
    getKanban: () => api.get('/requests/kanban'),
    getPreventive: (params) => api.get('/requests/preventive', { params }),
};

export default api;