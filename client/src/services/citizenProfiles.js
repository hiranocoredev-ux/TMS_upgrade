import apiClient from './axios';

/**
 * Citizen profiles — the clients a team member works under, with the platform
 * accounts each profile holds.
 */

/** @param {{ ownerUserId?: string, group?: string, status?: string, search?: string }} [filters] */
export const listCitizenProfiles = async (filters = {}) => {
  const response = await apiClient.get('/citizen-profiles', { params: filters });
  return response.data;
};

export const getCitizenProfile = async (id) => {
  const response = await apiClient.get(`/citizen-profiles/${id}`);
  return response.data;
};

export const createCitizenProfile = async (payload) => {
  const response = await apiClient.post('/citizen-profiles', payload);
  return response.data;
};

export const updateCitizenProfile = async (id, payload) => {
  const response = await apiClient.put(`/citizen-profiles/${id}`, payload);
  return response.data;
};

/** Saves one account panel: state, manager, comment and screenshots. */
export const updateCitizenAccount = async (id, platform, payload) => {
  const response = await apiClient.put(`/citizen-profiles/${id}/accounts/${platform}`, payload);
  return response.data;
};

export const deleteCitizenProfile = async (id) => {
  const response = await apiClient.delete(`/citizen-profiles/${id}`);
  return response.data;
};

/**
 * Uploads a photo or screenshot and returns its file id, which is what the
 * profile and its accounts store.
 */
export const uploadCitizenImage = async (file) => {
  const body = new FormData();
  body.append('file', file);
  const response = await apiClient.post('/files/upload?module=citizen_profiles', body, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data?.data?.fileMeta || null;
};

/** Where an uploaded image is served from. */
export const citizenImageUrl = (fileId) => {
  const id = fileId?._id || fileId;
  return id ? `/api/files/${id}/download` : '';
};
