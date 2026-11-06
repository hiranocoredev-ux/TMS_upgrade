import apiClient from './axios';

export const getDailys = (userId) => apiClient.get(`/daily/${userId}`);
export const getAll = () => apiClient.get(`/daily`);
export const getTeam = (groupID) => apiClient.get(`/daily/group/${groupID}`);
export const updateDaily = (userId, username, group, date, updatedPost) => apiClient.patch(`/daily/${userId}/${username}/${group}/${date}`, updatedPost);
