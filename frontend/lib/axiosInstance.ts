import axios from 'axios';
import { useUserStore } from '@/store/user';

const api = axios.create({
  baseURL: (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000').replace(
    /\/$/,
    ''
  ),
  withCredentials: true,
});

// Updated request interceptor
api.interceptors.request.use(
  (config) => {
    const token = useUserStore.getState().user?.token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Enhanced response interceptor
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      // Clear user store on unauthorized access
      useUserStore.getState().logout();

      // Redirect to login if in browser environment
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default api;