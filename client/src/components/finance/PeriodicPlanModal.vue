<template>
  <div v-if="isOpen" class="modal-overlay">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h2>{{ isEditing ? 'Edit Week Plan' : 'Create Week Plan' }}</h2>
        <button @click="close" class="modal-close">×</button>
      </div>
      <div class="modal-body">
        <form @submit.prevent="save">
          <div class="form-group">
            <label>User *</label>
            <select v-model="formData.userId" required :disabled="isEditing" ref="firstInput">
              <option value="">Select User</option>
              <option v-for="user in userOptions" :key="user.id" :value="user.id">
                {{ user.name || user.email }}
              </option>
            </select>
          </div>
          <!-- <div class="form-group">
            <label>Week*</label>
            <input type="text" v-model="formData.definition" placeholder="Optional note..." required />
          </div> -->
          <div class="form-group">
            <label>Period *</label>
            <select v-model="formData.periodId" required :disabled="isEditing">
              <option value="">Select Period</option>
              <option v-for="period in periods" :key="period._id" :value="period._id">
                {{ period.definition }}
                ({{ formatDate(period.startDate) }} – {{ formatDate(period.endDate) }})
              </option>
            </select>
          </div>
          <div class="form-group">
            <label>Target *</label>
            <input type="number" min="0" step="0.01" v-model.number="formData.periodicFinancialGoal" required />

            <p v-if="remaining !== null" class="plan-remaining">
              <span>Remaining this month: <strong>{{ formatMoney(remaining) }}</strong></span>
              <span class="plan-remaining__hint">
                the month's plan minus the income already booked in the earlier weeks
              </span>
            </p>

            <p v-if="lastWeekShort" class="plan-warning" role="alert">
              This is the month's last week, so its target has to cover what is left —
              {{ formatMoney(remaining) }} or more.
            </p>
          </div>
          <div class="form-group">
            <label>Note</label>
            <ReportRichEditor v-model="formData.note" class="plan-note-editor" />
          </div>
          <div class="form-actions">
            <button type="button" @click="close" class="btn-cancel">Cancel</button>
            <button v-if="!isReadOnlyAdmin" type="submit" class="btn-primary" :disabled="saving">
              {{ saving ? 'Saving...' : 'Save' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch, nextTick } from 'vue';
import { useFinance } from '../../composables/useFinance';
import { fetchUsers } from '../../services/users';
import { useAuthStore } from '../../composables/useAuth';
import { canManageAllFinance, isSystemAdminRole } from '../../constants/roles';
import { excludeSuperAdmin } from '../../utils/userFilters';
import { formatDate } from '../../utils/financeHelpers';
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
  periods: {
    type: Array,
    default: () => []
  },
  /** Preselected member and week when opened from the overview grid. */
  defaultUserId: {
    type: String,
    default: ''
  },
  defaultPeriodId: {
    type: String,
    default: ''
  },
  /** Month plan minus the income booked in the earlier weeks; null when unknown. */
  remaining: {
    type: Number,
    default: null
  },
  /** The last week of the month has to carry whatever is left. */
  isLastWeek: {
    type: Boolean,
    default: false
  }
});
const emit = defineEmits(['close', 'saved']);

const { addPeriodicPlan, editPeriodicPlan, loading } = useFinance();
const users = ref([]);
const saving = ref(false);

const isEditing = computed(() => !!props.plan?._id);

const formatMoney = (value) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
    Number(value) || 0,
  );

/** True while the last week of the month is planned below what is left. */
const lastWeekShort = computed(
  () =>
    props.isLastWeek &&
    props.remaining !== null &&
    Number(formData.value.periodicFinancialGoal) < props.remaining,
);

const formData = ref({
  userId: '',
  periodId: '',
  periodicFinancialGoal: 0,
  note: ''
});

const close = () => {
  emit('close');
};

const save = async () => {
  if (saving.value) return;
  // Admin (SYSTEM_ADMIN) is finance read-only: never creates or edits week plans.
  if (isReadOnlyAdmin.value) return;

  if (!formData.value.periodId) {
    alert('Period is required');
    return;
  }

  if (lastWeekShort.value) {
    alert(
      `The last week of the month has to carry what is left: ${formatMoney(props.remaining)} or more.`,
    );
    return;
  }

  saving.value = true;

  try {
    const payload = {
      userId: formData.value.userId,
      periodId: formData.value.periodId,
      periodicFinancialGoal: Number(formData.value.periodicFinancialGoal),
      note: formData.value.note
    };

    if (isEditing.value) {
      await editPeriodicPlan(props.plan._id, payload);
    } else {
      await addPeriodicPlan(payload);
    }

    emit('saved');
    close();
  } catch (err) {
    console.error('Failed to save periodic plan', err);
    alert(
      err?.response?.data?.message ||
      err?.message ||
      'Failed to save periodic plan'
    );
  } finally {
    saving.value = false;
  }
};

/* Load users */

const authStore = useAuthStore();
/** Super admin or finance manager: may plan for every team. */
const isSuperAdmin = computed(() => canManageAllFinance(authStore.user?.role, authStore.user?.degree));
/** Admin (SYSTEM_ADMIN): finance read-only, so the modal never saves. */
const isReadOnlyAdmin = computed(() => isSystemAdminRole(authStore.user?.role, authStore.user?.degree));

/**
 * Users the viewer may plan for: super admin / finance manager -> every user,
 * group boss -> own group only (the server enforces the same rule). Super admins
 * and finance managers are never planned for.
 */
const loadUsers = async () => {
  try {
    const ownGroup = authStore.user?.group;
    if (!isSuperAdmin.value && !ownGroup) {
      users.value = [];
      return;
    }
    const response = await fetchUsers(isSuperAdmin.value ? { limit: 1000 } : { limit: 1000, group: ownGroup });
    if (response.ok && response.data) {
      users.value = excludeSuperAdmin(response.data.users || []);
      if (!isEditing.value && !formData.value.userId && !props.defaultUserId && users.value.length > 0) {
        formData.value.userId = users.value[0].id;
      }
    }
  } catch (err) {
    console.error('Error loading users:', err);
  }
};

/** Selectable users; when editing, keep the plan's own user visible even if outside the list. */
const userOptions = computed(() => {
  const planUser = props.plan?.userId;
  if (isEditing.value && planUser && typeof planUser === 'object') {
    const id = String(planUser._id);
    if (!users.value.some((u) => String(u.id) === id)) {
      return [{ id, name: planUser.name, email: planUser.email }, ...users.value];
    }
  }
  return users.value;
});
function resetForm() {
  formData.value = {
    userId: '',
    periodId: '',
    periodicFinancialGoal: 0,
    note: ''
  };
};
/* Sync form when plan changes */
watch(
  () => props.plan,
  (plan) => {
    if (plan) {
      formData.value = {
        userId: typeof plan.userId === 'object' ? plan.userId._id : plan.userId,
        periodId: plan.periodId?._id || plan.periodId,
        periodicFinancialGoal: plan.periodicFinancialGoal,
        note: plan.note || ''
      };
    } else {
      resetForm();
    }
  },
  { immediate: true }
);
const firstInput = ref(null);

/* Opened from the overview grid: that member and that week are the subject. */
watch(
  () => [props.defaultUserId, props.defaultPeriodId, props.isOpen],
  ([userId, periodId, isOpen]) => {
    if (isEditing.value || !isOpen) return;
    if (userId) formData.value.userId = userId;
    if (periodId) formData.value.periodId = periodId;
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
  loadUsers();
  if (props.isOpen) {
    nextTick(() => {
      if (firstInput.value) {
        firstInput.value.focus();
      }
    });
  }
  // if (props.plan) {
  //   formData.value = {
  //     userId: props.plan.userId,
  //     month: props.plan.month,
  //     startDate: props.plan.startDate?.slice(0, 10),
  //     endDate: props.plan.endDate?.slice(0, 10),
  //     definition: props.plan.definition,
  //     periodicFinancialGoal: props.plan.periodicFinancialGoal,
  //     note: props.plan.note || ''
  //   };
  // }
});
</script>

<style scoped>
.plan-remaining {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 6px 0 0;
  font-size: 13px;
  color: #374151;
}

.plan-remaining__hint {
  font-size: 11px;
  color: #6b7280;
}

.plan-warning {
  margin: 6px 0 0;
  padding: 7px 10px;
  border-left: 3px solid #d97706;
  border-radius: 0 4px 4px 0;
  background: #fffbeb;
  font-size: 12px;
  color: #92400e;
}

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
  width: 480px;
  max-width: 480px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: var(--shadow-xl);
  border: 1px solid var(--border-light);
}

@media (max-width: 520px) {
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
