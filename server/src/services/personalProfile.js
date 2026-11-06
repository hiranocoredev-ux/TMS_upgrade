import apiClient from './axios';

/**
 * Personal Profile API service
 */

export const getPersonalProfile = async (userId = null) => {
  const params = userId ? new URLSearchParams({ userId }) : '';
  const response = await apiClient.get(`/personal-profile?${params}`);
  return response.data;
};

export const createPersonalProfile = async (profileData) => {
  const response = await apiClient.post('/personal-profile', profileData);
  return response.data;
};

export const updatePersonalProfile = async (profileData, userId = null) => {
  const params = userId ? new URLSearchParams({ userId }) : '';
  const response = await apiClient.put(`/personal-profile?${params}`, profileData);
  return response.data;
};

/**
 * Upload multiple attachments
 */
export const uploadAttachments = async (files) => {
  const formData = new FormData();
  files.forEach(file => {
    formData.append('files', file);
  });
  
  const response = await apiClient.post('/personal-profile/attachments', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data;
};

/**
 * Delete attachment
 */
export const deleteAttachment = async (fileId) => {
  const response = await apiClient.delete(`/personal-profile/attachments/${fileId}`);
  return response.data;
};
