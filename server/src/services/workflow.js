import apiClient from './axios';

export const getWorkflowChartData = (params = {}) =>
  apiClient.get('/workflow/chart', { params });

export const getWorkflowUsers = () =>
  apiClient.get('/workflow/users');

export const addWorkflowTime = (payload) =>
  apiClient.post('/workflow/add-time', payload);

/** Super-admin: per-member manual-time breakdown for chart date range ([date_from, date_to)). */
export const getWorkflowManualTimeDetail = (params = {}) =>
  apiClient.get('/workflow/manual-time-detail', { params });

export const patchWorkflowManualAdjustment = (payload) =>
  apiClient.patch('/workflow/manual-time-entry', payload);

export const deleteWorkflowManualAdjustment = (payload) =>
  apiClient.delete('/workflow/manual-time-entry', { data: payload });

export const getWorktimeTargets = (month) =>
  apiClient.get('/workflow/targets', { params: { month } });

export const upsertWorktimeTarget = (payload) =>
  apiClient.put('/workflow/targets', payload);

export const deleteWorktimeTarget = (userId, month) =>
  apiClient.delete(`/workflow/targets/${userId}/${month}`);

export const createWorktimeTargetPreset = (payload) =>
  apiClient.post('/workflow/target-presets', payload);

export const updateWorktimeTargetPreset = (presetId, payload) =>
  apiClient.put(`/workflow/target-presets/${presetId}`, payload);

export const deleteWorktimeTargetPreset = (presetId) =>
  apiClient.delete(`/workflow/target-presets/${presetId}`);

export const getWorktimeHubstaffUsers = () =>
  apiClient.get('/workflow/hubstaff-users');

export const upsertWorktimeHubstaffId = (payload) =>
  apiClient.put('/workflow/hubstaff-users', payload);

export const getWorkflowFinalSyncStatus = (date) =>
  apiClient.get('/workflow/final-sync-status', { params: { date } });

export const triggerWorkflowFinalSync = (date) =>
  apiClient.post('/workflow/final-sync', { date });
