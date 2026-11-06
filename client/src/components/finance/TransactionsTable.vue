<template>
  <div class="transactions-table-container">
    <table class="transactions-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>User</th>
          <th>Type</th>
          <th>Amount</th>
          <th>Status</th>
          <th>Source</th>
          <th v-if="!readOnly">Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="transaction in transactions"
          :key="transaction._id"
          :class="getRowClass(transaction)"
        >
          <td>{{ formatDate(transaction.date) }}</td>
          <td>{{ getUserName(transaction.userId) }}</td>
          <td>
            <span :class="['type-badge', transaction.type]">
              {{ getTransactionTypeLabel(transaction.type) }}
            </span>
            <span
              v-if="transaction.throughTeamWallet === false"
              class="wallet-badge"
              title="Not through the team wallet"
            >
              Non-Wallet
            </span>
            <span
              v-if="!transactionIsTron(transaction)"
              class="tron-badge"
              title="Not Tron — recorded at price × 0.98"
            >
              Non-Tron
            </span>
          </td>
          <td :class="transaction.type === 'income' ? 'income-value' : 'expense-value'">
            {{ formatCurrency(transaction.amount, transaction.currency) }}
            <span v-if="showPrice(transaction)" class="price-note">
              ({{ formatCurrency(transaction.inputPrice, transaction.currency) }} × 0.98)
            </span>
          </td>
          <td>
            <StatusChip :status="transaction.status" />
          </td>
          <td>{{ transaction.source || transaction.category || '-' }}</td>
          <td v-if="!readOnly" class="actions-cell">
            <button
              v-if="transaction.status === 'pending'"
              @click="$emit('accept', transaction)"
              class="btn-action btn-accept"
              title="Accept"
            >
              ✓
            </button>
            <button
              v-if="transaction.status !== 'canceled'"
              @click="$emit('cancel', transaction)"
              class="btn-action btn-cancel"
              title="Cancel"
            >
              ✕
            </button>
            <button
              @click="$emit('edit', transaction)"
              class="btn-action btn-edit"
              title="Edit"
            >
              ✎
            </button>
          </td>
        </tr>
        <tr v-if="transactions.length === 0">
          <td :colspan="readOnly ? 6 : 7" class="empty-state">No transactions found</td>
        </tr>
        <!-- Total Row -->
        <tr v-if="transactions.length > 0" class="total-row">
          <td colspan="3" class="total-label"><strong>Total</strong></td>
          <td class="total-amount">
            <div class="total-breakdown">
              <span class="income-total">
                Income: {{ formatCurrency(totalIncome, defaultCurrency) }}
                <span class="wallet-split">
                  (Team Wallet: {{ formatCurrency(incomeWallet, defaultCurrency) }}
                  + No Wallet: {{ formatCurrency(incomeNoWallet, defaultCurrency) }})
                </span>
              </span>
              <span class="expense-total">
                Expense: {{ formatCurrency(totalExpense, defaultCurrency) }}
                <span class="wallet-split">
                  (Team Wallet: {{ formatCurrency(expenseWallet, defaultCurrency) }}
                  + No Wallet: {{ formatCurrency(expenseNoWallet, defaultCurrency) }})
                </span>
              </span>
              <span :class="['net-total', netTotal >= 0 ? 'income-value' : 'expense-value']">
                Net: {{ formatCurrency(netTotal, defaultCurrency) }}
              </span>
            </div>
          </td>
          <td colspan="3"></td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { formatCurrency, formatDate, getTransactionTypeLabel } from '../../utils/financeHelpers';
import { transactionIsTron } from '../../utils/tronHelpers';
import StatusChip from '../../components/finance/StatusChip.vue';

const props = defineProps({
  transactions: {
    type: Array,
    default: () => []
  },
  readOnly: {
    type: Boolean,
    default: false
  },
  users: {
    type: Array,
    default: () => []
  }
});

defineEmits(['edit', 'accept', 'cancel', 'view']);

// A transaction counts as "team wallet" unless explicitly flagged false
// (legacy rows without the field are treated as team wallet).
const isTeamWallet = (t) => t.throughTeamWallet !== false;

// Spell out the "price × 0.98" arithmetic on non-Tron rows so the recorded
// amount is traceable back to what was entered. Legacy rows that predate the
// migration have no inputPrice, so there is nothing to show.
const showPrice = (t) => !transactionIsTron(t) && t.inputPrice != null;

const sumBy = (type, walletFilter) =>
  props.transactions
    .filter(t => t.type === type && t.status !== 'canceled')
    .filter(t => walletFilter == null || isTeamWallet(t) === walletFilter)
    .reduce((sum, t) => sum + (t.amount || 0), 0);

// Calculate totals (with team-wallet / no-wallet breakdown)
const totalIncome = computed(() => sumBy('income', null));
const incomeWallet = computed(() => sumBy('income', true));
const incomeNoWallet = computed(() => sumBy('income', false));

const totalExpense = computed(() => sumBy('outcome', null));
const expenseWallet = computed(() => sumBy('outcome', true));
const expenseNoWallet = computed(() => sumBy('outcome', false));

const netTotal = computed(() => {
  return totalIncome.value - totalExpense.value;
});

const defaultCurrency = computed(() => {
  // Get the most common currency from transactions, default to USD
  if (props.transactions.length === 0) return 'USD';
  const currencies = props.transactions.map(t => t.currency || 'USD');
  const counts = {};
  currencies.forEach(c => {
    counts[c] = (counts[c] || 0) + 1;
  });
  return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b, 'USD');
});

const getUserName = (userId) => {
  if (typeof userId === 'object' && userId !== null) {
    return userId.name || userId.email || 'Unknown';
  }
  const user = props.users.find(u => u._id === userId);
  return user?.name || user?.email || 'Unknown User';
};

const getRowClass = (transaction) => {
  return {
    'row-canceled': transaction.status === 'canceled',
    'row-pending': transaction.status === 'pending'
  };
};
</script>

<style scoped>
.transactions-table-container {
  overflow-x: auto;
}

.transactions-table {
  width: 100%;
  border-collapse: collapse;
  background: var(--bg-primary);
}

.transactions-table thead {
  background: var(--bg-tertiary);
}

.transactions-table th {
  padding: 12px;
  text-align: left;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 2px solid var(--border-light);
}

.transactions-table td {
  padding: 12px;
  border-bottom: 1px solid var(--border-light);
  font-size: 14px;
  color: var(--text-primary);
}

.row-canceled {
  opacity: 0.5;
}

.row-pending {
  background-color: rgba(251, 191, 36, 0.1);
}

.type-badge {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.type-badge.income {
  background-color: rgba(16, 185, 129, 0.2);
  color: var(--color-success);
}

.type-badge.outcome {
  background-color: rgba(239, 68, 68, 0.2);
  color: var(--color-error);
}

.wallet-badge {
  display: inline-block;
  margin-left: 6px;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  background-color: rgba(245, 158, 11, 0.18);
  color: #b45309;
  white-space: nowrap;
}

.tron-badge {
  display: inline-block;
  margin-left: 6px;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  background-color: rgba(107, 114, 128, 0.18);
  color: var(--text-secondary);
}

.price-note {
  margin-left: 4px;
  font-size: 11px;
  font-weight: 400;
  color: var(--text-tertiary);
  white-space: nowrap;
}

.income-value {
  color: var(--color-success);
  font-weight: 500;
}

.expense-value {
  color: var(--color-error);
  font-weight: 500;
}

.actions-cell {
  display: flex;
  gap: 4px;
}

.btn-action {
  padding: 4px 8px;
  border: 1px solid var(--border-medium);
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.btn-action:hover {
  background: var(--bg-secondary);
}

.btn-accept:hover {
  background: rgba(16, 185, 129, 0.2);
  border-color: var(--color-success);
}

.btn-cancel:hover {
  background: rgba(239, 68, 68, 0.2);
  border-color: var(--color-error);
}

.btn-edit:hover {
  background: rgba(99, 102, 241, 0.2);
  border-color: var(--color-primary);
}

.empty-state {
  text-align: center;
  color: var(--text-tertiary);
  padding: 24px;
}

.total-row {
  background-color: var(--bg-tertiary);
  border-top: 2px solid #e5e7eb;
  font-weight: 600;
}

.total-label {
  text-align: right;
  padding: 16px 12px;
  color: var(--text-primary);
}

.total-amount {
  padding: 16px 12px;
}

.total-breakdown {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: flex-end;
}

.income-total {
  color: #10b981;
  font-weight: 500;
}

.expense-total {
  color: #ef4444;
  font-weight: 500;
}

.wallet-split {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-tertiary);
}

.net-total {
  font-weight: 600;
  font-size: 15px;
  margin-top: 4px;
  padding-top: 4px;
  border-top: 1px solid #e5e7eb;
}
</style>
