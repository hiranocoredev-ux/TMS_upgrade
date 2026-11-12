<template>
  <div class="modal-backdrop">
    <div class="modal" @click.stop>
      <div class="modal-header">
        <h3>{{ isEdit ? 'Edit Transaction' : 'Create Transaction' }}</h3>
        <button @click="close" class="modal-close">×</button>
      </div>

      <form @submit.prevent="save" class="modal-body">
        <!-- Two-step review state -->
        <p v-if="isEdit && blockedMessage" class="review-banner review-banner--locked" role="status">
          🔒 {{ blockedMessage }}
        </p>
        <p v-else-if="isEdit && rejectedNote" class="review-banner review-banner--rejected" role="status">
          <strong>Rejected:</strong> {{ rejectedNote }}<br />
          Fix it and save to resubmit it for approval.
        </p>
        <p v-else-if="isEdit && wasFmApproved" class="review-banner" role="status">
          Approved by the Finance Manager. Saving changes sends it back for Finance Manager approval.
        </p>

        <!-- User (only show when editing or if no selectedUserId) -->
        <div v-if="isEdit || !selectedUserId" class="form-group">
          <label>User *</label>
          <select v-model="form.userId" required ref="firstInput">
            <option value="">Select user</option>
            <option v-for="u in users" :key="u.id" :value="u.id">
              {{ u.name || u.email }}
            </option>
          </select>
        </div>

        <!-- Type -->
        <div class="form-group">
          <label>Type *</label>
          <select v-model="form.type" required ref="typeInput">
            <option value="income">Income</option>
            <option value="outcome">Outcome</option>
          </select>
        </div>

        <!-- Through team wallet? -->
        <div class="form-group">
          <label>Through Team Wallet?</label>
          <div class="radio-group">
            <label class="radio-option" :class="{ 'radio-option--active': form.throughTeamWallet === true }">
              <input type="radio" :value="true" v-model="form.throughTeamWallet" />
              <span>Yes</span>
            </label>
            <label class="radio-option" :class="{ 'radio-option--active': form.throughTeamWallet === false }">
              <input type="radio" :value="false" v-model="form.throughTeamWallet" />
              <span>No</span>
            </label>
          </div>
        </div>

        <!-- Is Tron? (income only; forced to Yes when not through the team wallet) -->
        <div v-if="form.type === 'income'" class="form-group">
          <label>Is Tron?</label>
          <div class="radio-group">
            <label
              class="radio-option"
              :class="{
                'radio-option--active': effectiveIsTron === true,
                'radio-option--locked': tronLocked
              }"
            >
              <input
                type="radio"
                name="isTron"
                :checked="effectiveIsTron === true"
                :disabled="tronLocked"
                @change="form.isTron = true"
              />
              <span>Yes</span>
            </label>
            <label
              class="radio-option"
              :class="{
                'radio-option--active': effectiveIsTron === false,
                'radio-option--locked': tronLocked
              }"
            >
              <input
                type="radio"
                name="isTron"
                :checked="effectiveIsTron === false"
                :disabled="tronLocked"
                @change="form.isTron = false"
              />
              <span>No</span>
            </label>
          </div>
          <p v-if="tronLocked" class="field-hint">
            Transactions outside the team wallet are always counted as Tron.
          </p>
        </div>

        <!-- Status -->
        <div class="form-group">
          <label>Status *</label>
          <select v-model="form.status" required>
            <option value="accepted">Accepted</option>
            <option value="pending">Pending</option>
            <option value="canceled">Canceled</option>
          </select>
        </div>

        <!-- Price (the recorded amount is derived from it) -->
        <div class="form-group">
          <label>Price *</label>
          <input
            v-model.number="form.inputPrice"
            type="number"
            step="0.01"
            min="0"
            required
          />
          <p class="amount-preview">
            Recorded amount:
            <strong>{{ formatCurrency(computedAmount, form.currency) }}</strong>
            <span v-if="!effectiveIsTron" class="amount-preview__rule">
              ({{ formatCurrency(form.inputPrice || 0, form.currency) }} × 0.98 — non-Tron)
            </span>
          </p>
        </div>

        <!-- Source (for income) -->
        <div v-if="form.type === 'income'" class="form-group">
          <label>Source *</label>
          <input v-model="form.source" required placeholder="e.g., Client ABC" />
        </div>

        <!-- Category (for outcome) -->
        <div v-if="form.type === 'outcome'" class="form-group">
          <label>Category *</label>
          <input v-model="form.category" required placeholder="e.g., Office Supplies" />
        </div>

        <!-- Description: what was received / paid and how -->
        <div class="form-group">
          <label for="transaction-description">Description *</label>
          <textarea
            id="transaction-description"
            v-model="form.description"
            rows="3"
            required
            :maxlength="MAX_DESCRIPTION_LENGTH"
            placeholder="e.g. Received 500 USDT from Client ABC via TRC-20 to the team wallet"
            :aria-invalid="descriptionError ? 'true' : 'false'"
            aria-describedby="transaction-description-hint"
            @input="descriptionError = ''"
          />
          <small v-if="descriptionError" id="transaction-description-hint" class="field-error">{{ descriptionError }}</small>
          <small v-else id="transaction-description-hint" class="field-hint">
            How much was received or paid, and how (coin, network, wallet, counterparty).
          </small>
        </div>

        <!-- Transaction URL -->
        <div class="form-group">
          <label for="transaction-url">Transaction URL *</label>
          <input
            id="transaction-url"
            v-model="form.transactionUrl"
            type="url"
            required
            inputmode="url"
            autocomplete="off"
            :maxlength="MAX_TRANSACTION_URL_LENGTH"
            placeholder="https://..."
            :aria-invalid="urlError ? 'true' : 'false'"
            aria-describedby="transaction-url-hint"
            @input="urlError = ''"
          />
          <small v-if="urlError" id="transaction-url-hint" class="field-error">{{ urlError }}</small>
          <small v-else id="transaction-url-hint" class="field-hint">
            Link to the transaction, e.g. the block explorer or payment page.
          </small>
        </div>

        <!-- Date -->
        <div class="form-group">
          <label>Date *</label>
          <DateSelector
            v-model="form.date"
          />
        </div>

        <!-- Currency -->
        <div class="form-group">
          <label>Currency</label>
          <select v-model="form.currency">
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
          </select>
        </div>

        <div class="form-actions">
          <button type="button" @click="close" class="btn-cancel">Cancel</button>
          <button type="submit" class="btn-primary" :disabled="saving || !!blockedMessage">
            {{ saving ? 'Saving...' : 'Save' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import { useFinance } from '../../composables/useFinance';
import { fetchUsers } from '../../services/users';
import { formatDateISO, formatCurrency } from '../../utils/financeHelpers';
import { resolveIsTron, deriveAmount } from '../../utils/tronHelpers';
import { getESTDateKey } from '../../utils/timezoneHelpers';
import DateSelector from './DateSelector.vue';
import {
  isTransactionUrl,
  MAX_DESCRIPTION_LENGTH,
  MAX_TRANSACTION_URL_LENGTH,
  TRANSACTION_URL_MESSAGE
} from '../../utils/transactionUrl';
import { REVIEW, reviewStageOf, lockedMessage } from '../../utils/transactionReview';

const props = defineProps({
  transaction: {
    type: Object,
    default: null
  },
  selectedUserId: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['saved', 'close']);

const { addTransaction, editTransaction } = useFinance();

const users = ref([]);
const saving = ref(false);
/** Shown under the Description / Transaction URL fields when missing or invalid. */
const descriptionError = ref('');
const urlError = ref('');

const isEdit = computed(() => !!props.transaction);

/* Two-step review state of the transaction being edited. */
const blockedMessage = computed(() => (props.transaction ? lockedMessage(props.transaction) : ''));
const rejectedNote = computed(() => {
  const t = props.transaction;
  if (!t || reviewStageOf(t) !== REVIEW.REJECTED) return '';
  const by = t.reviewRejectedByUserId && typeof t.reviewRejectedByUserId === 'object' ? t.reviewRejectedByUserId.name : '';
  return `${t.reviewRejectReason || 'No reason given'}${by ? ` (${by})` : ''}`;
});
const wasFmApproved = computed(() => !!props.transaction && reviewStageOf(props.transaction) === REVIEW.FM_APPROVED);

const form = ref({
  userId: '',
  type: 'income',
  status: 'accepted',
  inputPrice: 0,
  source: '',
  category: '',
  description: '',
  transactionUrl: '',
  throughTeamWallet: true,
  isTron: false,
  date: getESTDateKey(),
  currency: 'USD'
});

const typeInput = ref(null);

/* ======================
   TRON / AMOUNT DERIVATION
====================== */
// Outside the team wallet the transaction is always Tron, so the radio is
// locked to Yes and the stored flag no longer matters. (Expenses hide the
// radio entirely -- the fee only applies to income.)
const tronLocked = computed(() => form.value.throughTeamWallet === false);

const effectiveIsTron = computed(() =>
  resolveIsTron(
    form.value.type,
    form.value.throughTeamWallet,
    form.value.isTron
  )
);

const computedAmount = computed(() =>
  deriveAmount(form.value.inputPrice, effectiveIsTron.value)
);

/* ======================
   LOAD USERS (SAME AS MONTHLY)
====================== */
const loadUsers = async () => {
  try {
    const res = await fetchUsers();
    if (res.ok && res.data) {
      users.value = res.data.users || [];

      // Default selection only if no selectedUserId prop
      if (!props.selectedUserId && !form.value.userId && users.value.length > 0) {
        form.value.userId = users.value[0].id;
      }
    }
  } catch (err) {
    console.error('Error loading users:', err);
  }
};

/* ======================
   EDIT MODE INIT
====================== */
watch(
  () => props.transaction,
  (t) => {
    if (t) {
      form.value = {
        userId: typeof t.userId === 'object' ? t.userId.id : t.userId,
        type: t.type || 'income',
        status: t.status || 'accepted',
        // Legacy rows have no inputPrice -> the stored amount was the price.
        inputPrice: t.inputPrice != null ? t.inputPrice : (t.amount || 0),
        source: t.source || '',
        category: t.category || '',
        description: t.description || '',
        transactionUrl: t.transactionUrl || '',
        // Legacy rows have no value -> treat as true.
        throughTeamWallet: t.throughTeamWallet !== false,
        // Legacy rows have no value -> treat as not Tron.
        isTron: t.isTron === true,
        // Stored as UTC-midnight of the chosen day; read back the same calendar
        // day (matches how the table's formatDate renders it).
        date: String(t.date).split('T')[0],
        currency: t.currency || 'USD'
      };
    } else {
      // Reset form for create mode
      form.value = {
        userId: props.selectedUserId || '',
        type: 'income',
        status: 'accepted',
        inputPrice: 0,
        source: '',
        category: '',
        description: '',
        transactionUrl: '',
        throughTeamWallet: true,
        isTron: false,
        date: getESTDateKey(),
        currency: 'USD'
      };
    }
    descriptionError.value = '';
    urlError.value = '';
  },
  { immediate: true }
);

/* ======================
   SAVE
====================== */
const save = async () => {
  // Use selectedUserId if provided, otherwise use formData.userId
  const userId = props.selectedUserId || form.value.userId;
  
  if (!userId) {
    alert('Please select a user');
    return;
  }

  if (form.value.type === 'income' && !form.value.source) {
    alert('Source is required for income');
    return;
  }

  if (form.value.type === 'outcome' && !form.value.category) {
    alert('Category is required for expense');
    return;
  }

  // Both are required on every save, including edits of older transactions saved without them.
  const description = String(form.value.description || '').trim();
  const transactionUrl = String(form.value.transactionUrl || '').trim();
  descriptionError.value = description ? '' : 'Description is required';
  urlError.value = !transactionUrl
    ? 'Transaction URL is required'
    : isTransactionUrl(transactionUrl) ? '' : TRANSACTION_URL_MESSAGE;
  if (descriptionError.value || urlError.value) return;

  saving.value = true;

  try {
    const userId = props.selectedUserId || form.value.userId;
    const payload = {
      userId: userId,
      type: form.value.type,
      status: form.value.status,
      inputPrice: Number(form.value.inputPrice),
      // Derived client-side for an immediate preview; the server re-derives it.
      amount: computedAmount.value,
      currency: form.value.currency,
      description,
      transactionUrl,
      throughTeamWallet: form.value.throughTeamWallet,
      isTron: effectiveIsTron.value,
      date: formatDateISO(new Date(form.value.date))
    };

    if (form.value.type === 'income') {
      payload.source = form.value.source;
    } else {
      payload.category = form.value.category;
    }

    if (isEdit.value) {
      await editTransaction(props.transaction._id, payload);
    } else {
      await addTransaction(payload);
    }

    emit('saved');
  } catch (err) {
    alert(
      err?.response?.data?.message ||
      err?.message ||
      'Save failed'
    );
  } finally {
    saving.value = false;
  }
};

const close = () => emit('close');

const firstInput = ref(null);

// Sync form when selectedUserId changes (for create mode)
watch(
  () => props.selectedUserId,
  (userId) => {
    if (!isEdit.value && userId) {
      form.value.userId = userId;
    }
  },
  { immediate: true }
);

// Focus first input when modal opens
watch(() => props.transaction, async () => {
  await nextTick();
  // Focus user field if visible, otherwise focus type field
  const inputToFocus = firstInput.value || typeInput.value;
  if (inputToFocus) {
    inputToFocus.focus();
  }
}, { immediate: true });

onMounted(() => {
  loadUsers();
  nextTick(() => {
    const inputToFocus = firstInput.value || typeInput.value;
    if (inputToFocus) {
      inputToFocus.focus();
    }
  });
});
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal {
  background: var(--bg-primary);
  border-radius: 8px;
  width: 520px;
  max-width: 520px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: var(--shadow-xl);
  border: 1px solid var(--border-light);
}

@media (max-width: 560px) {
  .modal {
    width: calc(100vw - 40px);
    max-width: calc(100vw - 40px);
  }
}

.modal-header {
  padding: 20px 24px;
  border-bottom: 1px solid var(--border-light);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--bg-primary);
}

.modal-header h3 {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.modal-close {
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

.modal-close:hover {
  background: var(--bg-tertiary);
}

.modal-body {
  padding: 24px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border-medium);
  border-radius: 6px;
  font-size: 14px;
  font-family: inherit;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.form-group textarea {
  resize: vertical;
}

.radio-group {
  display: flex;
  gap: 10px;
}

.radio-option {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--border-medium);
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  transition: all 0.15s ease;
}

.radio-option:hover {
  border-color: var(--color-primary);
}

.radio-option--active {
  border-color: var(--color-primary);
  background: rgba(99, 102, 241, 0.08);
  color: var(--color-primary);
}

.radio-option--locked {
  cursor: not-allowed;
  opacity: 0.75;
}

.radio-option--locked:hover {
  border-color: var(--border-medium);
}

.radio-option--locked.radio-option--active:hover {
  border-color: var(--color-primary);
}

.radio-option input {
  width: auto;
  margin: 0;
  cursor: pointer;
}

.radio-option input:disabled {
  cursor: not-allowed;
}

.field-hint {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--text-tertiary);
}

.amount-preview {
  margin: 8px 0 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.amount-preview strong {
  color: var(--text-primary);
}

.amount-preview__rule {
  margin-left: 6px;
  font-size: 12px;
  color: var(--text-tertiary);
}

.review-banner {
  margin: 0 0 16px;
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-secondary);
  background: rgba(31, 78, 140, 0.08);
  border: 1px solid rgba(31, 78, 140, 0.2);
}

.review-banner--locked {
  color: var(--color-success, #1f7a4d);
  background: rgba(31, 122, 77, 0.08);
  border-color: rgba(31, 122, 77, 0.25);
}

.review-banner--rejected {
  color: var(--color-error, #b42318);
  background: rgba(180, 35, 24, 0.06);
  border-color: rgba(180, 35, 24, 0.25);
}

.field-hint,
.field-error {
  display: block;
  margin-top: 6px;
  font-size: 12px;
}

.field-hint {
  color: var(--text-tertiary);
}

.field-error {
  color: var(--color-error, #b42318);
}

.form-group input[aria-invalid='true'],
.form-group textarea[aria-invalid='true'] {
  border-color: var(--color-error, #b42318);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid var(--border-light);
}

.btn-primary {
  padding: 10px 20px;
  background: var(--color-primary);
  color: var(--text-inverse);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-dark);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-cancel {
  padding: 10px 20px;
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-medium);
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
}

.btn-cancel:hover {
  background: var(--bg-secondary);
}
</style>
