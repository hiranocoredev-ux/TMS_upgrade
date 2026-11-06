<template>
  <div
    v-if="isOpen"
    class="modal-overlay"
  >
    <div class="modal-content" @click.stop>
      <!-- Header -->
      <div class="modal-header">
        <h2>Edit Week</h2>
        <button class="modal-close" @click="close">×</button>
      </div>

      <!-- Body -->
      <div class="modal-body">
        <form @submit.prevent="save">
          <!-- Period Name -->
          <div class="form-group">
            <label>Period Name *</label>
            <input
              v-model="form.definition"
              type="text"
              required
              placeholder="e.g. Week 1, Sprint A"
              ref="firstInput"
            />
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
              <label>Start Date *</label>
              <DateSelector
                v-model="form.startDate"
              />
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
              {{ saving ? 'Saving…' : 'Save Changes' }}
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
import { useFinance } from '../../composables/useFinance';
import MonthSelector from './MonthSelector.vue';
import DateSelector from './DateSelector.vue';

/* -------------------- PROPS / EMITS -------------------- */

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true
  },
  period: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(['close', 'saved']);

/* -------------------- STATE -------------------- */

const { editPeriod } = useFinance();
const saving = ref(false);
const error = ref(null);

const form = ref({
  definition: '',
  month: '',
  startDate: '',
  endDate: ''
});

const firstInput = ref(null);

/* -------------------- METHODS -------------------- */

const close = () => {
  emit('close');
  error.value = null;
};

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

    await editPeriod(props.period._id, payload);

    emit('saved');
    close();
  } catch (err) {
    console.error(err);
    error.value =
      err?.response?.data?.message ||
      err?.message ||
      'Failed to update period';
  } finally {
    saving.value = false;
  }
};

// Sync form when period changes
watch(
  () => props.period,
  (period) => {
    if (period) {
      form.value = {
        definition: period.definition || '',
        month: period.month ? period.month.slice(0, 7) : '',
        startDate: period.startDate ? new Date(period.startDate).toISOString().slice(0, 10) : '',
        endDate: period.endDate ? new Date(period.endDate).toISOString().slice(0, 10) : ''
      };
    }
  },
  { immediate: true }
);

// Focus first input when modal opens
watch(() => props.isOpen, async (isOpen) => {
  if (isOpen) {
    await nextTick();
    if (firstInput.value) {
      firstInput.value.focus();
    }
  }
});

onMounted(() => {
  if (props.isOpen) {
    nextTick(() => {
      if (firstInput.value) {
        firstInput.value.focus();
      }
    });
  }
});
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

.form-error {
  padding: 12px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid var(--color-error);
  color: var(--color-error);
  border-radius: 6px;
  margin-bottom: 20px;
  font-size: 14px;
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
