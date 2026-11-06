import apiClient from './axios';

/**
 * Admin user management API service
 */

/**
 * Fetch all groups (for dropdowns, filters)
 */
export const fetchGroups = async () => {
  const response = await apiClient.get('/admin/groups');
  return response.data;
};

/**
 * Create a new group (super admin only)
 */
export const createGroup = async (groupData) => {
  const response = await apiClient.post('/admin/groups', groupData);
  return response.data;
};

/**
 * Update a group (super admin only)
 */
export const updateGroup = async (groupId, groupData) => {
  const response = await apiClient.put(`/admin/groups/${groupId}`, groupData);
  return response.data;
};

/**
 * Delete a group (super admin only)
 */
export const deleteGroup = async (groupId) => {
  const response = await apiClient.delete(`/admin/groups/${groupId}`);
  return response.data;
};

/**
 * Fetch all users with filters
 */
export const fetchUsers = async (params = {}) => {
  const response = await apiClient.get('/admin/users', { params });
  return response.data;
};

/**
 * Create a new user
 */
export const createUser = async (userData) => {
  const response = await apiClient.post('/admin/users', userData);
  return response.data;
};

/**
 * Update a user
 */
export const updateUser = async (userId, userData) => {
  const response = await apiClient.put(`/admin/users/${userId}`, userData);
  return response.data;
};

/**
 * Reset user password
 */
export const resetUserPassword = async (userId) => {
  const response = await apiClient.post(`/admin/users/${userId}/reset-password`);
  return response.data;
};

/**
 * Delete a user
 */
export const deleteUser = async (userId) => {
  const response = await apiClient.delete(`/admin/users/${userId}`);
  return response.data;
};

