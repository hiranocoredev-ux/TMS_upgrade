import apiClient from './axios';

/**
 * Projects API service
 */

export const fetchProjects = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.status) params.append('status', filters.status);
  if (filters.owner) params.append('owner', filters.owner);
  if (filters.search) params.append('search', filters.search);
  if (filters.page) params.append('page', filters.page);
  if (filters.limit) params.append('limit', filters.limit);
  else params.append('limit', '1000');

  const response = await apiClient.get(`/projects?${params.toString()}`);
  return response.data;
};

export const getProject = async (id) => {
  const response = await apiClient.get(`/projects/${id}`);
  return response.data;
};

export const createProject = async (projectData) => {
  const response = await apiClient.post('/projects', projectData);
  return response.data;
};

export const updateProject = async (id, projectData) => {
  const response = await apiClient.put(`/projects/${id}`, projectData);
  return response.data;
};

export const deleteProject = async (id) => {
  const response = await apiClient.delete(`/projects/${id}`);
  return response.data;
};

/**
 * Tasks API service
 */

export const fetchTasks = async (projectId, filters = {}) => {
  const params = new URLSearchParams();
  if (filters.status) params.append('status', filters.status);
  if (filters.priority) params.append('priority', filters.priority);
  if (filters.page) params.append('page', filters.page);
  if (filters.limit) params.append('limit', filters.limit);
  else params.append('limit', '1000');

  const response = await apiClient.get(`/projects/${projectId}/tasks?${params.toString()}`);
  return response.data;
};

export const getTask = async (projectId, taskId) => {
  const response = await apiClient.get(`/projects/${projectId}/tasks/${taskId}`);
  return response.data;
};

export const createTask = async (projectId, taskData) => {
  const response = await apiClient.post(`/projects/${projectId}/tasks`, taskData);
  return response.data;
};

export const updateTask = async (projectId, taskId, taskData) => {
  const response = await apiClient.put(`/projects/${projectId}/tasks/${taskId}`, taskData);
  return response.data;
};

export const deleteTask = async (projectId, taskId) => {
  const response = await apiClient.delete(`/projects/${projectId}/tasks/${taskId}`);
  return response.data;
};

