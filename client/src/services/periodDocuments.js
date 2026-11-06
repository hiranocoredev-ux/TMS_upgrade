import apiClient from './axios';
import { DOCUMENT_KIND, normalizeDocumentKind } from '../constants/documentKind';

function apiBase(kind) {
  return normalizeDocumentKind(kind) === DOCUMENT_KIND.PLAN ? '/plans' : '/reports';
}

export const getDocumentsByUser = (period, userId, kind = DOCUMENT_KIND.REPORT) =>
  apiClient.get(`${apiBase(kind)}/${period}/${userId}`);

export const getAllDocuments = (period, kind = DOCUMENT_KIND.REPORT) =>
  apiClient.get(`${apiBase(kind)}/${period}`);

export const getTeamDocuments = (period, groupID, kind = DOCUMENT_KIND.REPORT) =>
  apiClient.get(`${apiBase(kind)}/${period}/group/${groupID}`);

export const updateDocument = (period, userId, username, group, date, payload, kind = DOCUMENT_KIND.REPORT) =>
  apiClient.patch(`${apiBase(kind)}/${period}/${userId}/${username}/${group}/${date}`, payload);

export const deleteDocument = (period, id, kind = DOCUMENT_KIND.REPORT) =>
  apiClient.delete(`${apiBase(kind)}/${period}/${id}`);

/** Daily report history summary (work result context only). */
export const getDailyReportHistorySummary = (userId, date) =>
  apiClient.get('/reports/daily/history-summary', { params: { userId, date } });

/** @deprecated Use getDocumentsByUser */
export const getReportsByUser = (period, userId) => getDocumentsByUser(period, userId, DOCUMENT_KIND.REPORT);
export const getAllReports = (period) => getAllDocuments(period, DOCUMENT_KIND.REPORT);
export const getTeamReports = (period, groupID) => getTeamDocuments(period, groupID, DOCUMENT_KIND.REPORT);
export const updateReport = (period, userId, username, group, date, payload) =>
  updateDocument(period, userId, username, group, date, payload, DOCUMENT_KIND.REPORT);
export const deleteReport = (period, id) => deleteDocument(period, id, DOCUMENT_KIND.REPORT);

export const getPlansByUser = (period, userId) => getDocumentsByUser(period, userId, DOCUMENT_KIND.PLAN);
export const getAllPlans = (period) => getAllDocuments(period, DOCUMENT_KIND.PLAN);
export const getTeamPlans = (period, groupID) => getTeamDocuments(period, groupID, DOCUMENT_KIND.PLAN);
export const updatePlan = (period, userId, username, group, date, payload) =>
  updateDocument(period, userId, username, group, date, payload, DOCUMENT_KIND.PLAN);
export const deletePlan = (period, id) => deleteDocument(period, id, DOCUMENT_KIND.PLAN);
