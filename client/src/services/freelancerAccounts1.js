import apiClient from './axios';

/**
 * Freelancer Accounts API service
 */

export const fetchFreelancerAccounts = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.search) params.append('search', filters.search);
  if (filters.platform) params.append('platform', filters.platform);
  if (filters.owner) params.append('owner', filters.owner);
  if (filters.page) params.append('page', filters.page);
  if (filters.limit) params.append('limit', filters.limit);
  else params.append('limit', '1000');

  const response = await apiClient.get(`/freelancer-profiles?${params.toString()}`);
  return response.data;
};

export const getFreelancerAccount = async (id) => {
  const response = await apiClient.get(`/freelancer-profiles/${id}`);
  return response.data;
};

export const createFreelancerAccount = async (accountData) => {
  const response = await apiClient.post('/freelancer-profiles', accountData);
  return response.data;
};

export const updateFreelancerAccount = async (id, accountData) => {
  const response = await apiClient.put(`/freelancer-profiles/${id}`, accountData);
  return response.data;
};

export const deleteFreelancerAccount = async (id) => {
  const response = await apiClient.delete(`/freelancer-profiles/${id}`);
  return response.data;
};

/**
 * Reveal password (Admin only)
 */
export const revealPassword = async (id) => {
  const response = await apiClient.post(`/freelancer-profiles/${id}/reveal-password`);
  return response.data;
};

/**
 * Upload multiple attachments
 */
export const uploadAttachments = async (accountId, files) => {
  const formData = new FormData();
  files.forEach(file => {
    formData.append('files', file);
  });
  
  const response = await apiClient.post(`/freelancer-profiles/${accountId}/attachments`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data;
};

/**
 * Delete attachment
 */
export const deleteAttachment = async (accountId, fileId) => {
  const response = await apiClient.delete(`/freelancer-profiles/${accountId}/attachments/${fileId}`);
  return response.data;
};
