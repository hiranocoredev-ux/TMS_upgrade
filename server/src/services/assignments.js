// services/assignments.js
import apiClient from './axios';

/**
 * ===============================
 * Assignments API
 * ===============================
 *
 * Backend:
 * GET    /assignments
 * GET    /assignments/:id
 * POST   /assignments
 * PUT    /assignments/:id
 * DELETE /assignments/:id
 */

/**
 * Fetch assignments
 * - Members → own assignments
 * - Admin/Boss → all assignments
 */
// export const fetchAssignments = async () => {
//   const response = await apiClient.get('/assignments');
//   return response.data;
// };
export const fetchAssignments = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.search) params.append('search', filters.search);
  if (filters.status) params.append('status', filters.status);
  if (filters.group) params.append('group', filters.group);
  if (filters.from) params.append('from', filters.from);
  if (filters.to) params.append('to', filters.to);

  // Admin-only (safe even if sent by member  backend ignores)
  if (filters.currency) params.append('currency', filters.currency);
  if (filters.payMethod) params.append('payMethod', filters.payMethod);
  if (filters.user) params.append('user', filters.user);
  if (filters.page) params.append('page', filters.page);
  if (filters.limit) params.append('limit', filters.limit);
  const response = await apiClient.get(`/assignments?${params.toString()}`);
  return response.data;
}
/**
 * Get single assignment
 */
export const getAssignment = async (id) => {
  const response = await apiClient.get(`/assignments/${id}`);
  return response.data;
};

/**
 * Create assignment
 */
export const createAssignment = async (data) => {
  const response = await apiClient.post('/assignments', data);
  return response.data;
};

/**
 * Update assignment (owner only)
 */
export const updateAssignment = async (id, data) => {
  const response = await apiClient.put(`/assignments/${id}`, data);
  return response.data;
};

/**
 * Delete assignment (owner only)
 */
export const deleteAssignment = async (id) => {
  const response = await apiClient.delete(`/assignments/${id}`);
  return response.data;
};

/**
 * ===============================
 * Earnings & Analytics
 * ===============================
 */

/**
 * Earnings summary
 * Params:
 * - from (ISO date)
 * - to (ISO date)
 */
export const fetchEarningsSummary = async ({ from, to } = {}) => {
  const params = {};
  if (from) params.from = from;
  if (to) params.to = to;

  const response = await apiClient.get(
    '/assignments/earnings/summary',
    { params }
  );
  return response.data;
};

/**
 * Earnings trend (chart-ready)
 * Params:
 * - from
 * - to
 * - groupBy: day | month | year
 */
export const fetchEarningsTrend = async ({
  from,
  to,
  groupBy = 'month'
} = {}) => {
  const params = { groupBy };
  if (from) params.from = from;
  if (to) params.to = to;

  const response = await apiClient.get(
    '/assignments/earnings/trend',
    { params }
  );
  return response.data;
};
