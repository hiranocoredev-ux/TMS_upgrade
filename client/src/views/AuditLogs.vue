<template>
  <div class="audit-logs-view">
    <div class="page-header">
      <div class="header-content">
        <div>
          <h1>Audit Logs</h1>
          <p class="subtitle">View system activity and audit trail</p>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="filters-section">
      <div class="filters-grid">
        <div class="filter-group">
          <label>Action Type</label>
          <select v-model="filters.action" @change="applyFilters">
            <option value="">All Actions</option>
            <option v-for="action in actionTypes" :key="action" :value="action">
              {{ formatAction(action) }}
            </option>
          </select>
        </div>
        <div class="filter-group">
          <label>Resource Type</label>
          <select v-model="filters.entityType" @change="applyFilters">
            <option value="">All Resources</option>
            <option v-for="type in resourceTypes" :key="type" :value="type">
              {{ formatResourceType(type) }}
            </option>
          </select>
        </div>
        <div class="filter-group">
          <label>Actor (User ID)</label>
          <input
            v-model="filters.actor"
            type="text"
            placeholder="Filter by user ID"
            @input="onActorFilterChange"
          />
        </div>
        <div class="filter-group">
          <label>Date From</label>
          <TmsNativeCalendarField
            v-model="filters.dateFrom"
            type="date"
            @update:model-value="applyFilters"
          />
        </div>
        <div class="filter-group">
          <label>Date To</label>
          <TmsNativeCalendarField
            v-model="filters.dateTo"
            type="date"
            @update:model-value="applyFilters"
          />
        </div>
        <div class="filter-group">
          <label>Items Per Page</label>
          <select v-model="filters.limit" @change="applyFilters">
            <option value="20">20</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </div>
      </div>
      <div class="filter-actions">
        <button @click="resetFilters" class="btn-secondary">Reset Filters</button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Loading audit logs...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-state">
      <p>{{ error }}</p>
      <button @click="loadLogs" class="btn-retry">Retry</button>
    </div>

    <!-- Logs Table -->
    <div v-else class="logs-table-container">
      <table class="logs-table">
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Actor</th>
            <th>Action</th>
            <th>Resource Type</th>
            <th>Resource ID</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="log in logs" :key="log.id">
            <td>{{ formatDate(log.createdAt) }}</td>
            <td>
              <div v-if="log.actor" class="actor-info">
                <div class="actor-name">{{ log.actor.name || log.actor.email }}</div>
                <div class="actor-role">{{ formatRole(log.actor.role) }}</div>
              </div>
              <span v-else class="no-actor">Unknown</span>
            </td>
            <td>
              <span class="action-badge" :class="getActionClass(log.action)">
                {{ formatAction(log.action) }}
              </span>
            </td>
            <td>
              <span class="resource-type-badge">
                {{ formatResourceType(log.entityType) }}
              </span>
            </td>
            <td class="entity-id-cell">
              <code>{{ truncateId(log.entityId) }}</code>
            </td>
            <td class="meta-cell">
              <button
                v-if="hasMeta(log.meta)"
                @click="toggleMeta(log.id)"
                class="btn-toggle-meta"
              >
                {{ expandedMeta[log.id] ? 'Hide' : 'Show' }} Details
              </button>
              <div v-if="expandedMeta[log.id] && log.meta" class="meta-details">
                <pre>{{ JSON.stringify(log.meta, null, 2) }}</pre>
              </div>
            </td>
          </tr>
          <tr v-if="logs.length === 0">
            <td colspan="6" class="empty-state">
              No audit logs found matching the filters.
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Pagination -->
      <div v-if="pagination && pagination.totalPages > 1" class="pagination">
        <button
          @click="goToPage(pagination.page - 1)"
          :disabled="pagination.page <= 1"
          class="btn-page"
        >
          Previous
        </button>
        <span class="page-info">
          Page {{ pagination.page }} of {{ pagination.totalPages }}
          ({{ pagination.total }} total logs)
        </span>
        <button
          @click="goToPage(pagination.page + 1)"
          :disabled="pagination.page >= pagination.totalPages"
          class="btn-page"
        >
          Next
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import TmsNativeCalendarField from '../components/ui/TmsNativeCalendarField.vue';
import * as auditService from '../services/audit';

const loading = ref(false);
const error = ref(null);
const logs = ref([]);
const pagination = ref(null);
const expandedMeta = ref({});

const filters = ref({
  action: '',
  entityType: '',
  actor: '',
  dateFrom: '',
  dateTo: '',
  page: 1,
  limit: 20
});

// Common action types and resource types for filters
const actionTypes = ref([
  'USER_CREATE',
  'USER_UPDATE',
  'USER_RESET_PASSWORD',
  'USER_DELETE',
  'JOB_PROFILE_CREATE',
  'JOB_PROFILE_UPDATE',
  'JOB_PROFILE_DELETE',
  'JOB_TICKET_CREATE',
  'JOB_TICKET_UPDATE',
  'JOB_TICKET_DELETE',
  'TICKET_MOVE_STAGE',
  'INTERVIEW_CREATE',
  'INTERVIEW_UPDATE',
  'INTERVIEW_DELETE',
  'INTERVIEW_TICKET_CREATE',
  'INTERVIEW_TICKET_UPDATE',
  'INTERVIEW_TICKET_STAGE_MOVE',
  'INTERVIEW_BOARD_CREATE',
  'INTERVIEW_BOARD_UPDATE',
  'INTERVIEW_BOARD_DELETE',
  'PROJECT_CREATE',
  'PROJECT_UPDATE',
  'PROJECT_DELETE',
  'PROJECT_COMMENT_ADD',
  'PROJECT_PROGRESS_LOG_ADD',
  'TASK_CREATE',
  'TASK_UPDATE',
  'TASK_DELETE',
  'FINANCE_TRANSACTION_CREATE',
  'FINANCE_TRANSACTION_UPDATE',
  'FINANCE_TRANSACTION_DELETE',
  'FINANCE_TRANSACTION_APPROVE',
  'FINANCE_TRANSACTION_REJECT',
  'FINANCE_GOAL_UPDATE',
  'FINANCE_TEAM_SUMMARY_VIEW',
  'FILE_UPLOAD',
  'FILE_DOWNLOAD',
  'SECRET_VIEW',
  'SECRET_DOWNLOAD'
]);

const resourceTypes = ref([
  'USER',
  'JOB_PROFILE',
  'JOB_TICKET',
  'INTERVIEW',
  'INTERVIEW_TICKET',
  'INTERVIEW_BOARD',
  'INTERVIEW_STAGE',
  'PROJECT',
  'TASK',
  'FINANCE_TRANSACTION',
  'FINANCE_GOAL',
  'FINANCE',
  'FILE',
  'FREELANCER_ACCOUNT',
  'PERSONAL_PROFILE'
]);

let actorFilterTimeout = null;

const loadLogs = async () => {
  loading.value = true;
  error.value = null;
  try {
    const response = await auditService.fetchAuditLogs({
      page: filters.value.page,
      limit: filters.value.limit,
      action: filters.value.action || undefined,
      entityType: filters.value.entityType || undefined,
      actor: filters.value.actor || undefined
    });
    
    if (response.ok && response.data) {
      logs.value = response.data.logs || [];
      pagination.value = response.data.pagination || null;
      
      // Apply date filtering on client side (since server doesn't support it yet)
      if (filters.value.dateFrom || filters.value.dateTo) {
        const fromDate = filters.value.dateFrom ? new Date(filters.value.dateFrom) : null;
        const toDate = filters.value.dateTo ? new Date(filters.value.dateTo + 'T23:59:59') : null;
        
        logs.value = logs.value.filter(log => {
          const logDate = new Date(log.createdAt);
          if (fromDate && logDate < fromDate) return false;
          if (toDate && logDate > toDate) return false;
          return true;
        });
      }
    }
  } catch (err) {
    error.value = err.response?.data?.message || 'Failed to load audit logs';
    console.error('Error loading audit logs:', err);
  } finally {
    loading.value = false;
  }
};

const applyFilters = () => {
  filters.value.page = 1; // Reset to first page when filters change
  loadLogs();
};

const onActorFilterChange = () => {
  // Debounce actor filter input
  if (actorFilterTimeout) {
    clearTimeout(actorFilterTimeout);
  }
  actorFilterTimeout = setTimeout(() => {
    applyFilters();
  }, 500);
};

const resetFilters = () => {
  filters.value = {
    action: '',
    entityType: '',
    actor: '',
    dateFrom: '',
    dateTo: '',
    page: 1,
    limit: 20
  };
  applyFilters();
};

const goToPage = (page) => {
  filters.value.page = page;
  loadLogs();
  // Scroll to top of table
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

const toggleMeta = (logId) => {
  expandedMeta.value[logId] = !expandedMeta.value[logId];
};

const hasMeta = (meta) => {
  return meta && Object.keys(meta).length > 0;
};

const formatDate = (date) => {
  if (!date) return 'N/A';
  const d = new Date(date);
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

const formatAction = (action) => {
  if (!action) return 'N/A';
  return action
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, l => l.toUpperCase());
};

const formatResourceType = (type) => {
  if (!type) return 'N/A';
  return type
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, l => l.toUpperCase());
};

const formatRole = (role) => {
  if (!role) return '';
  if (role === 'SYSTEM_ADMIN') return 'Admin';
  return role.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
};

const truncateId = (id) => {
  if (!id) return 'N/A';
  if (id.length <= 20) return id;
  return id.substring(0, 8) + '...' + id.substring(id.length - 8);
};

const getActionClass = (action) => {
  if (!action) return '';
  if (action.includes('CREATE')) return 'action-create';
  if (action.includes('UPDATE')) return 'action-update';
  if (action.includes('DELETE')) return 'action-delete';
  if (action.includes('APPROVE')) return 'action-approve';
  if (action.includes('REJECT')) return 'action-reject';
  if (action.includes('VIEW') || action.includes('DOWNLOAD')) return 'action-view';
  return '';
};

onMounted(() => {
  loadLogs();
});
</script>

<style scoped>
.audit-logs-view {
  background: transparent;
  padding: 0;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
}

.page-header {
  background: var(--bg-primary);
  padding: 20px 30px;
  border-radius: 8px;
  margin-bottom: 20px;
  box-shadow: var(--shadow-sm);
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.page-header h1 {
  color: var(--text-primary);
  margin: 0 0 4px 0;
  font-size: 1.8rem;
}

.subtitle {
  color: var(--text-secondary);
  margin: 0;
  font-size: 0.95rem;
}

/* Filters Section */
.filters-section {
  background: var(--bg-primary);
  padding: 24px;
  border-radius: 8px;
  margin-bottom: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.filters-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.filter-group label {
  font-weight: 500;
  color: var(--text-primary);
  font-size: 0.9rem;
}

.filter-group input,
.filter-group select {
  padding: 8px 12px;
  border: 1px solid var(--border-medium);
  border-radius: 4px;
  font-size: 0.95rem;
  transition: border-color 0.2s;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.filter-group input:focus,
.filter-group select:focus {
  outline: none;
  border-color: var(--color-primary);
}

.filter-actions {
  display: flex;
  justify-content: flex-end;
}

/* Logs Table */
.logs-table-container {
  background: var(--bg-primary);
  border-radius: 8px;
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  border: 1px solid var(--border-light);
}

.logs-table {
  width: 100%;
  border-collapse: collapse;
}

.logs-table thead {
  background: var(--bg-tertiary);
}

.logs-table th {
  padding: 16px;
  text-align: left;
  font-weight: 600;
  color: var(--text-primary);
  background: var(--bg-tertiary);
  border-bottom: 2px solid var(--border-light);
}

.logs-table td {
  padding: 16px;
  border-bottom: 1px solid var(--border-light);
  color: var(--text-primary);
  vertical-align: top;
}

.logs-table tbody tr:hover {
  background: var(--bg-tertiary);
}

.actor-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.actor-name {
  font-weight: 500;
  color: var(--text-primary);
}

.actor-role {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.no-actor {
  color: var(--text-tertiary);
  font-style: italic;
}

.action-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 500;
}

.action-create {
  background: #2ecc71;
  color: white;
}

.action-update {
  background: #3498db;
  color: white;
}

.action-delete {
  background: #e74c3c;
  color: white;
}

.action-approve {
  background: #27ae60;
  color: white;
}

.action-reject {
  background: #c0392b;
  color: white;
}

.action-view {
  background: #95a5a6;
  color: white;
}

.resource-type-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 500;
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.entity-id-cell code {
  font-family: 'Courier New', monospace;
  font-size: 0.85rem;
  background: var(--bg-tertiary);
  padding: 2px 6px;
  border-radius: 3px;
  color: var(--text-secondary);
}

.meta-cell {
  position: relative;
}

.btn-toggle-meta {
  padding: 4px 12px;
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-light);
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
  transition: background 0.2s;
}

.btn-toggle-meta:hover {
  background: var(--bg-secondary);
}

.meta-details {
  margin-top: 12px;
  padding: 12px;
  background: var(--bg-tertiary);
  border-radius: 4px;
  border: 1px solid var(--border-light);
}

.meta-details pre {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-primary);
  white-space: pre-wrap;
  word-wrap: break-word;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: var(--text-tertiary);
}

/* Pagination */
.pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-top: 1px solid var(--border-light);
}

.page-info {
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.btn-page {
  padding: 8px 16px;
  background: var(--color-primary);
  color: var(--text-inverse);
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background 0.2s;
}

.btn-page:hover:not(:disabled) {
  background: var(--color-primary-dark);
}

.btn-page:disabled {
  background: var(--bg-tertiary);
  color: var(--text-tertiary);
  cursor: not-allowed;
}

.loading-state,
.error-state {
  text-align: center;
  padding: 60px 20px;
  background: var(--bg-primary);
  border-radius: 8px;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-light);
}

.spinner {
  border: 4px solid var(--border-light);
  border-top: 4px solid var(--color-primary);
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.btn-secondary,
.btn-retry {
  padding: 10px 20px;
  background: #95a5a6;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background 0.2s;
}

.btn-secondary:hover {
  background: #7f8c8d;
}

.btn-retry {
  background: #3498db;
  margin-top: 16px;
}

.btn-retry:hover {
  background: #2980b9;
}
</style>
