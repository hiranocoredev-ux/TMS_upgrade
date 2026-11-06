import apiClient from './axios';

/**
 * Profile API client (client = team's customer record).
 * Sections: Base / Contact / Contract / Working-Role tabs.
 *
 * Server returns a `permissions` object alongside each profile that drives
 * client-side UI gating. Server is also the enforcement boundary.
 */

const buildQuery = (params = {}) => {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    usp.append(k, String(v));
  }
  const s = usp.toString();
  return s ? `?${s}` : '';
};

export const fetchProfileMetadata = async () => {
  const { data } = await apiClient.get('/profiles/metadata');
  return data;
};

export const fetchProfileSummary = async () => {
  const { data } = await apiClient.get('/profiles/summary');
  return data;
};

export const listProfiles = async (filters = {}) => {
  const { status, group, country, workingRole, manager, search, page, limit = 50 } = filters;
  const qs = buildQuery({ status, group, country, workingRole, manager, search, page, limit });
  const { data } = await apiClient.get(`/profiles${qs}`);
  return data;
};

export const getProfile = async (id) => {
  const { data } = await apiClient.get(`/profiles/${id}`);
  return data;
};

export const createProfile = async (payload) => {
  const { data } = await apiClient.post('/profiles', payload);
  return data;
};

export const updateProfile = async (id, payload) => {
  const { data } = await apiClient.put(`/profiles/${id}`, payload);
  return data;
};

export const deleteProfile = async (id) => {
  const { data } = await apiClient.delete(`/profiles/${id}`);
  return data;
};

/**
 * Decrypt the remote-access credentials (remoteId, remotePassword) for every
 * device in a single working-role tab. Audit-logged.
 */
export const revealTabDevices = async (id, role) => {
  const { data } = await apiClient.post(`/profiles/${id}/tabs/${role}/reveal`, {});
  return data;
};

/**
 * Reveal a single platform credential's gmail + password.
 * Allowed for tab editors OR a user listed as an ACTIVE member of this credential.
 */
export const revealPlatformCredential = async (id, role, credentialId) => {
  const { data } = await apiClient.post(
    `/profiles/${id}/tabs/${role}/credentials/${credentialId}/reveal`, {}
  );
  return data;
};

export const uploadProfilePicture = async (id, file) => {
  const fd = new FormData();
  fd.append('picture', file);
  const { data } = await apiClient.patch(`/profiles/${id}/picture`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

/**
 * Record a transaction (income only) against a single working-role tab.
 * Server applies clientSharePercent to derive `given` and `profit`.
 * Gated to SUPER_ADMIN or GROUP_BOSS.
 */
export const addTabTransaction = async (id, role, payload) => {
  const { data } = await apiClient.post(`/profiles/${id}/tabs/${role}/transactions`, payload);
  return data;
};

export const deleteTabTransaction = async (id, role, transactionId) => {
  const { data } = await apiClient.delete(`/profiles/${id}/tabs/${role}/transactions/${transactionId}`);
  return data;
};
