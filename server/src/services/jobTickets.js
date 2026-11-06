import apiClient from './axios';

/**
 * Fetch job tickets with filters and pagination
 */
export const fetchJobTickets = async (filters = {}) => {
  const params = new URLSearchParams();
  
  // Add filters to query string
  if (filters.member) params.append('member', filters.member);
  if (filters.profile) params.append('profile', filters.profile);
  if (filters.stage) params.append('stage', filters.stage);
  if (filters.status) params.append('status', filters.status);
  if (filters.platform) params.append('platform', filters.platform);
  if (filters.tags && filters.tags.length > 0) {
    filters.tags.forEach(tag => params.append('tags', tag));
  }
  if (filters.search) params.append('search', filters.search);
  if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.append('dateTo', filters.dateTo);
  if (filters.page) params.append('page', filters.page);
  if (filters.limit) params.append('limit', filters.limit);

  const response = await apiClient.get(`/job-tickets?${params.toString()}`);
  return response.data;
};

/**
 * Fetch a single job ticket by ID
 */
export const fetchJobTicket = async (id) => {
  const response = await apiClient.get(`/job-tickets/${id}`);
  return response.data;
};

/**
 * Move a job ticket to a different stage
 */
export const moveTicketStage = async (id, toStage, reason = '') => {
  const response = await apiClient.post(`/job-tickets/${id}/move-stage`, {
    toStage,
    reason
  });
  return response.data;
};

/**
 * Create a job ticket
 */
export const createJobTicket = async (ticketData) => {
  const response = await apiClient.post('/job-tickets', ticketData);
  return response.data;
};

/**
 * Update a job ticket
 */
export const updateJobTicket = async (id, data) => {
  const response = await apiClient.put(`/job-tickets/${id}`, data);
  return response.data;
};

/**
 * Fetch interviews for a job ticket
 */
export const fetchTicketInterviews = async (ticketId) => {
  const response = await apiClient.get(`/interviews`, {
    params: { jobTicketId: ticketId, limit: 100 }
  });
  return response.data;
};

