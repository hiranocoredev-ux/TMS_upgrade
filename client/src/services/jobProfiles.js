import apiClient from './axios';

/**
 * Job Profiles API service
 */

export const fetchJobProfiles = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.search) params.append('search', filters.search);
  if (filters.status) params.append('status', filters.status);
  if (filters.owner) params.append('owner', filters.owner);
  if (filters.group) params.append('group', filters.group);
  if (filters.page) params.append('page', filters.page);
  if (filters.limit) params.append('limit', filters.limit);
  else params.append('limit', '1000');

  const response = await apiClient.get(`/job-profiles?${params.toString()}`);
  return response.data;
};

export const getJobProfile = async (id) => {
  const response = await apiClient.get(`/job-profiles/${id}`);
  return response.data;
};

export const createJobProfile = async (profileData) => {
  const response = await apiClient.post('/job-profiles', profileData);
  return response.data;
};

export const updateJobProfile = async (id, profileData) => {
  const response = await apiClient.put(`/job-profiles/${id}`, profileData);
  return response.data;
};

export const deleteJobProfile = async (id) => {
  const response = await apiClient.delete(`/job-profiles/${id}`);
  return response.data;
};

/**
 * Upload profile picture
 * @param {string} profileId - Profile ID
 * @param {File} pictureFile - Image file (JPG, PNG)
 */
export const uploadProfilePicture = async (profileId, pictureFile) => {
  const formData = new FormData();
  formData.append('picture', pictureFile);
  
  const response = await apiClient.patch(`/job-profiles/${profileId}/picture`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data;
};

/**
 * Upload single attachment (legacy - kept for backward compatibility)
 * @param {string} profileId - Profile ID
 * @param {File} file - File (PDF, DOCX, JPG, PNG)
 */
export const uploadAttachment = async (profileId, file) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await apiClient.patch(`/job-profiles/${profileId}/attachments`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data;
};

/**
 * Upload multiple attachments
 * @param {string} profileId - Profile ID
 * @param {File[]} files - Array of files (PDF, DOCX, JPG, PNG)
 */
export const uploadAttachments = async (profileId, files) => {
  const formData = new FormData();
  files.forEach(file => {
    formData.append('files', file);
  });
  
  const response = await apiClient.patch(`/job-profiles/${profileId}/attachments/multiple`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data;
};

/**
 * Delete attachment
 * @param {string} profileId - Profile ID
 * @param {string} fileId - File ID
 */
export const deleteAttachment = async (profileId, fileId) => {
  const response = await apiClient.delete(`/job-profiles/${profileId}/attachments/${fileId}`);
  console.log("==========response==========", response.data);
  return response.data;
};
