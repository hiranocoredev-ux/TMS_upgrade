<template>
  <div class="finance-filters">
    <div class="filter-group">
      <label>Month:</label>
      <TmsNativeCalendarField
        v-model="localMonth"
        type="month"
        @update:model-value="updateMonth"
      />
    </div>

    <!-- <div v-if="showPeriodSelector && periods.length > 0" class="filter-group">
      <label>Period:</label>
      <select v-model="localPeriod" @change="updatePeriod" class="filter-select">
        <option value="">All Periods</option>
        <option v-for="period in periods" :key="period._id" :value="period._id">
          {{ formatPeriodName(period) }}
        </option>
      </select>
    </div> -->

    <div v-if="showUserFilter" class="filter-group">
      <label>Users:</label>
      <select v-model="localUserId" @change="updateUser" class="filter-select filter-multiselect">
        <option value="">All Users</option>
        <option v-for="user in users" :key="user.id" :value="user.id">
          {{ user.name || user.email }}
        </option>
      </select>
    </div>

    <div v-if="showScopeToggle" class="filter-group">
      <label>Scope:</label>
      <div class="scope-toggle">
        <button v-for="scope in scopes" :key="scope" :class="['scope-btn', { active: localScope === scope }]"
          @click="updateScope(scope)">
          {{ scope }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { formatDate } from '../../utils/financeHelpers';
import TmsNativeCalendarField from '../ui/TmsNativeCalendarField.vue';

const props = defineProps({
  month: {
    type: String,
    default: ''
  },
  period: {
    type: String,
    default: ''
  },
  // selectedUsers: {
  //   type: Array,
  //   default: () => []
  // },
  userId: {
    type: String,
    default: null
  },
  scope: {
    type: String,
    default: 'Monthly',
    validator: (value) => ['Monthly'].includes(value)

    // validator: (value) => ['Monthly', 'Periodic', 'All'].includes(value)
  },
  periods: {
    type: Array,
    default: () => []
  },
  users: {
    type: Array,
    default: () => []
  },
  showPeriodSelector: {
    type: Boolean,
    default: false
  },
  showUserFilter: {
    type: Boolean,
    default: true
  },
  showScopeToggle: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits(['update:month', 'update:period', 'update:userId', 'update:scope']);

const localMonth = ref(props.month);
const localPeriod = ref(props.period);
const localUserId = ref(props.userId || '');
const localScope = ref(props.scope);

const scopes = ['Monthly'];

watch(() => props.month, (newVal) => {
  localMonth.value = newVal;
});

watch(() => props.period, (newVal) => {
  localPeriod.value = newVal;
});

watch(() => props.userId, (newVal) => {
  localUserId.value = newVal;
});

watch(() => props.scope, (newVal) => {
  localScope.value = newVal;
});

const updateMonth = () => {
  emit('update:month', localMonth.value);
};

const updatePeriod = () => {
  emit('update:period', localPeriod.value);
};

const updateUser = () => {
  console.log('Updating userId to:', localUserId.value);
  emit('update:userId', localUserId.value);
};

const updateScope = (scope) => {
  localScope.value = scope;
  emit('update:scope', scope);
};

const formatPeriodName = (period) => {
  const start = formatDate(period.startDate, { month: 'short', day: 'numeric' });
  const end = formatDate(period.endDate, { month: 'short', day: 'numeric' });
  return `${start} - ${end}`;
};
</script>

<style scoped>
.finance-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  padding: 16px;
  background: white;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
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
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.filter-input,
.filter-select {
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  min-width: 150px;
}

/* .filter-select.filter-multiselect {
  min-width: 200px;
} */

.scope-toggle {
  display: flex;
  gap: 4px;
}

.scope-btn {
  padding: 8px 16px;
  border: 1px solid #d1d5db;
  background: white;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.scope-btn:hover {
  background: #f9fafb;
}

.scope-btn.active {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}
</style>
