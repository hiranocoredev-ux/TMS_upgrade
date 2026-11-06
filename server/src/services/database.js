import apiClient from './axios';

/**
 * Export database backup
 * @returns {Promise} Response with backup data
 */
export const exportDatabase = async () => {
  const response = await apiClient.get('/admin/database/export', {
    responseType: 'json' // JSON response
  });
  return response;
};

/**
 * Import database backup
 * @param {Object} backup - Backup data object
 * @param {boolean} clearExisting - Whether to clear existing data before import
 * @returns {Promise} Response with import results
 */
export const importDatabase = async (backup, clearExisting = true) => {
  const response = await apiClient.post('/admin/database/import', {
    backup,
    clearExisting
  });
  return response;
};

/**
 * Get database statistics
 * @returns {Promise} Response with database stats
 */
export const getDatabaseStats = async () => {
  const response = await apiClient.get('/admin/database/stats');
  return response;
};

