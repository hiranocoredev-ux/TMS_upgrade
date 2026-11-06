import apiClient from './axios';

// ── Timer ──────────────────────────────────────────────────────────
export const startTimer = (description = '') =>
  apiClient.post('/time-entries/start', { description });

export const stopTimer = (description) =>
  apiClient.post('/time-entries/stop', description !== undefined ? { description } : {});

export const getRunningTimer = () =>
  apiClient.get('/time-entries/running');

// ── My entries ─────────────────────────────────────────────────────
export const getMyEntries = (params = {}) =>
  apiClient.get('/time-entries/my', { params });

export const createEntry = (payload) =>
  apiClient.post('/time-entries', payload);

export const updateEntry = (id, payload) =>
  apiClient.put(`/time-entries/${id}`, payload);

export const deleteEntry = (id) =>
  apiClient.delete(`/time-entries/${id}`);

export const clearAllMyTimeEntries = () =>
  apiClient.delete('/time-entries/my/all');

// ── Admin ──────────────────────────────────────────────────────────
export const getSummary = (params = {}) =>
  apiClient.get('/time-entries/summary', { params });

export const getUserEntries = (userId, params = {}) =>
  apiClient.get(`/time-entries/user/${userId}`, { params });
