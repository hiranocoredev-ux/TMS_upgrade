import apiClient from './axios';

export const getReportsByUser = (period, userId) => apiClient.get(`/reports/${period}/${userId}`);
export const getAllReports = (period) => apiClient.get(`/reports/${period}`);
export const getTeamReports = (period, groupID) => apiClient.get(`/reports/${period}/group/${groupID}`);
export const updateReport = (period, userId, username, group, date, updatedPost) =>
  apiClient.patch(`/reports/${period}/${userId}/${username}/${group}/${date}`, updatedPost);
export const deleteReport = (period, id) => apiClient.delete(`/reports/${period}/${id}`);

/** Daily report history: time, month profit, and day transactions for a member. */
export const getDailyReportHistorySummary = (userId, date) =>
  apiClient.get('/reports/daily/history-summary', { params: { userId, date } });
