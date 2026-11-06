<template>
  <div v-if="plan" class="drawer-overlay" @click="close">
    <div class="drawer-content" @click.stop>
      <div class="drawer-header">
        <h2>Monthly Plan Details</h2>
        <button @click="close" class="drawer-close">×</button>
      </div>
      <div class="drawer-body">
        <div class="plan-info">
          <div class="info-row">
            <label>User:</label>
            <span>{{ getUserName(plan.userId) }}</span>
          </div>
          <div class="info-row">
            <label>Month:</label>
            <span>{{ formatMonth(plan.month) }}</span>
          </div>
          <div class="info-row">
            <label>Monthly Target:</label>
            <span class="target-value">{{ formatCurrency(plan.monthlyFinancialGoal, currency) }}</span>
          </div>
          <div class="info-row" v-if="plan.note">
            <label>Note:</label>
            <span>{{ plan.note }}</span>
          </div>
        </div>

        <div class="periods-section">
          <div class="section-header">
            <h3>Week Plans</h3>
            <button
              v-if="!readOnly"
              @click="createPeriod"
              class="btn-secondary"
            >
              + Create Week
            </button>
          </div>
          <div v-if="periodicPlans.length > 0" class="periods-list">
            <div
              v-for="period in periodicPlans"
              :key="period._id"
              class="period-item"
              @click="viewPeriod(period)"
            >
              <div class="period-dates">
                {{ formatDate(period.startDate) }} - {{ formatDate(period.endDate) }}
              </div>
              <div class="period-target">
                Target: {{ formatCurrency(period.periodicFinancialGoal, currency) }}
              </div>
            </div>
          </div>
          <div v-else class="empty-state">
            No periodic plans created yet
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useFinance } from '../../composables/useFinance';
import { fetchUsers } from '../../services/users';
import { formatCurrency, formatMonth, formatDate } from '../../utils/financeHelpers';

const props = defineProps({
  plan: {
    type: Object,
    default: null
  },
  readOnly: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['close', 'createPeriod', 'viewPeriod']);

const { periodicPlans, loadPeriodicPlans } = useFinance();
const allUsers = ref([]);
const currency = ref('USD');

const getUserName = (userId) => {
  if (typeof userId === 'object' && userId !== null) {
    return userId.name || userId.email || 'Unknown';
  }
  const user = allUsers.value.find(u => u._id === userId);
  return user?.name || user?.email || 'Unknown User';
};

const close = () => {
  emit('close');
};

const createPeriod = () => {
  emit('createPeriod', props.plan);
};

const viewPeriod = (period) => {
  emit('viewPeriod', period);
};

const loadData = async () => {
  if (!props.plan) return;

  try {
    const usersResponse = await fetchUsers();
    if (usersResponse.ok && usersResponse.data) {
      allUsers.value = usersResponse.data.users || [];
    }

    if (props.plan.month) {
      await loadPeriodicPlans({
        month: props.plan.month,
        userId: typeof props.plan.userId === 'object' ? props.plan.userId._id : props.plan.userId
      });
    }
  } catch (err) {
    console.error('Error loading plan data:', err);
  }
};

watch(() => props.plan, () => {
  if (props.plan) {
    loadData();
  }
});

onMounted(() => {
  if (props.plan) {
    loadData();
  }
});
</script>

<style scoped>
.drawer-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
}

.drawer-content {
  width: 500px;
  max-width: 500px;
  height: 100vh;
  background: var(--bg-primary);
  box-shadow: -4px 0 12px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
}

@media (max-width: 600px) {
  .drawer-content {
    width: calc(100vw - 40px);
    max-width: calc(100vw - 40px);
  }
}

.drawer-header {
  padding: 20px 24px;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.drawer-header h2 {
  font-size: 20px;
  font-weight: 600;
  color: #111827;
}

.drawer-close {
  background: none;
  border: none;
  font-size: 32px;
  color: #6b7280;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.drawer-close:hover {
  background: #f3f4f6;
}

.drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.plan-info {
  margin-bottom: 24px;
  padding-bottom: 24px;
  border-bottom: 1px solid #e5e7eb;
}

.info-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
}

.info-row label {
  font-weight: 500;
  color: #6b7280;
}

.target-value {
  color: #6366f1;
  font-weight: 600;
}

.periods-section {
  margin-top: 24px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
}

.btn-secondary {
  padding: 6px 12px;
  background: #f3f4f6;
  color: #111827;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.btn-secondary:hover {
  background: #e5e7eb;
}

.periods-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.period-item {
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.period-item:hover {
  background: #f9fafb;
  border-color: #3b82f6;
}

.period-dates {
  font-weight: 500;
  color: #111827;
  margin-bottom: 4px;
}

.period-target {
  font-size: 14px;
  color: #6b7280;
}

.empty-state {
  text-align: center;
  color: #9ca3af;
  padding: 24px;
}
</style>
