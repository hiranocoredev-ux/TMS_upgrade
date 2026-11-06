import axios from 'axios';
import { useToast } from 'vue-toastification';

const toast = useToast();

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor - attach token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle errors and token refresh
apiClient.interceptors.response.use(
  (response) => {
    // Show success toast for POST, PUT, DELETE, PATCH operations
    const method = response.config?.method?.toUpperCase();
    const shouldShowSuccessToast = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);
    
    if (shouldShowSuccessToast && response.data) {
      // Check if response has ok field and message
      if (response.data.ok && response.data.message) {
        toast.success(response.data.message);
      } else if (response.data.ok && !response.data.message) {
        // Show generic success message if no specific message
        const actionMap = {
          POST: 'created',
          PUT: 'updated',
          PATCH: 'updated',
          DELETE: 'deleted'
        };
        toast.success(`Successfully ${actionMap[method]}!`);
      }
    }
    
    // Return response data directly if it has the ok field structure
    if (response.data && typeof response.data === 'object' && 'ok' in response.data) {
      return response;
    }
    return response;
  },
  (error) => {
    // Handle 401 Unauthorized
    if (error.response?.status === 401) {
      toast.error('Session expired. Please login again.');
      import('../store/index.js').then((m) => {
        m.default.dispatch('auth/logout');
      });
      return Promise.reject(error);
    }

    // Handle other errors with toast notifications
    const errorMessage = error.response?.data?.message || 
                        error.response?.data?.error?.message ||
                        error.message || 
                        'An error occurred. Please try again.';
    
    // Don't show toast for network errors (they're handled differently)
    if (error.response) {
      toast.error(errorMessage);
    } else if (error.request) {
      toast.error('Network error. Please check your connection.');
    } else {
      toast.error(errorMessage);
    }

    return Promise.reject(error);
  }
);

export default apiClient;

