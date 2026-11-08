<template>
  <div class="transactions-view">
    <div class="page-header">
      <div class="header-content">
        <div>
          <h1>Transactions</h1>
          <p class="subtitle">View all financial transactions across all users</p>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="filters-section">
      <div class="filter-group">
        <label>Date From:</label>
        <TmsNativeCalendarField
          v-model="filters.from"
          type="date"
          class="filter-input"
          @update:model-value="loadData"
        />
      </div>
      <div class="filter-group">
        <label>Date To:</label>
        <TmsNativeCalendarField
          v-model="filters.to"
          type="date"
          class="filter-input"
          @update:model-value="loadData"
        />
      </div>
      <div class="filter-group">
        <label>Type:</label>
        <select
          v-model="filters.type"
          @change="loadData"
          class="filter-select"
        >
          <option value="">All Types</option>
          <option value="income">Income</option>
          <option value="outcome">Expense</option>
        </select>
      </div>
      <div class="filter-group">
        <label>Status:</label>
        <select
          v-model="filters.status"
          @change="loadData"
          class="filter-select"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="accepted">Accepted</option>
          <option value="canceled">Canceled</option>
        </select>
      </div>
      <div class="filter-group">
        <label>Description / URL:</label>
        <input
          v-model="filters.description"
          type="text"
          placeholder="Search description or URL..."
          @input="debounceLoad"
          class="filter-input"
        />
      </div>
      <div class="filter-group">
        <label>Source:</label>
        <input
          v-model="filters.source"
          type="text"
          placeholder="Filter by source..."
          @input="debounceLoad"
          class="filter-input"
        />
      </div>
      <div v-if="showGroupFilter" class="filter-group">
        <label>Team:</label>
        <select
          v-model="selectedGroupId"
          @change="onGroupFilterChange"
          class="filter-select"
        >
          <option value="all">All teams</option>
          <option v-for="g in groups" :key="g._id || g.code" :value="g.code">
            {{ g.name || g.code }}
          </option>
        </select>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Loading transactions...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-state">
      <p>{{ error }}</p>
      <button @click="loadData" class="btn-retry">Retry</button>
    </div>

    <!-- Main Content: Left-Right Layout -->
    <div v-else class="main-content">
      <!-- Left Section: Users List -->
      <div class="left-section">
        <div class="section-header">
          <h2>Users</h2>
        </div>
        
        <div class="users-list">
          <div
            v-for="user in allUsers"
            :key="user._id || user.id"
            :class="['user-item', { active: selectedUserId === (user._id || user.id) }]"
            @click="selectUser(user)"
          >
            <div class="user-name">{{ user.name || user.email }}</div>
            <div class="user-transactions-count">
              {{ getTransactionsCountForUser(user._id || user.id) }} transaction(s)
            </div>
          </div>

          <div v-if="allUsers.length === 0" class="empty-state">
            No users found
          </div>
        </div>
      </div>

      <!-- Right Section: Transactions for Selected User -->
      <div class="right-section">
        <div class="section-header">
          <h2>
            {{ selectedUser ? `Transactions - ${selectedUser.name || selectedUser.email}` : 'Select a User' }}
          </h2>
          <button
            v-if="isBoss && selectedUserId"
            @click="openCreateModal"
            class="btn-primary btn-small"
          >
            + Create Transaction
          </button>
        </div>

        <div v-if="!selectedUserId" class="empty-state-select">
          <p>Select a user from the left to view their transactions</p>
        </div>

        <div v-else class="transactions-content">
          <TransactionsTable
            :transactions="filteredTransactions"
            :read-only="!isBoss"
            :users="allUsers"
            @edit="handleEdit"
            @accept="handleAccept"
            @cancel="handleCancel"
            @view="handleView"
          />
          
          <!-- Pagination -->
          <div v-if="pagination && pagination.totalPages > 1" class="pagination">
            <button
              @click="changePage(pagination.page - 1)"
              :disabled="pagination.page <= 1"
              class="pagination-btn"
            >
              Previous
            </button>
            <span class="pagination-info">
              Page {{ pagination.page }} of {{ pagination.totalPages }} ({{ pagination.total }} total)
            </span>
            <button
              @click="changePage(pagination.page + 1)"
              :disabled="pagination.page >= pagination.totalPages"
              class="pagination-btn"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Transaction Modal -->
    <TransactionModal
      v-if="showModal"
      :transaction="editingTransaction"
      :selectedUserId="selectedUserId"
      @close="closeModal"
      @saved="handleTransactionSaved"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useFinance } from '../composables/useFinance';
import { useAuthStore } from '../composables/useAuth';
import { fetchUsers } from '../services/users';
import { fetchGroups } from '../services/admin';
import { excludeSuperAdmin } from '../utils/userFilters';
import {
  isFinanceManagerUser,
  financeUsersListParams,
  isGlobalFinanceViewerUser,
} from '../utils/financeAccess';
import TmsNativeCalendarField from '../components/ui/TmsNativeCalendarField.vue';
import TransactionsTable from '../components/finance/TransactionsTable.vue';
import TransactionModal from '../components/finance/TransactionModal.vue';
import { getESTMonthStartKey, getESTMonthEndKey } from '../utils/timezoneHelpers';

const authStore = useAuthStore();
const isBoss = computed(() => isFinanceManagerUser(authStore.user));
const showGroupFilter = computed(() => isGlobalFinanceViewerUser(authStore.user));
const selectedGroupId = ref('all');
const groups = ref([]);

const {
  transactions,
  loading,
  error,
  loadTransactions,
  editTransaction,
  approve,
  removeTransaction
} = useFinance();

const allUsers = ref([]);
const selectedUserId = ref('');
const selectedUser = ref(null);
// Default the date range to the current month in EST (the system-wide timezone).
const filters = ref({
  from: getESTMonthStartKey(),
  to: getESTMonthEndKey(),
  type: '',
  status: '',
  description: '',
  source: '',
  page: 1,
  limit: 50
});
const pagination = ref(null);
const showModal = ref(false);
const editingTransaction = ref(null);
const allTransactionsForCounts = ref([]); // Store all transactions for counting
let debounceTimer = null;

const buildUserFetchParams = () => {
  if (showGroupFilter.value) {
    const p = { limit: 1000 };
    if (selectedGroupId.value && selectedGroupId.value !== 'all') {
      p.group = selectedGroupId.value;
    }
    return p;
  }
  return financeUsersListParams(authStore.user);
};

const appendTransactionGroupFilter = (query) => {
  if (
    showGroupFilter.value &&
    selectedGroupId.value &&
    selectedGroupId.value !== 'all'
  ) {
    query.groupId = selectedGroupId.value;
  }
};

const syncUserSelection = () => {
  if (!selectedUserId.value || !allUsers.value.length) {
    if (allUsers.value.length > 0) {
      const first = allUsers.value[0];
      selectedUserId.value = first._id || first.id;
      selectedUser.value = first;
    } else {
      selectedUserId.value = '';
      selectedUser.value = null;
    }
    return;
  }
  const exists = allUsers.value.some(
    (u) => (u._id || u.id) === selectedUserId.value
  );
  if (!exists) {
    if (allUsers.value.length > 0) {
      const first = allUsers.value[0];
      selectedUserId.value = first._id || first.id;
      selectedUser.value = first;
    } else {
      selectedUserId.value = '';
      selectedUser.value = null;
    }
  }
};

/* -------------------- COMPUTED -------------------- */

const filteredTransactions = computed(() => {
  // Filter transactions by selected user for display
  if (!selectedUserId.value) {
    return [];
  }
  
  let filtered = transactions.value || [];
  
  // Filter by selected user
  filtered = filtered.filter(t => {
    const txUserId = typeof t.userId === 'object' ? t.userId._id : t.userId;
    return txUserId === selectedUserId.value;
  });
  
  // Apply other filters
  if (filters.value.type) {
    filtered = filtered.filter(t => t.type === filters.value.type);
  }
  
  if (filters.value.status) {
    filtered = filtered.filter(t => t.status === filters.value.status);
  }
  
  if (filters.value.description) {
    const desc = filters.value.description.toLowerCase();
    filtered = filtered.filter(t =>
      (t.description || '').toLowerCase().includes(desc) ||
      (t.transactionUrl || '').toLowerCase().includes(desc)
    );
  }
  
  if (filters.value.source) {
    const source = filters.value.source.toLowerCase();
    filtered = filtered.filter(t => 
      ((t.source || t.category || '')).toLowerCase().includes(source)
    );
  }
  
  return filtered;
});

/* -------------------- HELPERS -------------------- */

const getTransactionsCountForUser = (userId) => {
  // Always use allTransactionsForCounts for accurate counts across all users
  if (!allTransactionsForCounts.value || allTransactionsForCounts.value.length === 0) {
    return 0;
  }
  
  // Convert userId to string for comparison
  const userIdStr = userId?.toString();
  
  const count = allTransactionsForCounts.value.filter(t => {
    if (!t) return false;
    // Handle userId which can be object or string
    let txUserId = null;
    if (t.userId) {
      txUserId = typeof t.userId === 'object' ? (t.userId._id || t.userId.id) : t.userId;
    }
    return txUserId?.toString() === userIdStr;
  }).length;
  
  return count;
};

/* -------------------- UI ACTIONS -------------------- */

const selectUser = (user) => {
  const userId = user._id || user.id;
  selectedUserId.value = userId;
  selectedUser.value = user;
  filters.value.page = 1; // Reset to first page
  // Load transactions for the selected user
  loadData();
};

const debounceLoad = () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    loadAllTransactionsForCounts();
    loadData();
  }, 500);
};

const onGroupFilterChange = async () => {
  filters.value.page = 1;
  await loadData({ refreshUsers: true });
};

const openCreateModal = () => {
  editingTransaction.value = null;
  showModal.value = true;
};

const handleEdit = (transaction) => {
  editingTransaction.value = transaction;
  showModal.value = true;
};

const handleAccept = async (transaction) => {
  if (!confirm('Accept this transaction?')) return;
  try {
    await editTransaction(transaction._id, { status: 'accepted' });
    loadData();
  } catch (err) {
    alert(err.message || 'Failed to accept transaction');
  }
};

const handleCancel = async (transaction) => {
  if (!confirm('Cancel this transaction? It will be excluded from all calculations.')) return;
  try {
    await editTransaction(transaction._id, { status: 'canceled' });
    loadData();
  } catch (err) {
    alert(err.message || 'Failed to cancel transaction');
  }
};

const handleView = (transaction) => {
  editingTransaction.value = transaction;
  showModal.value = true;
};

const closeModal = () => {
  showModal.value = false;
  editingTransaction.value = null;
};

const handleTransactionSaved = () => {
  closeModal();
  loadData();
};

const changePage = (page) => {
  filters.value.page = page;
  loadData();
};

/* -------------------- DATA LOADING -------------------- */

const loadUsers = async () => {
  const usersResponse = await fetchUsers(buildUserFetchParams());
  if (usersResponse.ok && usersResponse.data) {
    allUsers.value = excludeSuperAdmin(usersResponse.data.users || []);
    syncUserSelection();
  }
};

const loadData = async ({ refreshUsers = false } = {}) => {
  try {
    if (refreshUsers || allUsers.value.length === 0) {
      await loadUsers();
    }

    await loadAllTransactionsForCounts();

    const queryFilters = { ...filters.value };

    if (selectedUserId.value) {
      queryFilters.memberId = selectedUserId.value;
    } else {
      return;
    }

    appendTransactionGroupFilter(queryFilters);

    if (!queryFilters.from && !queryFilters.to) {
      const now = new Date("01/01/2017");
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      queryFilters.from = `${year}-${month}-01`;
      const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
      queryFilters.to = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
    }

    const response = await loadTransactions(queryFilters);

    if (response?.pagination) {
      pagination.value = response.pagination;
    } else if (response?.data?.pagination) {
      pagination.value = response.data.pagination;
    }
  } catch (err) {
    console.error('Error loading transactions:', err);
  }
};

// Load all transactions for counting (without memberId filter)
const loadAllTransactionsForCounts = async () => {
  try {
    const countFilters = {
      from: filters.value.from,
      to: filters.value.to,
      type: filters.value.type || undefined,
      status: filters.value.status || undefined,
      limit: 10000 // Large limit to get all transactions for counting
    };
    
    // Remove empty filters
    Object.keys(countFilters).forEach(key => {
      if (countFilters[key] === '' || countFilters[key] === undefined) {
        delete countFilters[key];
      }
    });

    appendTransactionGroupFilter(countFilters);

    // Ensure date range is set for counts
    if (!countFilters.from && !countFilters.to) {
      const now = new Date("01/01/2017");
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      countFilters.from = `${year}-${month}-01`;
      const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
      countFilters.to = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
    }

    const response = await loadTransactions(countFilters);
    
    // loadTransactions returns response.data which contains { transactions: [...], pagination: {...} }
    // So response is already the data object with transactions array
    if (response && Array.isArray(response.transactions)) {
      allTransactionsForCounts.value = response.transactions;
      console.log(`Loaded ${response.transactions.length} transactions for counts`);
    } else if (response?.data && Array.isArray(response.data.transactions)) {
      allTransactionsForCounts.value = response.data.transactions;
      console.log(`Loaded ${response.data.transactions.length} transactions for counts (nested)`);
    } else {
      console.warn('Unexpected response structure in loadAllTransactionsForCounts:', response);
      allTransactionsForCounts.value = [];
    }
  } catch (err) {
    console.error('Error loading transactions for counts:', err);
    allTransactionsForCounts.value = [];
  }
};

watch(selectedUserId, (newUserId) => {
  // Reset pagination when user changes
  filters.value.page = 1;
  // Load data when user changes (if user is selected)
  if (newUserId) {
    loadData();
  }
});

// Watch filters to reload counts when date range changes
watch([() => filters.value.from, () => filters.value.to, () => filters.value.type, () => filters.value.status], () => {
  loadAllTransactionsForCounts();
});

onMounted(async () => {
  if (showGroupFilter.value) {
    try {
      const res = await fetchGroups();
      groups.value = res?.data?.groups || res?.groups || [];
    } catch {
      groups.value = [];
    }
  }
  await loadData({ refreshUsers: true });
});
</script>

<style scoped>
.transactions-view {
  padding: 24px;
  max-width: 1600px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 24px;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.page-header h1 {
  font-size: 28px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.subtitle {
  color: var(--text-secondary);
  font-size: 14px;
}

.btn-primary {
  padding: 10px 20px;
  background: var(--color-primary);
  color: var(--text-inverse);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
}

.btn-primary:hover {
  background: var(--color-primary-dark);
}

.btn-small {
  padding: 8px 16px;
  font-size: 14px;
}

.filters-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  padding: 16px;
  background: var(--bg-primary);
  border-radius: 8px;
  border: 1px solid var(--border-light);
  margin-bottom: 24px;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.filter-group label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.filter-input,
.filter-select {
  padding: 8px 12px;
  border: 1px solid var(--border-medium);
  border-radius: 6px;
  font-size: 14px;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.filter-input:focus,
.filter-select:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.main-content {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 24px;
  align-items: start;
}

.left-section,
.right-section {
  background: var(--bg-primary);
  border-radius: 8px;
  border: 1px solid var(--border-light);
  overflow: hidden;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-light);
  background: var(--bg-tertiary);
}

.section-header h2 {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.users-list {
  max-height: calc(100vh - 300px);
  overflow-y: auto;
}

.user-item {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-light);
  cursor: pointer;
  transition: background-color 0.2s;
}

.user-item:hover {
  background-color: var(--bg-tertiary);
}

.user-item.active {
  background-color: rgba(99, 102, 241, 0.1);
  border-left: 4px solid var(--color-primary);
}

.user-name {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 15px;
  margin-bottom: 4px;
}

.user-transactions-count {
  font-size: 12px;
  color: var(--color-info);
  font-weight: 500;
}

.transactions-content {
  padding: 20px;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid var(--border-light);
}

.pagination-btn {
  padding: 8px 16px;
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-medium);
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
}

.pagination-btn:hover:not(:disabled) {
  background: var(--bg-secondary);
}

.pagination-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pagination-info {
  color: var(--text-secondary);
  font-size: 14px;
}

.empty-state,
.empty-state-select {
  text-align: center;
  color: #9ca3af;
  padding: 48px 24px;
}

.empty-state-select {
  padding: 80px 24px;
}

.loading-state,
.error-state {
  text-align: center;
  padding: 48px;
}

.spinner {
  border: 3px solid #f3f4f6;
  border-top: 3px solid #3b82f6;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.btn-retry {
  padding: 8px 16px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  margin-top: 16px;
}

@media (max-width: 1200px) {
  .main-content {
    grid-template-columns: 1fr;
  }

  .left-section {
    margin-bottom: 24px;
  }

  .users-list {
    max-height: 400px;
  }
}
</style>
