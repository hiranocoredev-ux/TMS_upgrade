import apiClient from './axios';

/**
 * Fetch all active Hubstaff organization members.
 * @returns {Promise<{ members: HubstaffMember[] }>}
 */
export const fetchHubstaffMembers = () =>
  apiClient.get('/hubstaff/members');

/**
 * Fetch raw activity records (keyboard, mouse, overall) per day per user.
 * @param {{ date_from: string, date_to: string, user_ids?: string }} params
 */
export const fetchHubstaffActivities = (params) =>
  apiClient.get('/hubstaff/activities', { params });

/**
 * Fetch raw time entries (start/end timestamps) per user.
 * @param {{ date_from: string, date_to: string, user_ids?: string }} params
 */
export const fetchHubstaffTimeEntries = (params) =>
  apiClient.get('/hubstaff/time-entries', { params });

/**
 * Fetch aggregated per-member summary for a date range.
 * @param {{ date_from: string, date_to: string, user_ids?: string }} params
 * @returns {Promise<{ summary: HubstaffUserSummary[], date_from: string, date_to: string }>}
 */
export const fetchHubstaffSummary = (params) =>
  apiClient.get('/hubstaff/summary', { params });
