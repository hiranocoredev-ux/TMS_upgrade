<template>
  <div class="sz-result" :class="`is-${tier}`" :title="title">
    <span class="sz-result__pct">{{ label }}</span>
    <span class="sz-result__bar" aria-hidden="true">
      <span class="sz-result__fill" :style="{ width: fill }"></span>
    </span>
    <span v-if="detail" class="sz-result__detail">{{ detail }}</span>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { resultTier } from '../../utils/summarizeTiers';

const props = defineProps({
  /** Achievement percentage; null when there is nothing to measure against. */
  value: { type: Number, default: null },
  /** Tooltip suffix after the percent, e.g. "of plan". */
  hint: { type: String, default: 'of plan' },
  /** Tooltip when there is no value. */
  emptyHint: { type: String, default: 'No plan set' },
  /** Optional small line under the bar, e.g. "15 / 20". */
  detail: { type: String, default: '' }
});

const hasValue = computed(() => typeof props.value === 'number' && Number.isFinite(props.value));

const tier = computed(() => resultTier(props.value));

const label = computed(() => (hasValue.value ? `${props.value.toFixed(2)}%` : '—'));
const fill = computed(() => `${hasValue.value ? Math.min(100, Math.max(0, props.value)) : 0}%`);
const title = computed(() => (hasValue.value ? `${label.value} ${props.hint}` : props.emptyHint));
</script>

<style scoped>
.sz-result {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  min-width: 92px;
}

.sz-result__pct {
  font-variant-numeric: tabular-nums;
  font-weight: var(--font-weight-semibold);
  color: var(--sz-tier-color, var(--text-tertiary));
}

.sz-result__bar {
  width: 100%;
  height: 4px;
  border-radius: var(--radius-full);
  background: var(--sz-track, var(--border-light));
  overflow: hidden;
}

.sz-result__fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--sz-tier-color, var(--text-tertiary));
  transition: width var(--transition-base);
}

.sz-result__detail {
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--text-tertiary);
}

.is-good { --sz-tier-color: var(--sz-good, #1f7a4d); }
.is-ok { --sz-tier-color: var(--sz-ok, #1f4e8c); }
.is-warn { --sz-tier-color: var(--sz-mid, #9a6700); }
.is-low { --sz-tier-color: var(--sz-low, #b42318); }
.is-none .sz-result__pct { font-weight: var(--font-weight-normal); }
</style>
