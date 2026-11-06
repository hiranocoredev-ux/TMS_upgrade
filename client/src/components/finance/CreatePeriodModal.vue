<template>
  <div
    v-if="isOpen"
    class="modal-overlay"
  >
    <div class="modal-content" @click.stop>
      <!-- Header -->
      <div class="modal-header">
        <h2>Create Week</h2>
        <button class="modal-close" @click="close">×</button>
      </div>

      <!-- Body -->
      <div class="modal-body">
        <form @submit.prevent="save">
          <!-- Period Name -->
          <div class="form-group">
            <label>Week name *</label>
            <input
              v-model="form.definition"
              type="text"
              required
              placeholder="e.g. Sep-Week1"
              ref="firstInput"
            />
            <small class="form-hint">Named after the month and its number, like Sep-Week1. Change it if you want.</small>
          </div>

          <!-- Month -->
          <div class="form-group">
            <label>Month *</label>
            <MonthSelector
              v-model="form.month"
            />
          </div>

          <!-- Date Range -->
          <div class="form-row">
            <div class="form-group">
              <label>Start date *</label>
              <DateSelector
                v-model="form.startDate"
              />
              <small v-if="followsPrevious" class="form-hint">Follows {{ followsPrevious }}.</small>
            </div>

            <div class="form-group">
              <label>End Date *</label>
              <DateSelector
                v-model="form.endDate"
              />
            </div>
          </div>

          <!-- Error -->
          <div v-if="error" class="form-error">
            {{ error }}
          </div>

          <!-- Actions -->
          <div class="form-actions">
            <button
              type="button"
              class="btn-cancel"
              @click="close"
              :disabled="saving"
            >
              Cancel
            </button>

            <button
              type="submit"
              class="btn-primary"
              :disabled="saving"
            >
              {{ saving ? 'Creating…' : 'Create Period' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, onMounted } from 'vue';
import * as financeService from '../../services/finance';
import MonthSelector from './MonthSelector.vue';
import DateSelector from './DateSelector.vue';

/* -------------------- PROPS / EMITS -------------------- */

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true
  },
  /** Weeks that already exist, so the new one can follow the last of them. */
  periods: {
    type: Array,
    default: () => []
  },
  /** The month being managed; today's month when not given. */
  month: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['close', 'saved']);

/* -------------------- STATE -------------------- */

const saving = ref(false);
const error = ref(null);

const form = ref({
  definition: '',
  month: '',
  startDate: '',
  endDate: ''
});

/** Which week this one continues from, shown under the start date. */
const followsPrevious = ref('');

const dayKey = (date) => new Date(date).toISOString().slice(0, 10);
const addDays = (date, days) => {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
};

const monthShort = (monthKey) => {
  const [, m] = String(monthKey).split('-').map(Number);
  return new Date(Date.UTC(2000, (m || 1) - 1, 1)).toLocaleDateString('en-US', {
    month: 'short',
    timeZone: 'UTC',
  });
};

/**
 * A new week picks up the day after the last one ends, is named for its month
 * and number (Sep-Week1, Sep-Week2, …) and runs seven days. Everything stays
 * editable.
 */
const seedForm = () => {
  const today = new Date();
  const month =
    props.month ||
    `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}`;

  const sorted = [...(props.periods || [])].sort(
    (a, b) => new Date(a.startDate) - new Date(b.startDate),
  );
  const previous = sorted[sorted.length - 1];

  const start = previous ? addDays(previous.endDate, 1) : new Date(`${month}-01T00:00:00Z`);
  followsPrevious.value = previous ? `${previous.definition} (ends ${dayKey(previous.endDate)})` : '';

  // A week that starts after the last one may well belong to the next month;
  // it is named and numbered for the month it actually starts in.
  const startMonth = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}`;
  const sameMonth = sorted.filter((p) => p.month === startMonth);

  form.value = {
    definition: `${monthShort(startMonth)}-Week${sameMonth.length + 1}`,
    month: startMonth,
    startDate: dayKey(start),
    endDate: dayKey(addDays(start, 6)),
  };
};

/* -------------------- METHODS -------------------- */

const close = () => {
  emit('close');
};

const firstInput = ref(null);

// Seed the dates and name, then focus, whenever the dialog opens
watch(
  () => props.isOpen,
  async (isOpen) => {
    if (!isOpen) return;
    seedForm();
    error.value = null;
    await nextTick();
    if (firstInput.value) {
      firstInput.value.focus();
    }
  },
);

onMounted(() => {
  if (props.isOpen) {
    seedForm();
    nextTick(() => {
      if (firstInput.value) {
        firstInput.value.focus();
      }
    });
  }
});

const save = async () => {
  error.value = null;

  if (new Date(form.value.startDate) > new Date(form.value.endDate)) {
    error.value = 'Start date must be before or equal to end date';
    return;
  }

  saving.value = true;

  try {
    const payload = {
      definition: form.value.definition,
      month: form.value.month,
      startDate: new Date(
        `${form.value.startDate}T00:00:00Z`
      ).toISOString(),
      endDate: new Date(
        `${form.value.endDate}T23:59:59Z`
      ).toISOString()
    };

    await financeService.createPeriod(payload);

    emit('saved');
    close();
  } catch (err) {
    console.error(err);
    error.value =
      err?.response?.data?.message ||
      'Failed to create period';
  } finally {
    saving.value = false;
  }
};
</script>

<style scoped>
.modal-overlay {
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

.modal-content {
  background: var(--bg-primary);
  border-radius: 8px;
  width: 500px;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: var(--shadow-xl);
  border: 1px solid var(--border-light);
}

@media (max-width: 550px) {
  .modal-content {
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

.modal-header h2 {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
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
  background: var(--bg-primary);
  color: var(--text-primary);
}

.form-group textarea {
  resize: vertical;
  font-family: inherit;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
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
