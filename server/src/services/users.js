import apiClient from './axios';

/**
 * Fetch users (for filters). Pass `group` to restrict to a team.
 */
export const fetchUsers = async ({ limit = 1000, group = '' } = {}) => {
  const params = { limit };
  if (group) params.group = group;

  const response = await apiClient.get('/admin/users', {
    params
  });

  return response.data;
};