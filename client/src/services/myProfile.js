import apiClient from './axios';

export const fetchMyProfile = async () => {
  const response = await apiClient.get('/me');
  return response.data;
};

export const updateMyPassword = async (payload) => {
  const response = await apiClient.put('/me/password', payload);
  return response.data;
};

export const uploadMyAvatar = async (file) => {
  const formData = new FormData();
  formData.append('avatar', file);
  const response = await apiClient.post('/me/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
};

export const updateMyNotificationSettings = async (payload) => {
  const response = await apiClient.put('/me/notifications', payload);
  return response.data;
};

export const sendMyNotificationTest = async (channel, config = null) => {
  const response = await apiClient.post('/me/notifications/test', { channel, config: config || undefined });
  return response.data;
};
