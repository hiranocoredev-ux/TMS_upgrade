import apiClient from './axios';

/**
 * Interviews API service
 */

export const fetchInterviews = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.jobTicketId) params.append('jobTicketId', filters.jobTicketId);
  if (filters.page) params.append('page', filters.page);
  if (filters.limit) params.append('limit', filters.limit);
  else params.append('limit', '1000');

  const response = await apiClient.get(`/interviews?${params.toString()}`);
  return response.data;
};

export const getInterview = async (id) => {
  const response = await apiClient.get(`/interviews/${id}`);
  return response.data;
};

export const createInterview = async (interviewData) => {
  const response = await apiClient.post('/interviews', interviewData);
  return response.data;
};

export const updateInterview = async (id, interviewData) => {
  const response = await apiClient.put(`/interviews/${id}`, interviewData);
  return response.data;
};


