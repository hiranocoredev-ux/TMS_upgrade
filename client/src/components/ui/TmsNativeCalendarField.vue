<template>
  <div
    class="tms-ncf"
    :class="{ 'tms-ncf--disabled': disabled, [`tms-ncf--${type}`]: true }"
  >
    <input
      ref="inputRef"
      class="tms-ncf__input"
      :id="id"
      :type="type === 'week' ? 'date' : type"
      :value="modelValue"
      :disabled="disabled"
      :title="title"
      :name="name"
      :min="min"
      :max="max"
      :step="step"
      :required="required"
      autocomplete="off"
      @input="onInput"
      @click="openPicker"
    />
    <span
      v-if="rangeHint"
      class="tms-ncf__hint"
      :title="type === 'week' ? `This week covers ${rangeHint}` : `This month covers ${rangeHint}`"
    >
      {{ rangeHint }}
    </span>
    <span class="tms-ncf__icon" aria-hidden="true">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    </span>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { monthRangeLabel } from '../../utils/businessMonth';
import { weekStartDateKey, weekRangeLabel } from '../../utils/weekRule';

const props = defineProps({
  modelValue: { type: String, default: '' },
  /** `date` (YYYY-MM-DD), `month` (YYYY-MM), or `week` (YYYY-Www) */
  type: {
    type: String,
    default: 'date',
    validator: (v) => ['date', 'month', 'week'].includes(v)
  },
  id: { type: String, default: undefined },
  name: { type: String, default: undefined },
  disabled: { type: Boolean, default: false },
  title: { type: String, default: undefined },
  min: { type: String, default: undefined },
  max: { type: String, default: undefined },
  step: { type: [String, Number], default: undefined },
  required: { type: Boolean, default: false }
});

/**
 * The days the chosen period actually covers: a month runs 6th → 5th, a week
 * Saturday → Friday. A week field is a date field underneath, snapped to the
 * Saturday that starts the week.
 */
const rangeHint = computed(() => {
  if (props.type === 'month') return monthRangeLabel(props.modelValue);
  if (props.type === 'week') return weekRangeLabel(props.modelValue);
  return '';
});

const emit = defineEmits(['update:modelValue']);

const inputRef = ref(null);

function onInput(e) {
  const value = e.target.value;
  // A week is picked by any of its days and kept as its Saturday start.
  emit('update:modelValue', props.type === 'week' ? weekStartDateKey(value) || value : value);
}

function openPicker() {
  const el = inputRef.value;
  if (!el || props.disabled) return;
  try {
    if (typeof el.showPicker === 'function') {
      el.showPicker();
    }
  } catch {
    /* Safari / older browsers: ignore */
  }
}

</script>

<style scoped>
.tms-ncf__hint {
  position: absolute;
  right: 34px;
  top: 50%;
  transform: translateY(-50%);
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--bg-tertiary, #f3f4f6);
  color: var(--text-tertiary, #6b7280);
  font-size: 10.5px;
  white-space: nowrap;
  pointer-events: none;
}

.tms-ncf {
  position: relative;
  display: block;
  width: 100%;
  border-radius: var(--radius-md, 8px);
  border: 1px solid var(--border-medium, #cbd5e1);
  background: var(--bg-primary, #fff);
  box-shadow: var(--shadow-sm, 0 1px 2px rgba(15, 23, 42, 0.05));
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.tms-ncf:hover:not(.tms-ncf--disabled) {
  border-color: var(--color-primary, #1f4e8c);
}

.tms-ncf:focus-within:not(.tms-ncf--disabled) {
  border-color: var(--color-primary, #1f4e8c);
  box-shadow: 0 0 0 3px var(--color-primary-soft, rgba(31, 78, 140, 0.16));
}

.tms-ncf--disabled {
  opacity: 0.72;
  cursor: not-allowed;
  background: var(--bg-tertiary, #eef2f6);
}

.tms-ncf__input {
  display: block;
  width: 100%;
  margin: 0;
  padding: 0.55rem 2.35rem 0.55rem 0.65rem;
  font-size: var(--font-size-sm, 0.875rem);
  font-family: var(--font-family-base, inherit);
  font-weight: var(--font-weight-medium, 500);
  color: var(--text-primary, #0f172a);
  line-height: 1.35;
  background: transparent;
  border: none;
  outline: none;
  cursor: pointer;
  min-height: 2.5rem;
  box-sizing: border-box;
  color-scheme: light;
  user-select: none;
  -webkit-user-select: none;
  caret-color: transparent;
}

.tms-ncf__input:disabled {
  cursor: not-allowed;
  color: var(--text-tertiary, #64748b);
}

.tms-ncf__input::selection {
  background: transparent;
  color: inherit;
}

/* Keep native date/week/month text vertically centered in Chromium browsers */
.tms-ncf__input::-webkit-date-and-time-value {
  min-height: 100%;
  display: inline-flex;
  align-items: center;
}

.tms-ncf__input::-webkit-datetime-edit {
  min-height: 100%;
  display: inline-flex;
  align-items: center;
}

/*
 * Hide the browser’s built-in calendar glyph (Chromium / Safari / Edge).
 * We keep a single branded icon and open the popup via showPicker() + normal input clicks.
 */
.tms-ncf__input::-webkit-calendar-picker-indicator {
  display: none;
  -webkit-appearance: none;
  appearance: none;
}

/* Firefox: no standard pseudo for the old icon; trim extra chrome where supported */
.tms-ncf__input::-moz-calendar-picker-indicator {
  display: none;
}

.tms-ncf__icon {
  position: absolute;
  right: 0.55rem;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-primary, #1f4e8c);
  pointer-events: none;
  opacity: 0.92;
}
</style>
