import apiClient from './axios';

export const getCompetitionSettings = () => apiClient.get('/competition/settings');
export const putCompetitionSettings = (payload) => apiClient.put('/competition/settings', payload);

export const getRuleDefinitions = () => apiClient.get('/competition/rule-definitions');
export const createRuleDefinition = (payload) => apiClient.post('/competition/rule-definitions', payload);
export const updateRuleDefinition = (id, payload) => apiClient.patch(`/competition/rule-definitions/${id}`, payload);
export const deleteRuleDefinition = (id) => apiClient.delete(`/competition/rule-definitions/${id}`);

export const listCompetitionAdjustments = (params = {}) =>
  apiClient.get('/competition/adjustments', { params });
export const createCompetitionAdjustment = (payload) => apiClient.post('/competition/adjustments', payload);
export const updateCompetitionAdjustment = (id, payload) =>
  apiClient.patch(`/competition/adjustments/${id}`, payload);
export const deleteCompetitionAdjustment = (id) => apiClient.delete(`/competition/adjustments/${id}`);

export const getCompetitionDashboard = (params = {}) => apiClient.get('/competition/dashboard', { params });

export const getCompetitionUserDetail = (params) => apiClient.get('/competition/detail/user', { params });
export const getCompetitionGroupDetail = (params) => apiClient.get('/competition/detail/group', { params });

export const getCompetitionHistorySummary = (params = {}) =>
  apiClient.get('/competition/history/summary', { params });

export const getCompetitionHistoryDetail = (params = {}) =>
  apiClient.get('/competition/history/detail', { params });

export const getCompetitionWorktimeRules = (params = {}) =>
  apiClient.get('/competition/worktime-rules', { params });
export const upsertCompetitionWorktimeDayRule = (payload) =>
  apiClient.put('/competition/worktime-rules/day', payload);
export const deleteCompetitionWorktimeDayRule = (month, date) =>
  apiClient.delete(`/competition/worktime-rules/day/${month}/${date}`);
export const upsertCompetitionWorktimeUserDayRule = (payload) =>
  apiClient.put('/competition/worktime-rules/user-day', payload);
export const deleteCompetitionWorktimeUserDayRule = (month, date, userId) =>
  apiClient.delete(`/competition/worktime-rules/user-day/${month}/${date}/${userId}`);
