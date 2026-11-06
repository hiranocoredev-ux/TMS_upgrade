<template>
  <div class="kanban-view">
    <div class="page-header">
      <h1>Kanban Board</h1>
      <p class="subtitle">Manage your job tickets and tasks</p>
    </div>

    <!-- Filters -->
    <KanbanFilters
      :filters="filters"
      :users="users"
      :profiles="profiles"
      @update:filters="handleFiltersUpdate"
    />

    <!-- Loading State -->
    <div v-if="loading && tickets.length === 0" class="loading-state">
      <div class="spinner"></div>
      <p>Loading tickets...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error && tickets.length === 0" class="error-state">
      <p>{{ error }}</p>
      <button @click="loadTickets" class="btn-retry">Retry</button>
    </div>

    <!-- Kanban Board -->
    <div v-else class="kanban-board">
      <KanbanColumn
        v-for="stage in stages"
        :key="stage.value"
        :stage="stage.value"
        :stage-label="stage.label"
        :tickets="ticketsByStage[stage.value] || []"
        :interview-counts="interviewCounts"
        @drop-ticket="handleStageDrop"
        @click-ticket="handleTicketClick"
      />
    </div>

    <!-- Ticket Detail Drawer -->
    <TicketDetailDrawer
      v-if="selectedTicket"
      :ticket="selectedTicket"
      @close="selectedTicket = null"
      @updated="handleTicketUpdated"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useStore } from 'vuex';
import KanbanFilters from '../components/Kanban/KanbanFilters.vue';
import KanbanColumn from '../components/Kanban/KanbanColumn.vue';
import TicketDetailDrawer from '../components/Kanban/TicketDetailDrawer.vue';
import * as userService from '../services/users';
import * as profileService from '../services/profiles';
import apiClient from '../services/axios';

const route = useRoute();
const router = useRouter();
const vuexStore = useStore();

const loading = ref(false);
const error = ref(null);
const users = ref([]);
const profiles = ref([]);
const selectedTicket = ref(null);
const interviewCounts = ref({});

const stages = [
  { value: 'NEW', label: 'New' },
  { value: 'BID_SUBMITTED', label: 'Bid Submitted' },
  { value: 'CLIENT_REPLIED', label: 'Client Replied' },
  { value: 'INTERVIEW_SCHEDULED', label: 'Interview Scheduled' },
  { value: 'INTERVIEW_DONE', label: 'Interview Done' },
  { value: 'OFFER_CONTRACT', label: 'Offer Contract' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'WON', label: 'Won' },
  { value: 'LOST_CLOSED', label: 'Lost / Closed' }
];

// Initialize filters from URL query params or defaults
const filters = ref({
  member: route.query.member || '',
  profile: route.query.profile || '',
  stage: route.query.stage || '',
  status: route.query.status || 'open',
  platform: route.query.platform || '',
  search: route.query.search || '',
  dateFrom: route.query.dateFrom || '',
  dateTo: route.query.dateTo || '',
  tags: route.query.tags ? (Array.isArray(route.query.tags) ? route.query.tags : [route.query.tags]) : [],
  page: parseInt(route.query.page) || 1,
  limit: parseInt(route.query.limit) || 100 // Large limit for Kanban board
});

// Set default date range if not provided
if (!filters.value.dateFrom && !filters.value.dateTo) {
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);
  filters.value.dateFrom = thirtyDaysAgo.toISOString().split('T')[0];
  filters.value.dateTo = today.toISOString().split('T')[0];
}

const tickets = computed(() => vuexStore.getters['jobTickets/tickets']);
const ticketsByStage = computed(() => vuexStore.getters['jobTickets/ticketsByStage']);

// Load users and profiles for filters
const loadUsersAndProfiles = async () => {
  try {
    const [usersResponse, profilesResponse] = await Promise.all([
      userService.fetchUsers(),
      profileService.listProfiles({ type: 'job', status: 'active' })
    ]);

    if (usersResponse.ok && usersResponse.data) {
      users.value = usersResponse.data.users || [];
    }
    if (profilesResponse.ok && profilesResponse.data) {
      profiles.value = profilesResponse.data.profiles || [];
    }
  } catch (err) {
    console.error('Failed to load users/profiles:', err);
  }
};

// Load interview counts for tickets
const loadInterviewCounts = async () => {
  try {
    const ticketIds = tickets.value.map(t => t._id);
    if (ticketIds.length === 0) return;

    // Fetch interviews for all tickets in one query (with pagination if needed)
    const response = await apiClient.get('/interviews', {
      params: { limit: 1000 } // Get all interviews
    });

    if (response.data.ok && response.data.data) {
      const interviews = response.data.data.interviews || [];
      const counts = {};
      
      ticketIds.forEach(ticketId => {
        counts[ticketId] = interviews.filter(i => 
          i.jobTicketId?._id === ticketId || i.jobTicketId === ticketId
        ).length;
      });
      
      interviewCounts.value = counts;
    }
  } catch (err) {
    console.error('Failed to load interview counts:', err);
  }
};

// Load tickets with current filters
const loadTickets = async () => {
  loading.value = true;
  error.value = null;

  try {
    await vuexStore.dispatch('jobTickets/fetchTickets', filters.value);
    await loadInterviewCounts();
  } catch (err) {
    error.value = err.message || 'Failed to load tickets';
  } finally {
    loading.value = false;
  }
};

// Update filters and sync with URL
const handleFiltersUpdate = (newFilters) => {
  filters.value = { ...filters.value, ...newFilters };
  
  // Update URL query string
  const query = { ...route.query };
  
  // Only add non-empty filters to URL
  Object.keys(filters.value).forEach(key => {
    if (key === 'tags' && filters.value.tags && filters.value.tags.length > 0) {
      query.tags = filters.value.tags;
    } else if (filters.value[key] && key !== 'page' && key !== 'limit') {
      query[key] = filters.value[key];
    } else if (!filters.value[key] || key === 'page' || key === 'limit') {
      delete query[key];
    }
  });

  // Replace query without triggering navigation
  router.replace({ query });
  
  // Reload tickets with new filters
  loadTickets();
};

// Handle drag and drop to move ticket stage
const handleStageDrop = async (ticketId, newStage) => {
  try {
    const ticket = tickets.value.find(t => t._id === ticketId);
    if (!ticket || ticket.currentStage === newStage) {
      return;
    }

    // Optimistically update UI
    ticket.currentStage = newStage;

    // Call API to move stage
    await vuexStore.dispatch('jobTickets/moveStage', {
      ticketId,
      toStage: newStage,
      reason: ''
    });
    
    // Reload to get updated data with stage history
    await loadTickets();
  } catch (err) {
    error.value = err.message || 'Failed to move ticket';
    // Reload to revert optimistic update
    await loadTickets();
  }
};

// Handle ticket card click
const handleTicketClick = async (ticket) => {
  try {
    // Fetch full ticket details with all populated fields
    const fullTicket = await vuexStore.dispatch('jobTickets/fetchTicket', ticket._id);
    selectedTicket.value = fullTicket;
  } catch (err) {
    error.value = err.message || 'Failed to load ticket details';
  }
};

// Handle ticket updated from drawer
const handleTicketUpdated = async (updatedTicket) => {
  selectedTicket.value = updatedTicket;
  await loadTickets(); // Reload to get latest data
};

// Watch for URL query changes (back/forward navigation)
watch(() => route.query, (newQuery) => {
  filters.value = {
    member: newQuery.member || '',
    profile: newQuery.profile || '',
    stage: newQuery.stage || '',
    status: newQuery.status || 'open',
    platform: newQuery.platform || '',
    search: newQuery.search || '',
    dateFrom: newQuery.dateFrom || filters.value.dateFrom,
    dateTo: newQuery.dateTo || filters.value.dateTo,
    tags: newQuery.tags ? (Array.isArray(newQuery.tags) ? newQuery.tags : [newQuery.tags]) : [],
    page: parseInt(newQuery.page) || 1,
    limit: parseInt(newQuery.limit) || 100
  };
  
  loadTickets();
}, { deep: true });

onMounted(async () => {
  await loadUsersAndProfiles();
  await loadTickets();
});
</script>

<style scoped>
.kanban-view {
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
  border: 1px solid var(--border-light);
}

.page-header h1 {
  color: var(--text-primary);
  margin: 0 0 8px 0;
  font-size: 1.8rem;
}

.subtitle {
  color: var(--text-secondary);
  margin: 0;
  font-size: 0.95rem;
}

.loading-state,
.error-state {
  background: var(--bg-primary);
  padding: 60px 40px;
  text-align: center;
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

.error-state p {
  color: var(--color-error);
  margin-bottom: 16px;
}

.btn-retry {
  padding: 10px 20px;
  background: var(--color-primary);
  color: var(--text-inverse);
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  transition: background 0.2s;
}

.btn-retry:hover {
  background: var(--color-primary-dark);
}

.kanban-board {
  display: flex;
  gap: 0;
  overflow-x: auto;
  padding: 20px 0;
  background: var(--bg-primary);
  border-radius: 8px;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-light);
  min-height: 600px;
}

/* Horizontal scrollbar styling */
.kanban-board::-webkit-scrollbar {
  height: 8px;
}

.kanban-board::-webkit-scrollbar-track {
  background: var(--bg-tertiary);
  border-radius: 4px;
}

.kanban-board::-webkit-scrollbar-thumb {
  background: var(--border-medium);
  border-radius: 4px;
}

.kanban-board::-webkit-scrollbar-thumb:hover {
  background: var(--border-dark);
}
</style>
