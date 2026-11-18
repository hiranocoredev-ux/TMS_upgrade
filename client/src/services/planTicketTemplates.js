import apiClient from './axios';

/** audience: 'member' (team plans, the default) or 'admin' (admins' own plans). */
export const getPlanTicketTemplates = (period, audience = 'member') =>
  apiClient.get('/plan-ticket-templates', { params: { period, audience } });

export const getPlanTicketTemplatesAdmin = (period, audience = 'member') =>
  apiClient.get('/plan-ticket-templates/admin', { params: { period, audience } });

export const createPlanTicketTemplate = (payload) =>
  apiClient.post('/plan-ticket-templates', payload);

export const updatePlanTicketTemplate = (id, payload) =>
  apiClient.put(`/plan-ticket-templates/${id}`, payload);

export const deletePlanTicketTemplate = (id) =>
  apiClient.delete(`/plan-ticket-templates/${id}`);
