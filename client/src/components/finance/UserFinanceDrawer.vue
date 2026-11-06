<template>
  <div v-if="isOpen" class="drawer-overlay" @click="close">
    <div class="drawer-content" @click.stop>
      <!-- Header -->
      <div class="drawer-header">
        <h2>User Finance Details</h2>
        <button @click="close" class="drawer-close">×</button>
      </div>

      <!-- Body -->
      <div class="drawer-body">
        <div v-if="isLoading" class="loading-state">
          <p>Loading user finance data...</p>
        </div>

        <div v-else>
          <!-- User Info -->
          <div class="user-info" v-if="user">
            <h3>{{ user.name || user.email }}</h3>
            <p class="user-email">{{ user.email }}</p>
          </div>

          <!-- KPIs -->
          <div class="kpi-section">
            <FinanceKpiCards
              :metrics="userMetrics"
              :currency="currency"
            />
          </div>

          <!-- Transactions -->
          <div class="transactions-section">
            <h4>Recent Transactions</h4>

            <TransactionsTable
              :transactions="recentTransactions"
              :read-only="!isBoss"
              @view="handleViewTransaction"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useFinance } from '../../composables/useFinance';
import { fetchTransactions } from '../../services/finance';
import { useAuthStore } from '../../composables/useAuth';
import { isFinanceManagerUser } from '../../utils/financeAccess';

import FinanceKpiCards from '../finance/FinanceKpiCards.vue';
import TransactionsTable from '../finance/TransactionsTable.vue';

/* =========================
   PROPS
========================= */

const props = defineProps({
  userId: {
    type: String,
    required: true
  },
  users: {
    type: Array,
    required: true
  },
  month: {
    type: String,
    required: true
  },
  scope: {
    type: String,
    default: 'Monthly'
  },
  periodId: {
    type: String,
    default: null
  }
});

const emit = defineEmits(['close']);

/* =========================
   AUTH
========================= */

const authStore = useAuthStore();

const isBoss = computed(() => isFinanceManagerUser(authStore.user));

/* =========================
   FINANCE (ISOLATED)
========================= */

const { loadSummary } = useFinance();

/* =========================
   STATE
========================= */

const isLoading = ref(false);
const transactions = ref([]);

const userMetrics = ref({
  actualIncome: 0,
  pendingIncome: 0,
  actualExpense: 0,
  budgetedPerformance: 0,
  target: 0,
  gap: 0
});

/* =========================
   COMPUTED
========================= */

const currency = computed(() => 'USD');

const isOpen = computed(() => !!props.userId);

const user = computed(() =>
  props.users.find(u => u._id === props.userId) || null
);

const recentTransactions = computed(() =>
  transactions.value.slice(0, 10)
);

/* =========================
   METHODS
========================= */

const close = () => emit('close');

const handleViewTransaction = (tx) => {
  console.log('View transaction:', tx);
};

/* =========================
   LOAD USER DATA
========================= */

const loadUserData = async () => {
  if (!props.userId) return;

  isLoading.value = true;

  try {
    /* -------- Transactions (isolated) -------- */
    const txRes = await fetchTransactions({
      memberId: props.userId,
      month: props.scope === 'Monthly' ? props.month : undefined,
      limit: 50
    });

    transactions.value = txRes.ok
      ? txRes.data.transactions || []
      : [];

    /* -------- Summary (authoritative) -------- */
    const summaryFilters = {
      currency: 'USD',
      memberId: props.userId
    };

    if (props.scope === 'Monthly') {
      summaryFilters.month = props.month;
    }

    if (props.scope === 'Periodic' && props.periodId) {
      summaryFilters.periodId = props.periodId;
    }

    const res = await loadSummary(summaryFilters);

    userMetrics.value =
      res?.summary?.metrics ||
      res?.data?.summary?.metrics ||
      userMetrics.value;

  } catch (err) {
    console.error('UserFinanceDrawer load error:', err);
  } finally {
    isLoading.value = false;
  }
};

/* =========================
   WATCHERS
========================= */

watch(
  () => [props.userId, props.month, props.scope, props.periodId],
  loadUserData,
  { immediate: true }
);
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
  box-shadow: -4px 0 12px rgba(0, 0, 0, 0.15);
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

.user-info {
  margin-bottom: 24px;
  padding-bottom: 24px;
  border-bottom: 1px solid #e5e7eb;
}

.user-info h3 {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
  margin-bottom: 4px;
}

.user-email {
  color: #6b7280;
  font-size: 14px;
}

.kpi-section {
  margin-bottom: 24px;
}

.transactions-section h4 {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin-bottom: 16px;
}

.loading-state {
  text-align: center;
  padding: 48px;
  color: #6b7280;
}
</style>
