<template>
  <section
    class="report-doc-section"
    :class="sectionClasses"
  >
    <header class="report-doc-section__header">
      <h3 class="report-doc-section__title">{{ title }}</h3>

      <div class="report-doc-section__header-end">
        <div
          v-if="isViewMode && (percent != null || checked != null)"
          class="report-doc-section__status-row"
        >
          <span
            v-if="percent != null"
            class="header-progress__pct"
            :class="percentColorClass"
          >{{ percentLabel }}</span>
          <div
            v-if="checked != null"
            class="status-icon-readonly"
            :class="checked ? 'status-icon-readonly--yes' : 'status-icon-readonly--no'"
            :title="checked ? 'Complete' : 'Not complete'"
            role="img"
            :aria-label="checked ? 'Complete' : 'Not complete'"
          >
            <svg v-if="checked" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
              <path
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
            <svg v-else viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
              <path
                fill="currentColor"
                fill-rule="evenodd"
                clip-rule="evenodd"
                d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm-1 6a1 1 0 112 0v5a1 1 0 11-2 0V8zm1 10a1.25 1.25 0 100-2.5 1.25 1.25 0 000 2.5z"
              />
            </svg>
          </div>
        </div>

        <div
          v-else-if="editable"
          class="header-progress"
          :class="{ 'is-invalid': fieldErrors.percent }"
        >
          <template v-if="editable">
            <input
              class="header-progress__slider"
              type="range"
              min="0"
              max="100"
              step="1"
              :value="percentBarValue"
              :style="sliderFillStyle"
              aria-label="Progress percentage"
              @input="onRangeInput"
            />
            <input
              :value="percentDisplay"
              type="number"
              min="0"
              class="header-progress__input"
              aria-label="Progress value"
              @input="onPercentInput"
            />
          </template>
          <span class="header-progress__pct">{{ percentLabel }}</span>
        </div>

        <div
          v-if="editable"
          class="report-doc-section__header-tools"
        >
          <div
            class="achievement-toggle"
            :class="{ 'is-invalid': fieldErrors.checked }"
            role="group"
            aria-label="Completion status"
          >
            <button
              type="button"
              class="achievement-toggle__btn achievement-toggle__btn--yes"
              :class="{ 'is-active': checked === true, 'is-locked': isCompleteLocked }"
              title="Complete"
              aria-label="Complete"
              :aria-disabled="isCompleteLocked"
              @click="setChecked(true)"
            >
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                <path
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </button>
            <button
              type="button"
              class="achievement-toggle__btn achievement-toggle__btn--no"
              :class="{ 'is-active': checked === false }"
              title="Not complete"
              aria-label="Not complete"
              :disabled="isCompleteLocked"
              @click="setChecked(false)"
            >
              <svg viewBox="0 0 20 20" width="22" height="22" aria-hidden="true">
                <path
                  fill="currentColor"
                  fill-rule="evenodd"
                  clip-rule="evenodd"
                  d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6.75a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6.75zm0 8a1 1 0 100-2 1 1 0 000 2z"
                />
              </svg>
            </button>
          </div>
        </div>

        <button
          v-if="canCollapse && editable"
          type="button"
          class="report-doc-section__collapse"
          @click="isCollapsed = !isCollapsed"
        >
          {{ isCollapsed ? 'Expand' : 'Collapse' }}
        </button>
      </div>
    </header>

    <div v-show="!isCollapsed" class="report-doc-section__body">
      <div class="report-doc-section__plan">
        <div
          v-if="hasPlanHtml"
          class="report-doc-section__plan-body"
          v-html="planNotes"
        />
        <p v-else class="report-doc-section__empty">No plan entered for this ticket.</p>
      </div>

      <div
        class="report-doc-section__work"
        :class="{ 'is-invalid': fieldErrors.notes }"
      >
        <p v-if="editable && fieldErrors.notes" class="report-doc-section__error" role="alert">
          Work result is required when marked Not complete.
        </p>
        <ReportRichEditor
          v-if="editable"
          :model-value="modelValue"
          :disabled="!editable"
          :placeholder="workPlaceholder"
          size="composer"
          @update:model-value="$emit('update:modelValue', $event)"
        />
        <div
          v-else-if="hasWorkHtml"
          class="report-doc-section__work-body"
          v-html="modelValue"
        />
        <p v-else class="report-doc-section__empty">—</p>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import ReportRichEditor from './ReportRichEditor.vue';
import { hasVisibleNotes } from '../../utils/planTickets';
import { getReportTicketPercentColorClass } from '../../utils/reportTickets';

const props = defineProps({
  title: { type: String, default: '' },
  planNotes: { type: String, default: '' },
  modelValue: { type: String, default: '' },
  checked: { type: [Boolean, null], default: null },
  percent: { type: [Number, null], default: null },
  editable: { type: Boolean, default: true },
  canCollapse: { type: Boolean, default: true },
  collapsedByDefault: { type: Boolean, default: false },
  fieldErrors: {
    type: Object,
    default: () => ({ percent: false, checked: false, notes: false })
  }
});

const emit = defineEmits(['update:modelValue', 'update:checked', 'update:percent']);

const isCollapsed = ref(!!props.collapsedByDefault);
const isViewMode = computed(() => !props.editable);

const sectionClasses = computed(() => ({
  'is-collapsed': isCollapsed.value,
  'has-validation-error': hasValidationError.value,
  'report-doc-section--view': isViewMode.value,
  'report-doc-section--edit': !isViewMode.value
}));

const hasValidationError = computed(
  () => props.fieldErrors.percent || props.fieldErrors.checked || props.fieldErrors.notes
);

const workPlaceholder = computed(() =>
  props.checked === false
    ? 'Required: describe what happened for this plan item…'
    : 'Describe what you accomplished for this plan item… (optional)'
);

const percentColorClass = computed(() => getReportTicketPercentColorClass(props.percent));

watch(
  () => props.fieldErrors,
  (errs) => {
    if (errs?.percent || errs?.checked || errs?.notes) isCollapsed.value = false;
  },
  { deep: true }
);

watch(
  () => props.editable,
  (ed) => {
    if (!ed) isCollapsed.value = false;
  }
);

const hasPlanHtml = computed(() => hasVisibleNotes(props.planNotes));
const hasWorkHtml = computed(() => hasVisibleNotes(props.modelValue));

const percentDisplay = computed(() =>
  props.percent == null ? '' : String(props.percent)
);

const percentBarValue = computed(() => {
  if (props.percent == null) return 0;
  return Math.min(100, Math.max(0, Number(props.percent) || 0));
});

const percentLabel = computed(() => {
  if (props.percent == null) return '—';
  const n = Number(props.percent);
  if (!Number.isFinite(n)) return '—';
  return `${Math.round(n)}%`;
});

const sliderFillStyle = computed(() => ({
  '--progress-pct': `${percentBarValue.value}%`
}));

/** Progress above 100% forces Complete and cannot be cleared. */
const isCompleteLocked = computed(
  () => props.editable && props.percent != null && Number(props.percent) > 100
);

function clampPercentInput(n) {
  return Math.max(0, Math.round(n));
}

/** Keep percent and Complete / Not complete in sync on the submit form. */
function emitPercent(value) {
  emit('update:percent', value);
  if (!props.editable || value == null) return;
  if (value >= 100) {
    if (props.checked !== true) emit('update:checked', true);
  } else if (props.checked !== false) {
    emit('update:checked', false);
  }
}

function setChecked(value) {
  if (isCompleteLocked.value) {
    if (props.checked !== true) emit('update:checked', true);
    return;
  }
  const next = props.checked === value ? null : value;
  emit('update:checked', next);
  if (!props.editable) return;
  if (next === true && (props.percent == null || Number(props.percent) < 100)) {
    emit('update:percent', 100);
  } else if (next === false && props.percent === 100) {
    emit('update:percent', 99);
  }
}

function onPercentInput(e) {
  const raw = e.target.value;
  if (raw === '') {
    emit('update:percent', null);
    return;
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) return;
  emitPercent(clampPercentInput(n));
}

function onRangeInput(e) {
  const n = Number(e.target.value);
  if (!Number.isFinite(n)) return;
  emitPercent(clampPercentInput(n));
}
</script>

<style scoped>
.report-doc-section {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  transition: background 0.2s ease, border-color 0.2s ease;
}

.report-doc-section--view,
.report-doc-section--edit {
  background: #ffffff;
  border-color: #e2e8f0;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
}

.report-doc-section__header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  padding: 8px 10px;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
}

.report-doc-section--view .report-doc-section__header,
.report-doc-section--edit .report-doc-section__header {
  background: #f8fafc;
  border-bottom-color: #e2e8f0;
}

.report-doc-section__title {
  margin: 0;
  flex: 1 1 12rem;
  min-width: 0;
  font-size: 0.875rem;
  font-weight: 650;
  line-height: 1.35;
  color: var(--text-primary);
}

.report-doc-section__header-end {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  flex: 0 1 auto;
  min-width: 0;
}

.report-doc-section--view .report-doc-section__header {
  flex-wrap: nowrap;
}

.report-doc-section--view .report-doc-section__title {
  flex: 1 1 auto;
  min-width: 0;
}

.report-doc-section--view .report-doc-section__header-end {
  flex: 0 0 auto;
  flex-wrap: nowrap;
}

.report-doc-section__status-row {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
  white-space: nowrap;
}

.report-doc-section__header-edit {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.header-progress {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1 1 140px;
  min-width: 120px;
  max-width: 220px;
}

.header-progress__slider {
  flex: 1;
  min-width: 72px;
  height: 6px;
  margin: 0;
  -webkit-appearance: none;
  appearance: none;
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    var(--progress-fill, #3b82f6) 0%,
    var(--progress-fill, #3b82f6) var(--progress-pct, 0%),
    #e2e8f0 var(--progress-pct, 0%),
    #e2e8f0 100%
  );
  cursor: pointer;
}

.header-progress__slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid var(--progress-fill, #3b82f6);
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.15);
  cursor: grab;
}

.header-progress__slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid var(--progress-fill, #3b82f6);
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.15);
  cursor: grab;
}

.header-progress__input {
  width: 2.75rem;
  padding: 3px 4px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  text-align: center;
  background: #fff;
}

.header-progress__input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.12);
}

.header-progress__pct {
  font-size: 0.8125rem;
  font-weight: 700;
  color: #475569;
  min-width: 2.5rem;
  text-align: right;
}

.header-progress--view .header-progress__pct {
  font-size: 0.9375rem;
  font-weight: 750;
}

.header-progress__pct.is-pct-complete {
  color: #15803d;
}

.header-progress__pct.is-pct-none {
  color: #dc2626;
}

.header-progress__pct.is-pct-partial {
  color: #2563eb;
}

.header-progress__pct.is-pct-unset {
  color: #94a3b8;
}

.status-icon-readonly {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.status-icon-readonly--yes {
  color: #16a34a;
}

.status-icon-readonly--no {
  color: #dc2626;
}

.report-doc-section__header-tools {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.report-doc-section__collapse {
  flex-shrink: 0;
  padding: 4px 8px;
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--text-secondary);
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid var(--border-medium);
  border-radius: 6px;
  cursor: pointer;
}

.achievement-toggle {
  display: inline-flex;
  gap: 4px;
  padding: 3px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid #e2e8f0;
}

.achievement-toggle__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s, box-shadow 0.15s;
}

.achievement-toggle__btn--yes {
  color: #22c55e;
  background: transparent;
}

.achievement-toggle__btn--yes:hover {
  background: #f0fdf4;
}

.achievement-toggle__btn--yes.is-active {
  background: #dcfce7;
  box-shadow: inset 0 0 0 1px #86efac;
  color: #16a34a;
}

.achievement-toggle__btn--no {
  color: #ef4444;
  background: transparent;
}

.achievement-toggle__btn--no:hover {
  background: #fef2f2;
}

.achievement-toggle__btn--no.is-active {
  background: #fee2e2;
  box-shadow: inset 0 0 0 1px #fca5a5;
  color: #dc2626;
}

.achievement-toggle__btn--no:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  pointer-events: none;
}

.achievement-toggle__btn--yes.is-locked {
  cursor: default;
}

.report-doc-section__body {
  padding: 10px 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: #fafbfc;
}

.report-doc-section--view .report-doc-section__body,
.report-doc-section--edit .report-doc-section__body {
  background: #ffffff;
}

.report-doc-section__plan {
  padding: 10px 12px;
  border-radius: 8px;
  background: #e2e8f0;
  border: 1px solid #94a3b8;
  border-left: 4px solid #2563eb;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5);
}

.report-doc-section--view .report-doc-section__plan,
.report-doc-section--edit .report-doc-section__plan {
  background: #f1f5f9;
  border-color: #cbd5e1;
  border-left-color: #2563eb;
}

.report-doc-section__plan-body,
.report-doc-section__work-body {
  font-size: 0.8125rem;
  color: #334155;
  line-height: 1.55;
}

.report-doc-section--view .report-doc-section__plan-body,
.report-doc-section--view .report-doc-section__work-body {
  font-size: 0.875rem;
  max-height: none;
  overflow: visible;
}

.report-doc-section__plan-body :deep(p),
.report-doc-section__work-body :deep(p) {
  margin: 0 0 0.45rem;
}

.report-doc-section__plan-body :deep(p:last-child),
.report-doc-section__work-body :deep(p:last-child) {
  margin-bottom: 0;
}

.report-doc-section__empty {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-tertiary);
  font-style: italic;
}

.report-doc-section__work :deep(.report-rich-editor) {
  border-radius: 8px;
  background: #fff;
}

.report-doc-section.has-validation-error {
  box-shadow: 0 0 0 1px #fca5a5;
}

.header-progress.is-invalid,
.achievement-toggle.is-invalid {
  box-shadow: 0 0 0 2px rgba(220, 38, 38, 0.2);
  border-radius: 8px;
}

.report-doc-section__work.is-invalid :deep(.report-rich-editor) {
  box-shadow: 0 0 0 2px rgba(220, 38, 38, 0.25);
}

.report-doc-section__error {
  margin: 0 0 6px;
  font-size: 0.75rem;
  font-weight: 600;
  color: #b91c1c;
}

@media (max-width: 720px) {
  .header-progress:not(.header-progress--view) {
    max-width: none;
    flex-basis: 100%;
  }
}
</style>
