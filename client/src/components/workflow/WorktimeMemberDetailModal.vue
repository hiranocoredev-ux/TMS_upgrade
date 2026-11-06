<template>
  <teleport to="body">
    <div v-if="modelValue" class="wmt-overlay" @click.self="close">
      <div
        class="wmt-dialog"
        :class="{ 'wmt-dialog--split': showAddSection }"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wmt-title"
      >
        <header class="wmt-header">
          <div class="wmt-header-main">
            <UserAvatar
              class="wmt-avatar"
              :name="chartUser?.name || 'Member'"
              :profile-image="chartUser?.avatarUrl || ''"
              :size="48"
              :tooltip="false"
            />
            <div class="wmt-header-text">
              <h2 id="wmt-title" class="wmt-title">{{ chartUser?.name || 'Member' }}</h2>
              <p class="wmt-header-meta">
                Manual time<span v-if="chartUser?.group"> · {{ chartUser.group }}</span>
              </p>
            </div>
          </div>
          <button type="button" class="wmt-close" aria-label="Close dialog" @click="close">
            <svg class="wmt-close__icon" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="none"
                stroke="currentColor"
                stroke-width="2.25"
                stroke-linecap="round"
                d="M18 6L6 18M6 6l12 12"
              />
            </svg>
          </button>
        </header>

        <div class="wmt-body">
          <div v-if="loading" class="wmt-loading">
            <span class="wmt-spinner" aria-hidden="true" />
            <span>Loading details…</span>
          </div>
          <template v-else>
            <div class="wmt-split" :class="{ 'wmt-split--readonly': !showAddSection }">
              <aside v-if="showAddSection" class="wmt-split__side">
                <section class="wmt-add-panel" aria-labelledby="wmt-add-title">
                  <h3 id="wmt-add-title" class="wmt-add-panel__title">Add entry</h3>
                  <div class="wmt-add-fields">
                    <div class="wmt-add-date-block">
                      <span class="wmt-add-label">Date</span>
                      <template v-if="chartRangeDates.length <= 1">
                        <p class="wmt-add-date-fixed">{{ formatDayTitle(addForm.date) }}</p>
                      </template>
                      <template v-else>
                        <select v-model="addForm.date" class="wmt-add-select" aria-label="Day for manual add">
                          <option v-for="d in chartRangeDates" :key="d" :value="d">
                            {{ formatDayTitle(d) }}
                          </option>
                        </select>
                      </template>
                    </div>
                    <div class="wmt-add-field--split">
                      <label>
                        <span class="wmt-add-label">Hours</span>
                        <input
                          v-model.number="addForm.hours"
                          type="number"
                          min="0"
                          step="1"
                          class="wmt-input"
                          placeholder="0"
                        />
                      </label>
                      <label>
                        <span class="wmt-add-label">Minutes</span>
                        <input
                          v-model.number="addForm.minutes"
                          type="number"
                          min="0"
                          step="1"
                          class="wmt-input"
                          placeholder="0"
                          title="May exceed 59 (e.g. 250 minutes)"
                        />
                      </label>
                    </div>
                  </div>
                  <p v-if="addFormTotalMinutes > 0" class="wmt-add-preview">
                    Total <strong>{{ addFormNormalizedH }}h {{ addFormNormalizedM }}m</strong><span v-if="addFormNeedsNormalizeHint"> ({{ addFormRawH }}h {{ addFormRawM }}m entered)</span>
                  </p>
                  <label class="wmt-add-field wmt-add-field--full">
                    <span class="wmt-add-label">Short reason <span class="wmt-optional">shown on graph tooltip</span></span>
                    <input
                      v-model="addForm.shortReason"
                      type="text"
                      class="wmt-input"
                      maxlength="120"
                      placeholder="e.g. Meeting, Onboarding"
                    />
                  </label>
                  <label class="wmt-add-field wmt-add-field--full">
                    <span class="wmt-add-label">Comment <span class="wmt-optional">optional</span></span>
                    <textarea
                      v-model="addForm.description"
                      class="wmt-textarea"
                      rows="2"
                      placeholder="Optional"
                    />
                  </label>
                  <div class="wmt-add-actions">
                    <button
                      type="button"
                      class="wmt-btn wmt-btn--primary wmt-btn--block"
                      :disabled="addSubmitting"
                      @click="submitAddTime"
                    >
                      {{ addSubmitting ? 'Adding…' : 'Add time' }}
                    </button>
                  </div>
                </section>
              </aside>

              <div class="wmt-split__main">
                <div v-if="error" class="wmt-error"><span class="wmt-error__icon">!</span> {{ error }}</div>

                <template v-if="detail">
                  <div class="wmt-stat-line">
                    <span>Tracked {{ formatDuration(detail.rangeTrackedSeconds) }}</span>
                    <span class="wmt-stat-line__dot" aria-hidden="true">·</span>
                    <span>Manual {{ formatDuration(detail.rangeAddedSeconds) }}</span>
                  </div>

                  <div v-if="visibleDays.length === 0" class="wmt-empty">No activity in this range.</div>
                  <div v-else class="wmt-days">
                    <section v-for="day in visibleDays" :key="day.date" class="wmt-day">
                      <div v-if="visibleDays.length > 1" class="wmt-day-label">{{ formatDayTitle(day.date) }}</div>

                      <div v-if="!day.adjustments?.length" class="wmt-no-adj">No manual entries.</div>
                      <ul v-else class="wmt-adj-list">
                        <li v-for="adj in day.adjustments" :key="adj.id" class="wmt-adj">
                          <template v-if="allowManage && editingKey === editKeyFor(day.date, adj.id)">
                            <div class="wmt-adj-edit">
                              <div class="wmt-adj-edit-row">
                                <label>
                                  <span>Hours</span>
                                  <input v-model.number="editDraft.hours" type="number" min="0" class="wmt-input" />
                                </label>
                                <label>
                                  <span>Minutes</span>
                                  <input
                                    v-model.number="editDraft.minutes"
                                    type="number"
                                    min="0"
                                    step="1"
                                    class="wmt-input"
                                    title="May exceed 59 (e.g. 250 minutes)"
                                  />
                                </label>
                              </div>
                              <label class="wmt-adj-desc">
                                <span>Short reason</span>
                                <input v-model="editDraft.shortReason" type="text" maxlength="120" class="wmt-input" />
                              </label>
                              <label class="wmt-adj-desc">
                                <span>Description</span>
                                <textarea v-model="editDraft.description" class="wmt-textarea" rows="2" />
                              </label>
                              <div class="wmt-adj-actions">
                                <button type="button" class="wmt-btn wmt-btn--ghost" :disabled="saving" @click="cancelEdit">
                                  Cancel
                                </button>
                                <button type="button" class="wmt-btn wmt-btn--primary" :disabled="saving" @click="saveEdit(day)">
                                  {{ saving ? 'Saving…' : 'Save' }}
                                </button>
                              </div>
                            </div>
                          </template>
                          <template v-else>
                            <div class="wmt-adj-main">
                              <div class="wmt-adj-time">
                                {{ formatDuration(adj.seconds) }}
                                <span v-if="adj.shortReason" class="wmt-adj-reason">{{ adj.shortReason }}</span>
                              </div>
                              <p class="wmt-adj-note">{{ adj.description || '—' }}</p>
                            </div>
                            <div v-if="allowManage" class="wmt-adj-row-actions">
                              <button type="button" class="wmt-text-btn" @click="startEdit(day, adj)">Edit</button>
                              <button type="button" class="wmt-text-btn wmt-text-btn--danger" @click="removeEntry(day, adj)">
                                Remove
                              </button>
                            </div>
                          </template>
                        </li>
                      </ul>
                    </section>
                  </div>
                </template>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { getESTDateKey } from '../../utils/timezoneHelpers';
import { useToast } from 'vue-toastification';
import UserAvatar from '../UserAvatar.vue';
import {
  getWorkflowManualTimeDetail,
  patchWorkflowManualAdjustment,
  deleteWorkflowManualAdjustment,
  addWorkflowTime,
} from '../../services/workflow';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  chartUser: {
    type: Object,
    default: null,
  },
  dateFrom: { type: String, default: '' },
  dateTo: { type: String, default: '' },
  /** Super Admin only: add / edit / remove manual entries */
  allowManage: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue', 'saved']);

const toast = useToast();
const loading = ref(false);
const error = ref('');
const detail = ref(null);
const saving = ref(false);
const addSubmitting = ref(false);
const editingKey = ref('');
const editDraft = ref({ hours: 0, minutes: 0, shortReason: '', description: '' });

const addUtcDay = (iso, deltaDays) => {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
};

/** Chart API uses exclusive end date; last valid calendar day for adding time. */
const dateRangeLastInclusive = computed(() =>
  props.dateTo ? addUtcDay(props.dateTo, -1) : ''
);

const showAddSection = computed(
  () =>
    !!(
      props.allowManage &&
      props.modelValue &&
      props.chartUser?.userId &&
      props.dateFrom &&
      props.dateTo
    )
);

const chartRangeDates = computed(() => {
  const out = [];
  if (!props.dateFrom || !props.dateTo) return out;
  for (let dk = props.dateFrom; dk < props.dateTo; dk = addUtcDay(dk, 1)) {
    out.push(dk);
  }
  return out;
});

const pickDefaultAddDate = () => {
  const lo = props.dateFrom;
  const hi = dateRangeLastInclusive.value;
  if (!lo || !hi) return lo || '';
  const today = getESTDateKey();
  if (today >= lo && today <= hi) return today;
  return lo;
};

const addForm = ref({
  date: '',
  hours: null,
  minutes: null,
  shortReason: '',
  description: '',
});

const resetAddForm = () => {
  const list = chartRangeDates.value;
  let d = pickDefaultAddDate();
  if (list.length === 1) d = list[0];
  else if (list.length > 1 && (!d || !list.includes(d))) d = list[0];
  else if (!list.length) d = '';
  addForm.value = { date: d, hours: null, minutes: null, shortReason: '', description: '' };
};

const addParsedH = computed(() => {
  const n = Number(addForm.value.hours);
  return Number.isFinite(n) && n >= 0 ? n : 0;
});
const addParsedM = computed(() => {
  const n = Number(addForm.value.minutes);
  return Number.isFinite(n) && n >= 0 ? n : 0;
});
const addFormTotalMinutes = computed(() =>
  Math.max(0, Math.round(addParsedH.value * 60 + addParsedM.value))
);
const addFormNormalizedH = computed(() =>
  addFormTotalMinutes.value > 0 ? Math.floor(addFormTotalMinutes.value / 60) : 0
);
const addFormNormalizedM = computed(() =>
  addFormTotalMinutes.value > 0 ? addFormTotalMinutes.value % 60 : 0
);
const addFormNeedsNormalizeHint = computed(
  () => addParsedM.value >= 60 || addParsedH.value % 1 !== 0
);
const addFormRawH = computed(() => addForm.value.hours ?? 0);
const addFormRawM = computed(() => addForm.value.minutes ?? 0);

const isDateInsideChartRange = (dateStr) => {
  if (!dateStr || !props.dateFrom || !props.dateTo) return false;
  return dateStr >= props.dateFrom && dateStr < props.dateTo;
};

const submitAddTime = async () => {
  if (!props.chartUser?.userId) return;
  const date = addForm.value.date;
  if (!isDateInsideChartRange(date)) {
    toast.warning(`Choose a date between ${props.dateFrom} and ${dateRangeLastInclusive.value}.`);
    return;
  }
  const h = addParsedH.value;
  const m = addParsedM.value;
  if (h === 0 && m === 0) {
    toast.warning('Enter hours or minutes greater than 0.');
    return;
  }

  addSubmitting.value = true;
  try {
    await addWorkflowTime({
      userId: props.chartUser.userId,
      date,
      hours: h,
      minutes: m,
      shortReason: addForm.value.shortReason,
      description: addForm.value.description,
    });
    toast.success('Manual time added for this member and date.');
    emit('saved');
    resetAddForm();
    await load();
  } catch (e) {
    toast.error(e.response?.data?.message || e.message || 'Could not add time');
  } finally {
    addSubmitting.value = false;
  }
};

const visibleDays = computed(() => {
  const days = detail.value?.days || [];
  return days.filter(
    (d) =>
      (d.trackedSeconds || 0) > 0 ||
      (d.addedSeconds || 0) > 0 ||
      (d.adjustments && d.adjustments.length > 0)
  );
});

const editKeyFor = (date, id) => `${date}::${id}`;

const formatDuration = (sec) => {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

const formatDayTitle = (iso) => {
  if (!iso) return '';
  const [y, mo, d] = iso.split('-').map(Number);
  if (!y || !mo || !d) return iso;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
};

const close = () => {
  emit('update:modelValue', false);
};

const load = async () => {
  if (!props.chartUser?.userId || !props.dateFrom || !props.dateTo) return;
  loading.value = true;
  error.value = '';
  detail.value = null;
  try {
    const res = await getWorkflowManualTimeDetail({
      userId: props.chartUser.userId,
      date_from: props.dateFrom,
      date_to: props.dateTo,
    });
    detail.value = res.data?.data || null;
    if (!detail.value) error.value = 'No data returned.';
  } catch (e) {
    error.value = e.response?.data?.message || e.message || 'Failed to load detail';
  } finally {
    loading.value = false;
  }
};

watch(
  () => [props.modelValue, props.chartUser?.userId, props.dateFrom, props.dateTo],
  ([open]) => {
    if (open) {
      editingKey.value = '';
      resetAddForm();
      load();
    } else {
      detail.value = null;
      error.value = '';
    }
  }
);

const startEdit = (day, adj) => {
  const totalMin = Math.round((Number(adj.seconds) || 0) / 60);
  editingKey.value = editKeyFor(day.date, adj.id);
  editDraft.value = {
    hours: Math.floor(totalMin / 60),
    minutes: totalMin % 60,
    shortReason: adj.shortReason || '',
    description: adj.description || '',
  };
};

const cancelEdit = () => {
  editingKey.value = '';
};

const totalEditSeconds = () => {
  const h = Number(editDraft.value.hours) || 0;
  const m = Number(editDraft.value.minutes) || 0;
  return Math.max(0, Math.round(h * 3600 + m * 60));
};

const saveEdit = async (day) => {
  const key = editingKey.value;
  const sep = key.indexOf('::');
  if (sep === -1) return;
  const dKey = key.slice(0, sep);
  const eid = key.slice(sep + 2);
  if (!eid || dKey !== day.date) return;
  const secs = totalEditSeconds();
  if (secs <= 0) {
    toast.warning('Duration must be greater than 0.');
    return;
  }
  saving.value = true;
  try {
    await patchWorkflowManualAdjustment({
      worklogId: day.worklogId || undefined,
      userId: !day.worklogId ? props.chartUser.userId : undefined,
      date: day.date,
      entryId: eid,
      seconds: secs,
      shortReason: editDraft.value.shortReason,
      description: editDraft.value.description,
    });
    toast.success('Entry updated.');
    editingKey.value = '';
    emit('saved');
    await load();
  } catch (e) {
    toast.error(e.response?.data?.message || e.message || 'Update failed');
  } finally {
    saving.value = false;
  }
};

const removeEntry = async (day, adj) => {
  const ok = window.confirm('Remove this manual time entry for this day?');
  if (!ok) return;
  saving.value = true;
  try {
    await deleteWorkflowManualAdjustment({
      worklogId: day.worklogId || undefined,
      userId: !day.worklogId ? props.chartUser.userId : undefined,
      date: day.date,
      entryId: adj.id,
    });
    toast.success('Entry removed.');
    if (editingKey.value === editKeyFor(day.date, adj.id)) editingKey.value = '';
    emit('saved');
    await load();
  } catch (e) {
    toast.error(e.response?.data?.message || e.message || 'Remove failed');
  } finally {
    saving.value = false;
  }
};
</script>

<style scoped>
.wmt-overlay {
  position: fixed;
  inset: 0;
  z-index: 10050;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}
.wmt-dialog {
  width: min(600px, 100%);
  max-height: min(90vh, 780px);
  display: flex;
  flex-direction: column;
  background: var(--bg-primary, #ffffff);
  color: var(--text-primary, #0f172a);
  border-radius: 12px;
  border: 1px solid var(--border-light, #e2e8f0);
  box-shadow: 0 16px 48px rgba(15, 23, 42, 0.12);
  overflow: hidden;
}
.wmt-dialog--split {
  width: min(880px, 100%);
  max-height: min(90vh, 800px);
}

.wmt-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 16px 18px;
  border-bottom: 1px solid var(--border-light, #e2e8f0);
  background: var(--bg-primary, #ffffff);
}
.wmt-header-main {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}
.wmt-avatar {
  flex-shrink: 0;
  border-radius: 50%;
}
.wmt-header-text {
  min-width: 0;
}
.wmt-title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.3;
  color: var(--text-primary, #0f172a);
}
.wmt-header-meta {
  margin: 4px 0 0;
  font-size: 0.8125rem;
  font-weight: 400;
  color: var(--text-secondary, #64748b);
}

/**
 * Close: true optical center via flexbox + SVG (text “✕” uses uneven font metrics).
 */
.wmt-close {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  margin: 0;
  padding: 0;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-secondary, #64748b);
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
  line-height: 0;
  font: inherit;
}
.wmt-close:hover {
  color: var(--text-primary, #0f172a);
  background: var(--bg-tertiary, #f1f5f9);
}
.wmt-close__icon {
  display: block;
  width: 18px;
  height: 18px;
}

.wmt-body {
  padding: 0;
  overflow: hidden;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.wmt-split {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(280px, 320px) 1fr;
  align-items: stretch;
}
.wmt-split--readonly {
  grid-template-columns: 1fr;
}
.wmt-split__side {
  overflow-y: auto;
  padding: 18px 16px 20px;
  border-right: 1px solid var(--border-light, #e2e8f0);
  background: var(--bg-primary, #fff);
}
.wmt-split__main {
  overflow-y: auto;
  padding: 18px 20px 20px;
  min-height: 0;
}
@media (max-width: 760px) {
  .wmt-split:not(.wmt-split--readonly) {
    grid-template-columns: 1fr;
  }
  .wmt-split__side {
    border-right: none;
    border-bottom: 1px solid var(--border-light, #e2e8f0);
  }
}

.wmt-add-panel {
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;
  box-shadow: none;
}
.wmt-add-panel__title {
  margin: 0 0 14px;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-secondary, #475569);
}
.wmt-add-fields {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.wmt-add-date-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.wmt-add-date-fixed {
  margin: 0;
  padding: 8px 10px;
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: 8px;
  border: 1px solid var(--border-light, #e2e8f0);
  background: var(--bg-tertiary, #f8fafc);
  color: var(--text-primary, #0f172a);
}
.wmt-add-select {
  width: 100%;
  padding: 8px 10px;
  font-size: 0.875rem;
  font-weight: 500;
  font-family: inherit;
  border-radius: 8px;
  border: 1px solid var(--border-medium, #cbd5e1);
  background: var(--bg-primary, #fff);
  color: var(--text-primary, #0f172a);
  cursor: pointer;
}
.wmt-add-select:focus {
  outline: none;
  border-color: var(--color-primary, #6366f1);
}

.wmt-add-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.wmt-add-field--split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
@media (max-width: 520px) {
  .wmt-add-field--split {
    grid-template-columns: 1fr;
  }
}
.wmt-add-field--full {
  margin-top: 12px;
}
.wmt-add-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-secondary, #64748b);
}
.wmt-optional {
  font-weight: 400;
  color: var(--text-tertiary, #94a3b8);
}
.wmt-add-preview {
  margin: 4px 0 0;
  font-size: 0.8125rem;
  color: var(--text-secondary, #64748b);
}
.wmt-add-preview strong {
  font-variant-numeric: tabular-nums;
  color: var(--text-primary, #0f172a);
}
.wmt-add-actions {
  display: flex;
  justify-content: stretch;
  margin-top: 14px;
}
.wmt-btn--block {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  box-sizing: border-box;
}

.wmt-loading {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 40px 20px;
  min-height: 180px;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary, #64748b);
}
.wmt-spinner {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 3px solid color-mix(in srgb, var(--color-primary, #6366f1) 25%, transparent);
  border-top-color: var(--color-primary, #6366f1);
  animation: wmt-spin 0.65s linear infinite;
}
@keyframes wmt-spin {
  to {
    transform: rotate(360deg);
  }
}
.wmt-error {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--color-error, #dc2626) 35%, transparent);
  background: color-mix(in srgb, var(--color-error, #dc2626) 8%, var(--bg-primary, #fff));
  color: var(--color-error, #b91c1c);
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.4;
}
.wmt-error__icon {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--color-error, #dc2626) 22%, transparent);
  color: var(--color-error, #991b1b);
  font-size: 0.75rem;
  font-weight: 900;
}

.wmt-stat-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  margin: 0 0 16px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--border-light, #e2e8f0);
  font-size: 0.8125rem;
  color: var(--text-secondary, #64748b);
}
.wmt-stat-line__dot {
  color: var(--text-tertiary, #94a3b8);
  user-select: none;
}

.wmt-text-btn {
  flex-shrink: 0;
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-primary, #6366f1);
  cursor: pointer;
  text-decoration: none;
}
.wmt-text-btn:hover {
  text-decoration: underline;
}
.wmt-text-btn--danger {
  color: var(--color-error, #dc2626);
}

.wmt-empty {
  padding: 28px 16px;
  text-align: center;
  border-radius: 8px;
  border: 1px dashed var(--border-light, #e2e8f0);
  color: var(--text-tertiary, #94a3b8);
  font-size: 0.8125rem;
}

.wmt-days {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.wmt-day {
  border-radius: 8px;
  border: 1px solid var(--border-light, #e2e8f0);
  background: var(--bg-primary, #ffffff);
}
/** Only when multiple days have entries — range summary + add form date are not enough to disambiguate. */
.wmt-day-label {
  padding: 8px 14px 6px;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary, #64748b);
  border-bottom: 1px solid var(--border-light, #f1f5f9);
}

.wmt-no-adj {
  padding: 12px 14px;
  font-size: 0.8125rem;
  color: var(--text-tertiary, #94a3b8);
}

.wmt-adj-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}
.wmt-adj {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  border-top: 1px solid var(--border-light, #f1f5f9);
}
.wmt-adj:first-child {
  border-top: none;
}
.wmt-adj-main {
  flex: 1;
  min-width: 0;
}
.wmt-adj-time {
  font-size: 0.875rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--text-primary, #0f172a);
}
.wmt-adj-reason {
  display: inline-block;
  margin-left: 8px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.6875rem;
  font-weight: 600;
  vertical-align: middle;
  background: color-mix(in srgb, var(--color-primary, #6366f1) 14%, transparent);
  color: var(--color-primary, #6366f1);
}
.wmt-adj-note {
  margin: 4px 0 0;
  font-size: 0.8125rem;
  color: var(--text-secondary, #64748b);
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-word;
}
.wmt-adj-row-actions {
  flex-shrink: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

.wmt-adj-edit {
  flex: 1;
  min-width: 0;
  width: 100%;
}
.wmt-adj:has(.wmt-adj-edit) {
  flex-wrap: wrap;
  align-items: flex-start;
}
.wmt-adj-edit-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 10px;
}
.wmt-adj-edit-row label,
.wmt-adj-desc {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.6875rem;
  font-weight: 800;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: var(--text-tertiary, #64748b);
}
.wmt-input,
.wmt-textarea {
  text-transform: none;
  letter-spacing: normal;
  font-weight: 500;
}
.wmt-input {
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid var(--border-medium, #cbd5e1);
  font-size: 0.875rem;
  font-family: inherit;
  background: var(--bg-primary, #fff);
  color: var(--text-primary, #111827);
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}
.wmt-input:focus {
  outline: none;
  border-color: var(--color-primary, #6366f1);
}
.wmt-textarea {
  width: 100%;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid var(--border-medium, #cbd5e1);
  font-size: 0.84375rem;
  font-family: inherit;
  resize: vertical;
  min-height: 56px;
  background: var(--bg-primary, #fff);
  color: var(--text-primary, #111827);
  box-sizing: border-box;
}
.wmt-textarea:focus {
  outline: none;
  border-color: var(--color-primary, #6366f1);
}

.wmt-adj-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 12px;
  width: 100%;
}

.wmt-btn {
  border-radius: 8px;
  padding: 8px 14px;
  font-size: 0.8125rem;
  font-weight: 600;
  border: 1px solid transparent;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.12s ease, border-color 0.12s ease, opacity 0.12s ease;
}
.wmt-btn--primary {
  background: var(--color-primary, #6366f1);
  color: #fff;
  border-color: transparent;
}
.wmt-btn--primary:hover:not(:disabled) {
  filter: brightness(1.05);
}
.wmt-btn--ghost {
  background: var(--bg-primary, #fff);
  border-color: var(--border-medium, #cbd5e1);
  color: var(--text-secondary, #475569);
}
.wmt-btn--ghost:hover:not(:disabled) {
  background: var(--bg-tertiary, #f1f5f9);
}
.wmt-btn--danger {
  background: color-mix(in srgb, var(--color-error, #dc2626) 11%, var(--bg-primary, #fff));
  border-color: color-mix(in srgb, var(--color-error, #dc2626) 42%, transparent);
  color: var(--color-error, #dc2626);
}
.wmt-btn--danger:hover:not(:disabled) {
  background: color-mix(in srgb, var(--color-error, #dc2626) 16%, var(--bg-primary, #fff));
}
.wmt-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

@media (max-width: 480px) {
  .wmt-adj-edit-row {
    grid-template-columns: 1fr;
  }
  .wmt-adj:not(:has(.wmt-adj-edit)) {
    flex-wrap: wrap;
    align-items: flex-start;
  }
  .wmt-adj-row-actions {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
