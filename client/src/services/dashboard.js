import apiClient from './axios';

export const getDashboard = (params = {}) =>
  apiClient.get('/dashboard', { params });
