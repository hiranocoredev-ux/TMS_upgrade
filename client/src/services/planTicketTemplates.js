import apiClient from './axios';

export const getPlanTicketTemplates = (period) =>
  apiClient.get('/plan-ticket-templates', { params: { period } });

export const getPlanTicketTemplatesAdmin = (period) =>
  apiClient.get('/plan-ticket-templates/admin', { params: { period } });

export const createPlanTicketTemplate = (payload) =>
  apiClient.post('/plan-ticket-templates', payload);

export const updatePlanTicketTemplate = (id, payload) =>
  apiClient.put(`/plan-ticket-templates/${id}`, payload);

export const deletePlanTicketTemplate = (id) =>
  apiClient.delete(`/plan-ticket-templates/${id}`);
