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
          <th>Link</th>
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
          <td class="status-cell">
            <StatusChip :status="transaction.status" />
            <span
              class="review-badge"
              :class="`is-${reviewBadge(transaction).key}`"
              :title="reviewBadge(transaction).title"
            >
              <span v-if="reviewBadge(transaction).key === 'locked'" aria-hidden="true">🔒 </span>{{ reviewBadge(transaction).label }}
            </span>
            <span v-if="!countsInTotals(transaction)" class="not-counted">Not in totals yet</span>
          </td>
          <td class="source-cell">
            <span>{{ transaction.source || transaction.category || '-' }}</span>
            <span
              v-if="transaction.description"
              class="tx-description"
              :title="transaction.description"
            >{{ transaction.description }}</span>
          </td>
          <td class="link-cell">
            <a
              v-if="transactionLink(transaction)"
              :href="transactionLink(transaction)"
              target="_blank"
              rel="noopener noreferrer"
              class="tx-link"
              :title="transactionLink(transaction)"
            >Open ↗</a>
            <span v-else class="tx-link--missing" title="No transaction URL yet — add one by editing">—</span>
          </td>
          <td v-if="!readOnly" class="actions-col">
            <div class="actions-cell">
              <button
                v-if="transaction.status === 'pending' && canChangeStatus(transaction, currentUser)"
                @click="$emit('accept', transaction)"
                class="btn-action btn-accept"
                title="Accept"
                aria-label="Accept"
              >
                ✓
              </button>
              <button
                v-if="transaction.status !== 'canceled' && canChangeStatus(transaction, currentUser)"
                @click="$emit('cancel', transaction)"
                class="btn-action btn-cancel"
                title="Cancel"
                aria-label="Cancel"
              >
                ✕
              </button>
              <button
                v-if="canEditTransaction(transaction, currentUser)"
                @click="$emit('edit', transaction)"
                class="btn-action btn-edit"
                title="Edit"
                aria-label="Edit"
              >
                ✎
              </button>
              <span
                v-else
                class="lock-note"
                role="img"
                :title="lockedMessage(transaction)"
                :aria-label="lockedMessage(transaction)"
              >🔒</span>
            </div>
            <div v-if="hasReviewActions(transaction)" class="review-actions">
              <button
                v-if="reviewActionsFor(transaction, currentUser).fmApprove"
                type="button"
                class="btn-review btn-review--approve"
                :disabled="busyId === transaction._id"
                @click="runReview(transaction, 'fm-approve')"
              >Approve</button>
              <button
                v-if="reviewActionsFor(transaction, currentUser).adminApprove"
                type="button"
                class="btn-review btn-review--approve"
                :disabled="busyId === transaction._id"
                @click="runReview(transaction, 'admin-approve')"
              >Final approve</button>
              <button
                v-if="reviewActionsFor(transaction, currentUser).reject"
                type="button"
                class="btn-review btn-review--reject"
                :disabled="busyId === transaction._id"
                @click="runReview(transaction, 'reject')"
              >Reject</button>
              <button
                v-if="reviewActionsFor(transaction, currentUser).unlock"
                type="button"
                class="btn-review"
                :disabled="busyId === transaction._id"
                @click="runReview(transaction, 'unlock')"
              >Unlock</button>
            </div>
          </td>
        </tr>
        <tr v-if="transactions.length === 0">
          <td :colspan="readOnly ? 7 : 8" class="empty-state">No transactions found</td>
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
              <span v-if="uncountedCount > 0" class="uncounted-note">
                {{ uncountedCount }} {{ uncountedCount === 1 ? 'transaction is' : 'transactions are' }}
                waiting for approval and not included.
              </span>
            </div>
          </td>
          <td :colspan="readOnly ? 3 : 4"></td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { formatCurrency, formatDate, getTransactionTypeLabel } from '../../utils/financeHelpers';
import { transactionIsTron } from '../../utils/tronHelpers';
import StatusChip from '../../components/finance/StatusChip.vue';
import { transactionLink } from '../../utils/transactionUrl';
import { useAuthStore } from '../../composables/useAuth';
import { reviewTransaction } from '../../services/finance';
import {
  reviewBadge,
  reviewActionsFor,
  canEditTransaction,
  canChangeStatus,
  lockedMessage,
  countsInTotals
} from '../../utils/transactionReview';

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

const emit = defineEmits(['edit', 'accept', 'cancel', 'view', 'changed']);

/* ---------- Two-step review (finance manager, then admin) ---------- */
const authStore = useAuthStore();
const currentUser = computed(() => authStore.user);
/** Transaction whose review action is in flight (its buttons wait). */
const busyId = ref('');

const hasReviewActions = (t) => Object.values(reviewActionsFor(t, currentUser.value)).some(Boolean);

const REVIEW_PROMPTS = {
  'fm-approve': { confirm: 'Approve this transaction as Finance Manager? It then goes to the Admin for final approval.' },
  'admin-approve': { confirm: 'Give final approval? The transaction will be locked and can no longer be edited or deleted.' },
  reject: { reason: 'Why is this transaction rejected? (The creator sees this and can fix and resubmit it.)' },
  unlock: { reason: 'Why unlock this approved transaction? It will need Finance Manager and Admin approval again.' }
};

const runReview = async (transaction, action) => {
  const prompts = REVIEW_PROMPTS[action];
  let reason;
  if (prompts.reason) {
    reason = window.prompt(prompts.reason, '');
    if (reason === null) return;
    reason = reason.trim();
    if (!reason) {
      window.alert('A reason is required.');
      return;
    }
  } else if (!window.confirm(prompts.confirm)) {
    return;
  }
  busyId.value = transaction._id;
  try {
    // The API client shows the success or error message.
    await reviewTransaction(transaction._id, action, reason);
    emit('changed', transaction);
  } catch {
    // A 409 means someone else moved it on first; reload to show the current state.
    emit('changed', transaction);
  } finally {
    busyId.value = '';
  }
};

// A transaction counts as "team wallet" unless explicitly flagged false
// (legacy rows without the field are treated as team wallet).
const isTeamWallet = (t) => t.throughTeamWallet !== false;

// Spell out the "price × 0.98" arithmetic on non-Tron rows so the recorded
// amount is traceable back to what was entered. Legacy rows that predate the
// migration have no inputPrice, so there is nothing to show.
const showPrice = (t) => !transactionIsTron(t) && t.inputPrice != null;

// Totals skip transactions that are not counted yet (new ones awaiting full approval).
const uncountedCount = computed(
  () => props.transactions.filter(t => t.status !== 'canceled' && !countsInTotals(t)).length
);

const sumBy = (type, walletFilter) =>
  props.transactions
    .filter(t => t.type === type && t.status !== 'canceled' && countsInTotals(t))
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

.source-cell {
  max-width: 280px;
}

/* What was received / paid and how — two lines here, full text on hover. */
.tx-description {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-top: 2px;
  font-size: 12px;
  line-height: 1.4;
  color: var(--text-tertiary);
  overflow-wrap: anywhere;
}

.link-cell {
  white-space: nowrap;
}

.tx-link {
  font-weight: 600;
  color: var(--color-primary, #1f4e8c);
  text-decoration: none;
}

.tx-link:hover,
.tx-link:focus-visible {
  text-decoration: underline;
}

.tx-link--missing {
  color: var(--text-tertiary);
}

.actions-cell {
  display: flex;
  gap: 4px;
}

/* ---------- Two-step review ---------- */
.status-cell {
  white-space: nowrap;
}

.review-badge {
  display: block;
  width: fit-content;
  margin-top: 6px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.6;
  border: 1px solid transparent;
}

/* Waiting for the finance manager: neutral. */
.review-badge.is-awaiting {
  color: var(--text-secondary);
  background: var(--bg-tertiary, rgba(100, 116, 139, 0.1));
  border-color: var(--border-light);
}

/* Finance manager approved, waiting for admin: blue. */
.review-badge.is-fm {
  color: var(--color-primary, #1f4e8c);
  background: rgba(31, 78, 140, 0.1);
  border-color: rgba(31, 78, 140, 0.25);
}

/* Fully approved and locked: green. */
.review-badge.is-locked {
  color: var(--color-success, #1f7a4d);
  background: rgba(31, 122, 77, 0.1);
  border-color: rgba(31, 122, 77, 0.25);
}

/* Rejected, back with the creator: red. */
.review-badge.is-rejected {
  color: var(--color-error, #b42318);
  background: rgba(180, 35, 24, 0.08);
  border-color: rgba(180, 35, 24, 0.25);
}

.not-counted {
  display: block;
  margin-top: 4px;
  font-size: 11px;
  color: var(--text-tertiary);
}

.uncounted-note {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-tertiary);
}

.lock-note {
  display: inline-flex;
  align-items: center;
  padding: 4px 6px;
  font-size: 14px;
  cursor: help;
}

.review-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}

.btn-review {
  padding: 3px 8px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  background: transparent;
  border: 1px solid var(--border-medium, #cbd5e1);
  border-radius: 6px;
  cursor: pointer;
}

.btn-review:hover:not(:disabled) {
  color: var(--text-primary);
  border-color: var(--text-tertiary);
}

.btn-review--approve {
  color: var(--color-success, #1f7a4d);
  border-color: rgba(31, 122, 77, 0.4);
}

.btn-review--reject {
  color: var(--color-error, #b42318);
  border-color: rgba(180, 35, 24, 0.4);
}

.btn-review:disabled {
  opacity: 0.5;
  cursor: default;
}

.btn-review:focus-visible,
.btn-action:focus-visible {
  outline: 2px solid var(--color-primary, #1f4e8c);
  outline-offset: 1px;
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
