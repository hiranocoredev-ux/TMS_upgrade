<template>
  <div v-if="isOpen" class="modal-overlay">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h2>{{ isEditing ? 'Edit Monthly Plan' : 'Create Monthly Plan' }}</h2>
        <button @click="close" class="modal-close">×</button>
      </div>

      <div class="modal-body">
        <form @submit.prevent="save">
          <!-- User (only show when editing or if no selectedUserId) -->
          <div v-if="isEditing || !selectedUserId" class="form-group">
            <label>User *</label>
            <select
              v-model="formData.userId"
              required
              :disabled="isEditing"
              ref="firstInput"
            >
              <option value="">Select User</option>
              <option
                v-for="user in users"
                :key="user.id"
                :value="user.id"
              >
                {{ user.name || user.email }}
              </option>
            </select>
          </div>

          <!-- Month -->
          <div class="form-group">
            <label>Month *</label>
            <MonthSelector
              v-model="formData.month"
              :disabled="isEditing"
            />
          </div>

          <!-- Goal -->
          <div class="form-group">
            <label>Monthly Financial Goal *</label>
            <input
              v-model.number="formData.monthlyFinancialGoal"
              type="number"
              min="0"
              step="0.01"
              required
            />
          </div>

          <!-- Note -->
          <div class="form-group">
            <label>Note</label>
            <ReportRichEditor
              v-model="formData.note"
              class="plan-note-editor"
            />
          </div>

          <!-- Actions -->
          <div class="form-actions">
            <button
              type="button"
              class="btn-cancel"
              @click="close"
            >
              Cancel
            </button>

            <button
              type="submit"
              class="btn-primary"
              :disabled="saving || !isValid"
            >
              {{ saving ? 'Saving…' : 'Save' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue';
import { useFinance } from '../../composables/useFinance';
import { fetchUsers } from '../../services/users';
import MonthSelector from './MonthSelector.vue';
import ReportRichEditor from '../reports/ReportRichEditor.vue';

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true
  },
  plan: {
    type: Object,
    default: null
  },
  selectedUserId: {
    type: String,
    default: ''
  },
  /** Preselects the month when the dialog is opened from a month column. */
  defaultMonth: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['close', 'saved']);

const { addMonthlyPlan, editMonthlyPlan } = useFinance();

const users = ref([]);
const saving = ref(false);

const isEditing = computed(() => !!props.plan?._id);

const formData = ref({
  userId: '',
  month: '',
  monthlyFinancialGoal: 0,
  note: ''
});
const close = () => {
  emit('close');
};
const isValid = computed(() => {
  const hasUserId = props.selectedUserId || formData.value.userId;
  return !!hasUserId &&
    !!formData.value.month &&
    formData.value.monthlyFinancialGoal >= 0;
});
function resetForm() {
  formData.value = {
    userId: props.selectedUserId || '',
    // Opened from a month column, that month is already the one being planned.
    month: props.defaultMonth || '',
    monthlyFinancialGoal: 0,
    note: ''
  };
};
/* Sync form when plan changes */
watch(
  () => props.plan,
  (plan) => {
    if (plan) {
      formData.value = {
        userId:
          typeof plan.userId === 'object'
            ? plan.userId._id
            : plan.userId,
        month: plan.month ? plan.month.slice(0, 7) : '',
        monthlyFinancialGoal: plan.monthlyFinancialGoal,
        note: plan.note || ''
      };
    } else {
      resetForm();
    }
  },
  { immediate: true }
);

/* Sync form when the caller changes the member or month (create mode) */
watch(
  () => [props.selectedUserId, props.defaultMonth, props.isOpen],
  ([userId, month, isOpen]) => {
    if (isEditing.value || !isOpen) return;
    if (userId) formData.value.userId = userId;
    if (month) formData.value.month = month;
  },
  { immediate: true }
);

const save = async () => {
  try {
    saving.value = true;

    if (isEditing.value) {
      await editMonthlyPlan(props.plan._id, {
        monthlyFinancialGoal: formData.value.monthlyFinancialGoal,
        note: formData.value.note
      });
    } else {
      // Use selectedUserId if provided, otherwise use formData.userId
      const userId = props.selectedUserId || formData.value.userId;
      await addMonthlyPlan({
        ...formData.value,
        userId
      });
    }

    emit('saved');
    close();
  } catch (err) {
    console.error('Error saving monthly plan:', err);
    alert(err.message || 'Failed to save monthly plan');
  } finally {
    saving.value = false;
  }
};

const loadUsers = async () => {
  try {
    const response = await fetchUsers();
    if (response?.ok) {
      users.value = response.data?.users || [];
    }
  } catch (err) {
    console.error('Error loading users:', err);
  }
};

const firstInput = ref(null);

// Focus first input when modal opens
watch(() => props.isOpen, async (isOpen) => {
  if (isOpen) {
    await nextTick();
    // Focus user field if visible
    if (firstInput.value) {
      firstInput.value.focus();
    }
  }
});

onMounted(() => {
  loadUsers();
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
  width: 450px;
  max-width: 450px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: var(--shadow-xl);
  border: 1px solid var(--border-light);
}

@media (max-width: 500px) {
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

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.form-group input:disabled,
.form-group select:disabled {
  background: var(--bg-tertiary);
  cursor: not-allowed;
}

.form-group textarea {
  resize: vertical;
  font-family: inherit;
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
