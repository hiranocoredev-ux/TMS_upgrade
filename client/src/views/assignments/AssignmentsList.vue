<template>
  <div class="assignments-view">
    <!-- PAGE HEADER -->
    <div class="page-header">
      <div class="header-content">
        <div>
          <h1>Assignments</h1>
          <p class="subtitle">Track your work and earnings</p>
        </div>

        <router-link :to="{ name: 'AssignmentCreate' }" class="btn-primary">
          + Create Assignment
        </router-link>
      </div>
    </div>

    <!-- FILTERS -->
    <div class="filters card">
      <div class="filter-group">
        <label>Search</label>
        <input type="text" v-model="filters.search" placeholder="Title or description" @input="onFilterChange" />
      </div>

      <div class="filter-group">
        <label>Status</label>
        <select v-model="filters.status" @change="onFilterChange">
          <option value="">All statuses</option>
          <option value="progressing">Progressing</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      <div class="filter-group">
        <label>From</label>
        <TmsNativeCalendarField
          v-model="filters.from"
          type="date"
          @update:model-value="onFilterChange"
        />
      </div>

      <div class="filter-group">
        <label>To</label>
        <TmsNativeCalendarField
          v-model="filters.to"
          type="date"
          @update:model-value="onFilterChange"
        />
      </div>

      <div class="filter-group" v-if="isAdminUser">
        <label>Member</label>
        <select v-model="filters.user" @change="onFilterChange">
          <option value="">All members</option>
          <option v-for="u in users" :key="u._id" :value="u._id">
            {{ u.name || u.email }}
          </option>
        </select>
      </div>

      <div class="filter-group">
        <label>Group</label>
        <select v-model="filters.group" @change="onFilterChange">
          <option value="">All groups</option>
          <option v-for="opt in entityGroupOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>

      <!-- PAGE SIZE -->
      <div class="filter-group">
        <label>Page Size</label>
        <select v-model.number="pagination.limit" @change="changePageSize">
          <option :value="10">10</option>
          <option :value="20">20</option>
          <option :value="50">50</option>
        </select>
      </div>
    </div>

    <!-- LOADING -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Loading assignments...</p>
    </div>

    <!-- ERROR -->
    <div v-else-if="error" class="error-state">
      <p>{{ error }}</p>
      <button class="btn-retry" @click="loadAssignments">
        Retry
      </button>
    </div>

    <!-- TABLE -->
    <div v-else class="card table-container">
      <table class="assignments-table">
        <thead>
          <tr>
            <th>Group</th>
            <th v-if="isAdminUser">Member</th>
            <th>Title</th>
            <th>Status</th>
            <th>Earnings</th>
            <th>Created</th>
            <th>Completed At</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          <tr v-for="a in assignments" :key="a._id">
            <td>{{ formatGroupLabel(a?.group) }}</td>
            <td v-if="isAdminUser">
              <div class="member-name">
                {{ a.ownerUserId?.name || 'â€”' }}
              </div>
              <div class="member-email">
                {{ a.ownerUserId?.email }}
              </div>
            </td>

            <td>{{ a.title }}</td>

            <td>
              <span class="status-badge" :class="`status-${a.status}`">
                {{ a.status }}
              </span>
            </td>

            <td>
              <span v-if="a.currencyAmount > 0">
                {{ a.currencyAmount }} {{ a.currencyCode }}
              </span>
              <span v-else class="muted">â€”</span>
            </td>

            <td>{{ formatDate(a.createdAt) }}</td>

            <td>
              {{ a.completedAt ? formatDate(a.completedAt) : 'â€”' }}
            </td>

            <td>
              <div class="action-buttons">
                <button class="btn-view" @click="viewAssignment(a)">
                  View
                </button>

                <button v-if="isAdminUser || isOwner(a)" class="btn-edit" @click="editAssignment(a)">
                  Edit
                </button>

                <button v-if="isAdminUser || isOwner(a)" class="btn-delete" @click="deleteAssignment(a)">
                  Delete
                </button>
              </div>
            </td>
          </tr>

          <tr v-if="assignments.length === 0">
            <td :colspan="isAdminUser ? 7 : 6" class="empty-state">
              No assignments match your filters.
            </td>
          </tr>
        </tbody>
      </table>

      <!-- PAGINATION -->
      <div class="pagination" v-if="pagination.totalPages > 1">
        <button :disabled="!pagination.hasPrev" @click="changePage(pagination.page - 1)">
          Prev
        </button>

        <span>
          Page {{ pagination.page }} of {{ pagination.totalPages }}
        </span>

        <button :disabled="!pagination.hasNext" @click="changePage(pagination.page + 1)">
          Next
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import TmsNativeCalendarField from '../../components/ui/TmsNativeCalendarField.vue';
import { useAuthStore } from '../../composables/useAuth';
import * as assignmentService from '../../services/assignments';
import { ENTITY_GROUP_OPTIONS, formatGroupLabel } from '../../constants/groups.js';
import { normalizeRole, ROLES } from '../../constants/roles.js';

const router = useRouter();
const authStore = useAuthStore();

const loading = ref(false);
const error = ref(null);
const assignments = ref([]);
const users = ref([]);

const entityGroupOptions = ENTITY_GROUP_OPTIONS;

const filters = ref({
  search: '',
  status: '',
  group: '',
  from: '',
  to: '',
  user: ''
});

const pagination = ref({
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 0,
  hasNext: false,
  hasPrev: false
});

const isAdminUser = computed(() => {
  const u = authStore.user;
  if (!u?.role) return false;
  const r = normalizeRole(u.role, u.degree);
  return r === ROLES.SUPER_ADMIN || r === ROLES.GROUP_BOSS;
});

const loadAssignments = async () => {
  loading.value = true;
  error.value = null;

  try {
    const res = await assignmentService.fetchAssignments({
      ...filters.value,
      page: pagination.value.page,
      limit: pagination.value.limit
    });

    assignments.value = res.data.assignments || [];
    pagination.value = {
      ...pagination.value,
      ...res.data.pagination
    };
  } catch (err) {
    error.value = err.response?.data?.message || 'Failed to load assignments';
  } finally {
    loading.value = false;
  }
};

const onFilterChange = () => {
  pagination.value.page = 1;
  loadAssignments();
};

const changePage = (page) => {
  pagination.value.page = page;
  loadAssignments();
};

const changePageSize = () => {
  pagination.value.page = 1;
  loadAssignments();
};

const viewAssignment = (a) => {
  router.push({ name: 'AssignmentDetail', params: { id: a._id } });
};

const editAssignment = (a) => {
  router.push({
    name: 'AssignmentDetail',
    params: { id: a._id },
    query: { edit: 'true' }
  });
};

const deleteAssignment = async (a) => {
  if (!confirm(`Delete assignment "${a.title}"?`)) return;

  try {
    await assignmentService.deleteAssignment(a._id);
    loadAssignments();
  } catch (err) {
    alert(err.response?.data?.message || 'Delete failed');
  }
};

const isOwner = (a) =>
  a.ownerUserId?._id === authStore.user?._id;

const formatDate = (d) =>
  new Date(d).toLocaleDateString();

onMounted(loadAssignments);
</script>

<style scoped>
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  margin-top: 20px;
}

.pagination button {
  padding: 6px 12px;
  border-radius: 4px;
  border: 1px solid #ddd;
  background: white;
  cursor: pointer;
}

.pagination button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

td {
  text-align: center;
  justify-items: center;
}

.assignments-view {
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 24px;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.subtitle {
  color: #7f8c8d;
  margin-top: 4px;
}

.card {
  background: #fff;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.filters {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
  align-items: end;
}

.filter-group label {
  font-size: 0.85rem;
  color: #7f8c8d;
}

.filter-group input,
.filter-group select {
  height: 36px;
  padding: 6px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  width: 100%;
}

.table-container {
  overflow-x: auto;
}

.assignments-table {
  width: 100%;
  border-collapse: collapse;
}

.assignments-table th,
.assignments-table td {
  padding: 14px 16px;
  border-bottom: 1px solid #e0e0e0;
}

.member-name {
  font-weight: 600;
}

.member-email {
  font-size: 0.8rem;
  color: #7f8c8d;
}

.status-badge {
  padding: 4px 10px;
  border-radius: 10px;
  font-size: 0.85rem;
  font-weight: 500;
}

.status-progressing {
  background: #f39c12;
  color: #fff;
}

.status-completed {
  background: #2ecc71;
  color: #fff;
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.btn-view {
  background: #ecf0f1;
  border: none;
  padding: 6px 10px;
  border-radius: 4px;
  cursor: pointer;
}

.btn-edit {
  background: #3498db;
  color: #fff;
  border: none;
  padding: 6px 10px;
  border-radius: 4px;
}

.btn-delete {
  background: #e74c3c;
  color: #fff;
  border: none;
  padding: 6px 10px;
  border-radius: 4px;
}

.btn-primary {
  background: #3498db;
  color: #fff;
  padding: 10px 18px;
  border-radius: 4px;
  text-decoration: none;
  font-weight: 600;
}

.empty-state {
  text-align: center;
  padding: 30px;
  color: #95a5a6;
}

.loading-state {
  text-align: center;
  padding: 60px 20px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>