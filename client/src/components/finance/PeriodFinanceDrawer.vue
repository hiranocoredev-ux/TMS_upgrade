<template>
  <div v-if="plan" class="drawer-overlay" @click="close">
    <div class="drawer-content" @click.stop>
      <div class="drawer-header">
        <h2>Period Finance Details</h2>
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
            <span>{{ formatMonth(plan.periodId.month) }}</span>
          </div>
          <div class="info-row">
            <label>Date Range:</label>
            <span>{{ formatDate(plan.periodId.startDate) }} - {{ formatDate(plan.periodId.endDate) }}</span>
          </div>
          <div class="info-row">
            <label>Periodic Target:</label>
            <span class="target-value">{{ formatCurrency(plan.periodicFinancialGoal, currency) }}</span>
          </div>
          <div class="info-row" v-if="plan.note">
            <label>Note:</label>
            <span>{{ plan.note }}</span>
          </div>
        </div>
        <div class="metrics-section">
          <div>
            <h3>Performance Metrics</h3>
            <div class="metrics-grid">
              <div class="metric-card">
                <div class="metric-label">Actual Income</div>
                <div class="metric-value income">{{ formatCurrency(periodActual, currency) }}</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">Pending Income</div>
                <div class="metric-value pending">{{ formatCurrency(periodPending, currency) }}</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">Gap</div>
                <div class="metric-value" :class="{ 'income': periodGap >= 0, 'expense': periodGap < 0 }">
                  {{ formatCurrency(periodGap, currency) }}
                </div>
              </div>
            </div>
          </div>
          <div class="goal-section">
            <div class="section-header">
              <h2>Financial Goals</h2>
            </div>
            <div class="goal-progress">
              <div>
                <div class="goal-item">
                  <div class="goal-header">
                    <span class="goal-label">Income Goal</span>
                    <span class="goal-amount"> {{ formatAmount(periodActual || 0) }} / {{
                      formatAmount(plan.periodicFinancialGoal || 0) }}</span>
                  </div>
                  <div class="progress-bar-container">
                    <div class="progress-bar income-progress"
                      :style="{ width: `${Math.min(periodActual / (plan.periodicFinancialGoal || 1) * 100)}%` }"></div>
                  </div>
                  <div class="goal-status">
                    <span v-if="periodActual >= plan.periodicFinancialGoal" class="status-success">✓ Goal
                      Achieved</span>
                    <span v-else class="status-pending">{{ Math.round((periodActual / (plan.periodicFinancialGoal || 1))
                      *
                      100)
                      }}% Complete</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="transactions-section">
          <h3>Transactions in Period</h3>
          <TransactionsTable :transactions="periodTransactions" :read-only="!readOnly" @view="handleViewTransaction"
            @accept="handleAccept" @cancel="handleCancel" @edit="handleEdit" />
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
import TransactionsTable from './TransactionsTable.vue';
import apiClient from '../../services/axios';
const formatAmount = (amount) => {
  return parseFloat(amount || 0).toFixed(2);
};
const props = defineProps({
  plan: {
    type: Object,
    default: null
  },
  readOnly: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits(['close']);

const { transactions, loadTransactions } = useFinance();
const allUsers = ref([]);
const currency = ref('USD');

const periodActual = computed(() => {
  console.log('Calculating periodActual for plan:', props.plan);
  if (!props.plan) return 0;
  return getPeriodActual(props.plan);
});

const periodPending = computed(() => {
  if (!props.plan) return 0;
  return getPeriodPending(props.plan);
});

const periodGap = computed(() => {
  if (!props.plan) return 0;
  const actual = periodActual.value;
  const pending = periodPending.value;
  return props.plan.periodicFinancialGoal - (actual + pending);
});

const periodTransactions = computed(() => {
  if (!props.plan) return [];

  const start = new Date(props.plan.periodId.startDate);
  const end = new Date(props.plan.periodId.endDate);
  end.setHours(23, 59, 59, 999);

  const planUserId = typeof props.plan.userId === 'object' ? props.plan.userId._id : props.plan.userId;

  return transactions.value.filter(t => {
    const txDate = new Date(t.date);
    const txUserId = typeof t.userId === 'object' ? t.userId._id : t.userId;
    return txDate >= start && txDate <= end && txUserId === planUserId;
  });
});

const getUserName = (userId) => {
  if (typeof userId === 'object' && userId !== null) {
    return userId.name || userId.email || 'Unknown';
  }
  const user = allUsers.value.find(u => u._id === userId);
  return user?.name || user?.email || 'Unknown User';
};

const getPeriodActual = (plan) => {
  const start = new Date(plan.periodId.startDate);
  const end = new Date(plan.periodId.endDate);
  end.setHours(23, 59, 59, 999);
  const planUserId = typeof plan.userId === 'object' ? plan.userId._id : plan.userId;

  return transactions.value
    .filter(t => {
      const txDate = new Date(t.date);
      const txUserId = typeof t.userId === 'object' ? t.userId._id : t.userId;
      return txDate >= start && txDate <= end &&
        txUserId === planUserId &&
        t.status === 'accepted' &&
        t.type === 'income';
    })
    .reduce((sum, t) => sum + t.amount, 0);
};

const getPeriodPending = (plan) => {
  const start = new Date(plan.periodId.startDate);
  const end = new Date(plan.periodId.endDate);
  end.setHours(23, 59, 59, 999);
  const planUserId = typeof plan.userId === 'object' ? plan.userId._id : plan.userId;

  return transactions.value
    .filter(t => {
      const txDate = new Date(t.date);
      const txUserId = typeof t.userId === 'object' ? t.userId._id : t.userId;
      return txDate >= start && txDate <= end &&
        txUserId === planUserId &&
        t.status === 'pending' &&
        t.type === 'income';
    })
    .reduce((sum, t) => sum + t.amount, 0);
};

const close = () => {
  emit('close');
};

const handleViewTransaction = (transaction) => {
  console.log('View transaction:', transaction);
};
const handleAccept = async (transaction) => {
  try {
    await fetch(`/api/finance/transactions/${transaction._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'accepted' })
    });
    await reloadTransactions();
  } catch (err) {
    console.error('Accept failed', err);
  }
};

const handleCancel = async (transaction) => {
  try {
    await fetch(`/api/finance/transactions/${transaction._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'canceled' })
    });
    await reloadTransactions();
  } catch (err) {
    console.error('Cancel failed', err);
  }
};

const handleEdit = (transaction) => {
  console.log('Edit transaction:', transaction);
  // open TransactionModal here
};

const reloadTransactions = async () => {
  await loadTransactions({
    from: props.plan.startDate,
    to: props.plan.endDate,
    memberId:
      typeof props.plan.userId === 'object'
        ? props.plan.userId._id
        : props.plan.userId
  });
};

const loadData = async () => {
  if (!props.plan) return;

  try {
    const usersResponse = await fetchUsers();
    if (usersResponse.ok && usersResponse.data) {
      allUsers.value = usersResponse.data.users || [];
    }

    // Load transactions for the period
    const start = new Date(props.plan.periodId.startDate);
    const end = new Date(props.plan.periodId.endDate);
    end.setHours(23, 59, 59, 999);

    await loadTransactions({
      from: start.toISOString(),
      to: end.toISOString(),
      memberId: typeof props.plan.userId === 'object' ? props.plan.userId._id : props.plan.userId
    });
  } catch (err) {
    console.error('Error loading period data:', err);
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
  width: 600px;
  max-width: 600px;
  height: 100vh;
  background: var(--bg-primary);
  box-shadow: var(--shadow-xl);
  display: flex;
  flex-direction: column;
}

@media (max-width: 700px) {
  .drawer-content {
    width: calc(100vw - 40px);
    max-width: calc(100vw - 40px);
  }
}

.drawer-header {
  padding: 20px 24px;
  border-bottom: 1px solid var(--border-light);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--bg-primary);
}

.drawer-header h2 {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
}

.drawer-close {
  background: none;
  border: none;
  font-size: 32px;
  color: var(--text-tertiary);
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
  background: var(--bg-tertiary);
}

.drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.plan-info {
  margin-bottom: 24px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--border-light);
}

.info-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
}

.info-row label {
  font-weight: 500;
  color: var(--text-secondary);
}

.target-value {
  color: var(--color-primary);
  font-weight: 600;
}

.metrics-section {
  margin-bottom: 24px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--border-light);
}

.metrics-section h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 16px;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
}

.metric-card {
  background: var(--bg-tertiary);
  padding: 16px;
  border-radius: 6px;
}

.metric-label {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.metric-value {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
}

.metric-value.income {
  color: var(--color-success);
}

.metric-value.expense {
  color: var(--color-error);
}

.metric-value.pending {
  color: var(--color-warning);
}

.transactions-section h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 16px;
}

/* Goals Section */
.goals-section,
.team-dashboard-section,
.transactions-section {
  background: var(--bg-secondary);
  padding: 24px;
  border-radius: 8px;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-light);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.section-header h2 {
  margin: 0;
  color: var(--text-primary);
  font-size: 1.4rem;
}

.goals-progress {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.goal-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.goal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.goal-label {
  font-weight: 500;
  color: var(--text-primary);
}

.goal-amount {
  font-weight: 600;
  color: var(--text-secondary);
}

.progress-bar-container {
  width: 100%;
  height: 24px;
  background: var(--bg-tertiary);
  border-radius: 12px;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  border-radius: 12px;
  transition: width 0.3s ease;
}

.income-progress {
  background: var(--color-success);
}

.expense-progress {
  background: var(--color-info);
}

.expense-over {
  background: var(--color-error);
}

.goal-status {
  font-size: 0.85rem;
}

.status-success {
  color: #2ecc71;
  font-weight: 500;
}

.status-warning {
  color: #f39c12;
  font-weight: 500;
}

.status-pending {
  color: #7f8c8d;
}

.no-expense-limit,
.goals-placeholder {
  color: #95a5a6;
  font-style: italic;
  text-align: center;
  padding: 20px;
}
</style>
