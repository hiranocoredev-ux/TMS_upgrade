import apiClient from './axios';

/**
 * Audit Logs API service
 */

export const fetchAuditLogs = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.page) params.append('page', filters.page);
  if (filters.limit) params.append('limit', filters.limit);
  if (filters.actor) params.append('actor', filters.actor);
  if (filters.action) params.append('action', filters.action);
  if (filters.entityType) params.append('entityType', filters.entityType);

  const response = await apiClient.get(`/audit-logs?${params.toString()}`);
  return response.data;
};

