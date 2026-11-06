import apiClient from './axios';

export const getNotificationSettings = async () => {
  const response = await apiClient.get('/notifications/settings');
  return response.data;
};

export const updateNotificationSettingsAdmin = async (payload) => {
  const response = await apiClient.put('/notifications/settings', payload);
  return response.data;
};

export const runNotificationChecksNow = async () => {
  const response = await apiClient.post('/notifications/run-now');
  return response.data;
};

export const testUserConnectionByAdmin = async (userId) => {
  const response = await apiClient.post('/notifications/test-user', { userId });
  return response.data;
};

export const sendManualNotification = async (payload) => {
  const response = await apiClient.post('/notifications/manual', payload);
  return response.data;
};

export const getMessageTargets = async () => {
  const response = await apiClient.get('/messages/targets');
  return response.data;
};

export const getNotificationLogs = async (limit = 100) => {
  const response = await apiClient.get('/notifications/logs', { params: { limit } });
  return response.data;
};

