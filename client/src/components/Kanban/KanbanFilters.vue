<template>
  <div class="kanban-filters">
    <div class="filters-row">
      <div class="filter-group">
        <label>Member</label>
        <select v-model="localFilters.member" @change="updateFilters">
          <option value="">All Members</option>
          <option v-for="user in users" :key="user._id" :value="user._id">
            {{ user.name || user.email }}
          </option>
        </select>
      </div>

      <div class="filter-group">
        <label>Job Profile</label>
        <select v-model="localFilters.profile" @change="updateFilters">
          <option value="">All Profiles</option>
          <option v-for="profile in profiles" :key="profile._id" :value="profile._id">
            {{ profile.name }}
          </option>
        </select>
      </div>

      <div class="filter-group">
        <label>Stage</label>
        <select v-model="localFilters.stage" @change="updateFilters">
          <option value="">All Stages</option>
          <option v-for="stage in stages" :key="stage" :value="stage">
            {{ formatStage(stage) }}
          </option>
        </select>
      </div>

      <div class="filter-group">
        <label>Platform</label>
        <input
          v-model="localFilters.platform"
          type="text"
          placeholder="Filter by platform"
          @input="debouncedUpdate"
        />
      </div>

      <div class="filter-group">
        <label>Search</label>
        <input
          v-model="localFilters.search"
          type="text"
          placeholder="Search tickets..."
          @input="debouncedUpdate"
        />
      </div>
    </div>

    <div class="filters-row">
      <div class="filter-group">
        <label>Date From</label>
        <TmsNativeCalendarField
          v-model="localFilters.dateFrom"
          type="date"
          @update:model-value="updateFilters"
        />
      </div>

      <div class="filter-group">
        <label>Date To</label>
        <TmsNativeCalendarField
          v-model="localFilters.dateTo"
          type="date"
          @update:model-value="updateFilters"
        />
      </div>

      <div class="filter-group">
        <label>Tags</label>
        <input
          v-model="tagsInput"
          type="text"
          placeholder="Enter tags (comma-separated)"
          @blur="updateTags"
          @keyup.enter="updateTags"
        />
      </div>

      <div class="filter-actions">
        <button @click="clearFilters" class="btn-clear">Clear Filters</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import TmsNativeCalendarField from '../ui/TmsNativeCalendarField.vue';

const props = defineProps({
  filters: {
    type: Object,
    default: () => ({})
  },
  users: {
    type: Array,
    default: () => []
  },
  profiles: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['update:filters']);

const stages = [
  'NEW',
  'BID_SUBMITTED',
  'CLIENT_REPLIED',
  'INTERVIEW_SCHEDULED',
  'INTERVIEW_DONE',
  'OFFER_CONTRACT',
  'IN_PROGRESS',
  'WON',
  'LOST_CLOSED'
];

const localFilters = ref({
  member: '',
  profile: '',
  stage: '',
  platform: '',
  search: '',
  dateFrom: '',
  dateTo: '',
  tags: []
});

const tagsInput = ref('');

let debounceTimer = null;

const formatStage = (stage) => {
  return stage.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
};

const updateFilters = () => {
  emit('update:filters', { ...localFilters.value });
};

const debouncedUpdate = () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    updateFilters();
  }, 500);
};

const updateTags = () => {
  if (tagsInput.value.trim()) {
    localFilters.value.tags = tagsInput.value.split(',').map(tag => tag.trim()).filter(tag => tag);
  } else {
    localFilters.value.tags = [];
  }
  updateFilters();
};

const clearFilters = () => {
  localFilters.value = {
    member: '',
    profile: '',
    stage: '',
    platform: '',
    search: '',
    dateFrom: '',
    dateTo: '',
    tags: []
  };
  tagsInput.value = '';
  updateFilters();
};

// Sync with props
watch(() => props.filters, (newFilters) => {
  if (newFilters) {
    localFilters.value = {
      member: newFilters.member || '',
      profile: newFilters.profile || '',
      stage: newFilters.stage || '',
      platform: newFilters.platform || '',
      search: newFilters.search || '',
      dateFrom: newFilters.dateFrom || '',
      dateTo: newFilters.dateTo || '',
      tags: newFilters.tags || []
    };
    if (newFilters.tags && newFilters.tags.length > 0) {
      tagsInput.value = newFilters.tags.join(', ');
    }
  }
}, { deep: true, immediate: true });

onMounted(() => {
  // Default date range is handled by parent component
});
</script>

<style scoped>
.kanban-filters {
  background: white;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.filters-row {
  display: flex;
  gap: 16px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.filters-row:last-child {
  margin-bottom: 0;
}

.filter-group {
  flex: 1;
  min-width: 150px;
}

.filter-group label {
  display: block;
  font-size: 0.85rem;
  font-weight: 500;
  color: #2c3e50;
  margin-bottom: 6px;
}

.filter-group input,
.filter-group select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.9rem;
  transition: border-color 0.2s;
}

.filter-group input:focus,
.filter-group select:focus {
  outline: none;
  border-color: #3498db;
}

.filter-actions {
  display: flex;
  align-items: flex-end;
}

.btn-clear {
  padding: 8px 16px;
  background: #e74c3c;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  transition: background 0.2s;
}

.btn-clear:hover {
  background: #c0392b;
}
</style>

