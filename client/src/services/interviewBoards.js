import apiClient from './axios';

/**
 * Interview Board Service
 * PRD v3.0: Interview Routine System - Kanban boards
 */

export const fetchInterviewBoards = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.status) params.append('status', filters.status);
  if (filters.visibility) params.append('visibility', filters.visibility);
  if (filters.search) params.append('search', filters.search);
  
  const response = await apiClient.get(`/interview-boards?${params.toString()}`);
  return response.data;
};

export const getInterviewBoard = async (id) => {
  const response = await apiClient.get(`/interview-boards/${id}`);
  return response.data;
};

export const createInterviewBoard = async (boardData) => {
  const response = await apiClient.post('/interview-boards', boardData);
  return response.data;
};

export const updateInterviewBoard = async (id, boardData) => {
  const response = await apiClient.put(`/interview-boards/${id}`, boardData);
  return response.data;
};

export const deleteInterviewBoard = async (id) => {
  const response = await apiClient.delete(`/interview-boards/${id}`);
  return response.data;
};

// Stages
export const fetchStages = async (boardId) => {
  const response = await apiClient.get(`/interview-boards/${boardId}/stages`);
  return response.data;
};

export const createStage = async (boardId, stageData) => {
  const response = await apiClient.post(`/interview-boards/${boardId}/stages`, stageData);
  return response.data;
};

export const updateStage = async (boardId, stageId, stageData) => {
  const response = await apiClient.put(`/interview-boards/${boardId}/stages/${stageId}`, stageData);
  return response.data;
};

export const reorderStages = async (boardId, stageIds) => {
  const response = await apiClient.patch(`/interview-boards/${boardId}/stages/reorder`, { stageIds });
  return response.data;
};

export const deleteStage = async (boardId, stageId) => {
  const response = await apiClient.delete(`/interview-boards/${boardId}/stages/${stageId}`);
  return response.data;
};

// Tickets
export const fetchTickets = async (boardId, filters = {}) => {
  const params = new URLSearchParams();
  if (filters.stageId) params.append('stageId', filters.stageId);
  if (filters.status) params.append('status', filters.status);
  if (filters.priority) params.append('priority', filters.priority);
  if (filters.search) params.append('search', filters.search);
  if (filters.page) params.append('page', filters.page);
  if (filters.limit) params.append('limit', filters.limit);
  
  const response = await apiClient.get(`/interview-boards/${boardId}/tickets?${params.toString()}`);
  return response.data;
};
export const fetchTicketsTimeView = async (boardId, from, to) => {
  
  const response = await apiClient.get(
    `/interview-boards/${boardId}/tickets/time-view?from=${from}&to=${to}`
  );
  return response.data;
};

export const getInterviewTicket = async (boardId, ticketId) => {
  const response = await apiClient.get(`/interview-boards/${boardId}/tickets/${ticketId}`);
  return response.data;
};

export const createInterviewTicket = async (boardId, ticketData) => {
  const response = await apiClient.post(`/interview-boards/${boardId}/tickets`, ticketData);
  return response.data;
};

export const updateInterviewTicket = async (boardId, ticketId, ticketData) => {
  const response = await apiClient.put(`/interview-boards/${boardId}/tickets/${ticketId}`, ticketData);
  return response.data;
};

export const moveTicketStage = async (boardId, ticketId, stageId) => {
  const response = await apiClient.patch(`/interview-boards/${boardId}/tickets/${ticketId}/move-stage`, { stageId });
  return response.data;
};

export const deleteInterviewTicket = async (boardId, ticketId) => {
  const response = await apiClient.delete(`/interview-boards/${boardId}/tickets/${ticketId}`);
  return response.data;
};

// Activity Log
export const fetchTicketActivity = async (boardId, ticketId, page = 1, limit = 50) => {
  const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
  const response = await apiClient.get(`/interview-boards/${boardId}/tickets/${ticketId}/activity?${params.toString()}`);
  return response.data;
};

