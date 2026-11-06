<template>
  <div class="filter-view">
    <!-- Filter Controls -->
    <div class="filter-controls">
      <div class="filter-row">
        <div class="filter-group">
          <label>Company</label>
          <input
            v-model="filters.company"
            type="text"
            placeholder="Search by company..."
            @input="handleFilterChange"
          />
        </div>
        <div class="filter-group">
          <label>Position</label>
          <input
            v-model="filters.position"
            type="text"
            placeholder="Search by position..."
            @input="handleFilterChange"
          />
        </div>
      </div>
      <div class="filter-row">
        <div class="filter-group">
          <label>Stage</label>
          <select v-model="filters.stageId" @change="handleFilterChange">
            <option value="">All Stages</option>
            <option v-for="stage in stages" :key="stage._id" :value="stage._id">
              {{ stage.name }}
            </option>
          </select>
        </div>
        <div class="filter-group">
          <label>Owner</label>
          <select v-model="filters.ownerId" @change="handleFilterChange">
            <option value="">All Owners</option>
            <option v-for="user in users" :key="user._id || user.id" :value="user._id || user.id">
              {{ user.name }}
            </option>
          </select>
        </div>
      </div>
      <div class="filter-row">
        <div class="filter-group">
          <label>Priority</label>
          <select v-model="filters.priority" @change="handleFilterChange">
            <option value="">All Priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
        <div class="filter-group">
          <label>Status</label>
          <select v-model="filters.status" @change="handleFilterChange">
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="on_hold">On Hold</option>
          </select>
        </div>
      </div>
      <div class="filter-row">
        <div class="filter-group">
          <label>Date From</label>
          <TmsNativeCalendarField
            v-model="filters.dateFrom"
            type="date"
            @update:model-value="handleFilterChange"
          />
        </div>
        <div class="filter-group">
          <label>Date To</label>
          <TmsNativeCalendarField
            v-model="filters.dateTo"
            type="date"
            @update:model-value="handleFilterChange"
          />
        </div>
      </div>
      <div class="filter-actions">
        <button @click="clearFilters" class="btn-clear">Clear Filters</button>
        <span class="results-count">{{ filteredTickets.length }} ticket{{ filteredTickets.length !== 1 ? 's' : '' }} found</span>
      </div>
    </div>

    <!-- Filtered Results -->
    <div class="filtered-results">
      <div v-if="loading && tickets.length === 0" class="loading-state">
        <div class="spinner"></div>
        <p>Loading tickets...</p>
      </div>

      <div v-else-if="filteredTickets.length === 0" class="empty-state">
        <p>No tickets match the filters</p>
        <button @click="clearFilters" class="btn-clear">Clear Filters</button>
      </div>

      <div v-else class="tickets-grid">
        <InterviewTicketCard
          v-for="ticket in filteredTickets"
          :key="ticket._id"
          :ticket="ticket"
          @click="$emit('click-ticket', ticket)"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import TmsNativeCalendarField from '../ui/TmsNativeCalendarField.vue';
import InterviewTicketCard from './InterviewTicketCard.vue';

const props = defineProps({
  tickets: {
    type: Array,
    default: () => []
  },
  stages: {
    type: Array,
    default: () => []
  },
  users: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['click-ticket', 'filters-change']);

const filters = ref({
  company: '',
  position: '',
  stageId: '',
  ownerId: '',
  priority: '',
  status: '',
  dateFrom: '',
  dateTo: ''
});

let debounceTimer = null;

const handleFilterChange = () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    emit('filters-change', { ...filters.value });
  }, 300);
};

const clearFilters = () => {
  filters.value = {
    company: '',
    position: '',
    stageId: '',
    ownerId: '',
    priority: '',
    status: '',
    dateFrom: '',
    dateTo: ''
  };
  emit('filters-change', { ...filters.value });
};

// Helper to get earliest scheduled date from ticket
const getEarliestDate = (ticket) => {
  if (!ticket.dates || ticket.dates.length === 0) {
    return null;
  }
  const dates = ticket.dates
    .map(d => new Date(d.scheduledAt))
    .filter(d => !isNaN(d.getTime()))
    .sort((a, b) => a - b);
  return dates.length > 0 ? dates[0] : null;
};

const filteredTickets = computed(() => {
  return props.tickets.filter(ticket => {
    // Company filter
    if (filters.value.company) {
      const company = (ticket.companyName || '').toLowerCase();
      if (!company.includes(filters.value.company.toLowerCase())) {
        return false;
      }
    }

    // Position filter
    if (filters.value.position) {
      const position = (ticket.position || '').toLowerCase();
      if (!position.includes(filters.value.position.toLowerCase())) {
        return false;
      }
    }

    // Stage filter
    if (filters.value.stageId) {
      const stageId = ticket.stageId?._id || ticket.stageId;
      if (stageId !== filters.value.stageId) {
        return false;
      }
    }

    // Owner filter
    if (filters.value.ownerId) {
      const ownerId = ticket.ownerUserId?._id || ticket.ownerUserId;
      if (ownerId !== filters.value.ownerId) {
        return false;
      }
    }

    // Priority filter
    if (filters.value.priority && ticket.priority !== filters.value.priority) {
      return false;
    }

    // Status filter
    if (filters.value.status && ticket.status !== filters.value.status) {
      return false;
    }

    // Date range filter (based on earliest interview date)
    if (filters.value.dateFrom || filters.value.dateTo) {
      const earliestDate = getEarliestDate(ticket);
      if (!earliestDate) {
        // No dates - exclude if date filters are set
        if (filters.value.dateFrom || filters.value.dateTo) {
          return false;
        }
      } else {
        if (filters.value.dateFrom) {
          const fromDate = new Date(filters.value.dateFrom);
          fromDate.setHours(0, 0, 0, 0);
          if (earliestDate < fromDate) {
            return false;
          }
        }
        if (filters.value.dateTo) {
          const toDate = new Date(filters.value.dateTo);
          toDate.setHours(23, 59, 59, 999);
          if (earliestDate > toDate) {
            return false;
          }
        }
      }
    }

    return true;
  });
});
</script>

<style scoped>
.filter-view {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.filter-controls {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.filter-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}

.filter-row:last-of-type {
  margin-bottom: 0;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.filter-group label {
  font-size: 0.9rem;
  font-weight: 500;
  color: #2c3e50;
}

.filter-group input,
.filter-group select {
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.95rem;
}

.filter-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #e0e0e0;
}

.btn-clear {
  padding: 8px 16px;
  background: #ecf0f1;
  color: #2c3e50;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background 0.2s;
}

.btn-clear:hover {
  background: #bdc3c7;
}

.results-count {
  font-size: 0.9rem;
  color: #7f8c8d;
  font-weight: 500;
}

.filtered-results {
  min-height: 400px;
}

.loading-state,
.empty-state {
  text-align: center;
  padding: 40px;
}

.spinner {
  border: 3px solid #f3f3f3;
  border-top: 3px solid #3498db;
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

.tickets-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}
</style>

