<template>
  <section class="sgr" aria-labelledby="sgr-title">
    <header class="sgr__head">
      <h3 id="sgr-title">Group ranking</h3>
      <p>{{ caption }}</p>
    </header>

    <ol class="sgr__list">
      <li v-for="(g, i) in groups" :key="g.code">
        <button
          type="button"
          class="sgr__card"
          :class="{ 'is-first': i === 0, 'is-selected': selected === g.code, 'is-dimmed': selected !== 'all' && selected !== g.code }"
          :style="{ '--g-accent': g.accent }"
          :aria-pressed="selected === g.code"
          :title="selected === g.code ? 'Show all groups' : `Show only ${g.name}`"
          @click="$emit('toggle', g.code)"
        >
          <span class="sgr__top">
            <span class="sgr__rank" :aria-label="`Rank ${i + 1}`">{{ i + 1 }}</span>
            <span class="sgr__name">
              <span class="sgr__dot" aria-hidden="true"></span>
              <span class="sgr__name-text">{{ g.name }}</span>
            </span>
            <span class="sgr__total">
              <span class="sgr__total-value">{{ loading ? '…' : pct(g.total) }}</span>
              <span class="sgr__total-label">Total</span>
            </span>
          </span>

          <span class="sgr__meter" aria-hidden="true">
            <span class="sgr__meter-fill" :style="{ width: loading ? '0%' : barWidth(g.total) }"></span>
          </span>

          <span class="sgr__metrics" :style="metricsStyle(g)">
            <span v-for="m in g.metrics" :key="m.label" class="sgr__metric">
              <span class="sgr__metric-label">{{ m.label }}</span>
              <span class="sgr__metric-value">{{ m.loading ? '…' : pct(m.value) }}</span>
            </span>
          </span>
        </button>
      </li>
    </ol>
  </section>
</template>

<script setup>
defineProps({
  /** Groups already sorted by total, best first: [{ code, name, accent, total, metrics: [{ label, value, loading }] }] */
  groups: { type: Array, default: () => [] },
  /** Line under the heading explaining what Total is. */
  caption: { type: String, default: '' },
  /** Selected group code, or 'all'. */
  selected: { type: String, default: 'all' },
  /** WorkTime (and therefore Total) still loading. */
  loading: { type: Boolean, default: false }
});

defineEmits(['toggle']);

const hasNumber = (v) => typeof v === 'number' && Number.isFinite(v);
const pct = (v) => (hasNumber(v) ? `${v.toFixed(2)}%` : '—');
const barWidth = (v) => `${hasNumber(v) ? Math.min(100, Math.max(0, v)) : 0}%`;

const metricsStyle = (g) => ({
  gridTemplateColumns: `repeat(${Math.min(4, (g.metrics || []).length || 1)}, minmax(0, 1fr))`
});
</script>

<style scoped>
.sgr {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.sgr__head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px var(--spacing-md);
}

.sgr__head h3 {
  margin: 0;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
}

.sgr__head p {
  margin: 0;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.sgr__list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(270px, 1fr));
  gap: var(--spacing-md);
  margin: 0;
  padding: 0;
  list-style: none;
}

.sgr__card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  padding: 14px 16px;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  background: var(--bg-primary);
  color: var(--text-primary);
  font: inherit;
  text-align: left;
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  transition: box-shadow var(--transition-fast), border-color var(--transition-fast), opacity var(--transition-fast);
}

.sgr__card:hover {
  border-color: var(--border-medium);
  box-shadow: var(--shadow-md);
}

.sgr__card:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.sgr__card.is-first {
  border-color: color-mix(in srgb, var(--color-primary) 45%, var(--border-light));
  background: color-mix(in srgb, var(--color-primary) 4%, var(--bg-primary));
}

.sgr__card.is-selected {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 1px var(--color-primary), var(--shadow-sm);
}

.sgr__card.is-dimmed {
  opacity: 0.55;
}

.sgr__top {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.sgr__rank {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: var(--radius-md);
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
}

.is-first .sgr__rank {
  background: var(--color-primary);
  color: var(--text-inverse);
}

.sgr__name {
  display: inline-flex;
  flex: 1;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.sgr__dot {
  width: 10px;
  height: 10px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--g-accent);
}

.sgr__name-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: var(--font-weight-semibold);
}

.sgr__total {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  line-height: 1.1;
}

.sgr__total-value {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
}

.sgr__total-label {
  font-size: 11px;
  font-weight: var(--font-weight-semibold);
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.sgr__meter {
  display: block;
  height: 6px;
  border-radius: var(--radius-full);
  background: var(--bg-tertiary);
  overflow: hidden;
}

.sgr__meter-fill {
  display: block;
  height: 100%;
  border-radius: 0 4px 4px 0;
  background: var(--g-accent);
  transition: width var(--transition-base);
}

.sgr__metrics {
  display: grid;
  gap: 6px 10px;
  padding-top: 8px;
  border-top: 1px solid var(--border-light);
}

.sgr__metric {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.sgr__metric-label {
  font-size: 10.5px;
  font-weight: var(--font-weight-semibold);
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.sgr__metric-value {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  font-variant-numeric: tabular-nums;
  color: var(--text-secondary);
}
</style>
