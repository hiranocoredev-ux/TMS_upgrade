<template>
  <section class="smr" aria-labelledby="smr-title">
    <header class="smr__head">
      <div>
        <h3 id="smr-title">Member ranking</h3>
        <p>{{ caption }}<template v-if="caption"> · </template>{{ ranked.length }} {{ ranked.length === 1 ? 'member' : 'members' }}</p>
      </div>
      <ul class="smr__legend" aria-label="What the bar colours mean">
        <li v-for="tier in RESULT_TIERS" :key="tier.key">
          <span class="smr__swatch" :class="`is-${tier.key}`" aria-hidden="true"></span>{{ tier.label }}
        </li>
      </ul>
    </header>

    <p v-if="loading" class="smr__empty">Calculating WorkTime…</p>
    <p v-else-if="!ranked.length" class="smr__empty">No members to rank.</p>

    <div v-else class="smr__chart" @mouseleave="hover = null">
      <div
        v-for="(r, i) in ranked"
        :key="r.userId"
        class="smr__row"
        :class="{ 'is-active': hover?.row.userId === r.userId }"
        tabindex="0"
        :aria-label="ariaLabel(r, i)"
        @mouseenter="show(r, i, $event)"
        @focus="show(r, i, $event)"
        @blur="hover = null"
      >
        <span class="smr__rank">{{ i + 1 }}</span>
        <span class="smr__name" :title="`${r.name} · ${r.groupName}`">
          <span class="smr__gdot" :style="{ background: r.accent }" :title="r.groupName" aria-hidden="true"></span>{{ r.name }}
        </span>
        <span class="smr__track">
          <span
            v-for="t in ticks"
            :key="t"
            class="smr__grid"
            :class="{ 'is-target': t === 100 }"
            :style="{ left: pos(t) }"
            aria-hidden="true"
          ></span>
          <span class="smr__bar" :class="`is-${resultTier(r.total)}`" :style="{ width: pos(Math.max(0, r.total)) }"></span>
          <span class="smr__value" :style="{ left: pos(Math.max(0, r.total)) }">{{ pct(r.total) }}</span>
        </span>
      </div>

      <div class="smr__axis" aria-hidden="true">
        <span></span>
        <span></span>
        <span class="smr__track smr__track--axis">
          <span v-for="t in ticks" :key="t" class="smr__tick" :class="{ 'is-target': t === 100 }" :style="{ left: pos(t) }">{{ t }}%</span>
        </span>
      </div>

      <div v-if="hover" class="smr__tip" :style="{ top: `${hover.top}px` }" role="presentation">
        <p class="smr__tip-title">
          <span class="smr__gdot" :style="{ background: hover.row.accent }"></span>
          #{{ hover.rank }} {{ hover.row.name }}
          <span class="smr__tip-group">{{ hover.row.groupName }}</span>
        </p>
        <dl>
          <div><dt>{{ totalLabel }}</dt><dd class="is-strong">{{ pct(hover.row.total) }}</dd></div>
          <div v-for="part in hover.row.parts || []" :key="part.label">
            <dt>{{ part.label }}</dt>
            <dd>{{ pct(part.value) }}<small v-if="part.note"> · {{ part.note }}</small></dd>
          </div>
        </dl>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue';
import { RESULT_TIERS, resultTier } from '../../utils/summarizeTiers';

const props = defineProps({
  /** [{ userId, name, groupName, accent, total, parts: [{ label, value, note }] }] */
  rows: { type: Array, default: () => [] },
  /** Line under the heading explaining what is ranked. */
  caption: { type: String, default: '' },
  /** Name of the ranked measure, used in the tooltip and labels. */
  totalLabel: { type: String, default: 'Total' },
  /** Legend entries: [{ name, accent }] */
  groups: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false }
});

const hasNumber = (v) => typeof v === 'number' && Number.isFinite(v);
const pct = (v) => (hasNumber(v) ? `${v.toFixed(2)}%` : '—');

const ranked = computed(() =>
  [...props.rows].sort((a, b) => (b.total ?? -Infinity) - (a.total ?? -Infinity) || String(a.name).localeCompare(String(b.name)))
);

// Scale: always shows the 100% target; grows in clean steps past it.
const scale = computed(() => {
  const max = Math.max(100, ...ranked.value.map((r) => (hasNumber(r.total) ? r.total : 0)));
  const step = max <= 150 ? 25 : max <= 300 ? 50 : 100;
  const domain = Math.ceil(max / step) * step;
  return { step, domain };
});
const ticks = computed(() => {
  const out = [];
  for (let t = 0; t <= scale.value.domain; t += scale.value.step) out.push(t);
  return out;
});
const pos = (v) => `${(Math.min(v, scale.value.domain) / scale.value.domain) * 100}%`;

const hover = ref(null);
function show(row, index, event) {
  const el = event.currentTarget;
  hover.value = { row, rank: index + 1, top: el.offsetTop + el.offsetHeight + 2 };
}

const ariaLabel = (r, i) =>
  `Rank ${i + 1}, ${r.name}, ${r.groupName}: ${props.totalLabel} ${pct(r.total)}.` +
  (r.parts || []).map((p) => ` ${p.label} ${pct(p.value)}.`).join('');
</script>

<style scoped>
.smr {
  --smr-rank-col: 32px;
  --smr-name-col: minmax(110px, 190px);

  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  padding: var(--spacing-md) var(--spacing-lg) var(--spacing-lg);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  background: var(--bg-primary);
}

.smr__head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--spacing-sm) var(--spacing-lg);
}

.smr__head h3 {
  margin: 0;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
}

.smr__head p {
  margin: 2px 0 0;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.smr__legend {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
}

.smr__legend li {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.smr__swatch {
  display: inline-block;
  width: 10px;
  height: 10px;
  flex-shrink: 0;
  border-radius: 3px;
  background: var(--smr-tier, var(--text-tertiary));
}

/* A small dot keeps the member's team readable next to the name. */
.smr__gdot {
  display: inline-block;
  width: 8px;
  height: 8px;
  flex-shrink: 0;
  margin-right: 7px;
  border-radius: 50%;
  vertical-align: middle;
}

/* Bar colour reads the result: success / normal / warning / error. */
.is-good { --smr-tier: var(--sz-good, #1f7a4d); }
.is-ok { --smr-tier: var(--sz-ok, #1f4e8c); }
.is-warn { --smr-tier: var(--sz-mid, #9a6700); }
.is-low { --smr-tier: var(--sz-low, #b42318); }
.is-none { --smr-tier: var(--border-dark); }

.smr__empty {
  margin: 0;
  padding: var(--spacing-lg) 0;
  text-align: center;
  font-size: var(--font-size-sm);
  color: var(--text-tertiary);
}

.smr__chart {
  position: relative;
  display: flex;
  flex-direction: column;
}

.smr__row,
.smr__axis {
  display: grid;
  grid-template-columns: var(--smr-rank-col) var(--smr-name-col) 1fr;
  align-items: center;
  column-gap: 10px;
}

.smr__row {
  height: 30px;
  border-radius: var(--radius-sm);
  outline: none;
  cursor: default;
}

.smr__row:hover,
.smr__row.is-active,
.smr__row:focus-visible {
  background: color-mix(in srgb, var(--color-primary) 6%, var(--bg-primary));
}

.smr__row:focus-visible {
  box-shadow: inset 0 0 0 2px var(--color-primary);
}

.smr__rank {
  text-align: right;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  font-variant-numeric: tabular-nums;
  color: var(--text-tertiary);
}

.smr__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--font-size-sm);
  color: var(--text-primary);
}

/* Right margin leaves room for the value label at the bar tip. */
.smr__track {
  position: relative;
  height: 100%;
  margin-right: 64px;
}

.smr__grid {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--border-light);
}

.smr__grid.is-target {
  background: var(--border-dark);
}

.smr__bar {
  position: absolute;
  top: 50%;
  left: 0;
  height: 14px;
  background: var(--smr-tier, var(--text-tertiary));
  transform: translateY(-50%);
  border-radius: 0 4px 4px 0;
  transition: width var(--transition-base);
}

.smr__value {
  position: absolute;
  top: 50%;
  padding-left: 6px;
  transform: translateY(-50%);
  white-space: nowrap;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  font-variant-numeric: tabular-nums;
  color: var(--text-secondary);
}

.smr__axis {
  height: 22px;
  border-top: 1px solid var(--border-light);
}

.smr__tick {
  position: absolute;
  top: 4px;
  transform: translateX(-50%);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--text-tertiary);
}

.smr__tick.is-target {
  font-weight: var(--font-weight-semibold);
  color: var(--text-secondary);
}

.smr__tip {
  position: absolute;
  z-index: 5;
  left: calc(var(--smr-rank-col) + 10px + 110px);
  min-width: 220px;
  padding: 10px 12px;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  box-shadow: var(--shadow-lg);
  pointer-events: none;
}

.smr__tip-title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 6px;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
}

.smr__tip-group {
  font-weight: var(--font-weight-normal);
  color: var(--text-tertiary);
}

.smr__tip dl {
  display: grid;
  gap: 3px;
  margin: 0;
}

.smr__tip dl > div {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  font-size: var(--font-size-xs);
}

.smr__tip dt {
  color: var(--text-tertiary);
}

.smr__tip dd {
  margin: 0;
  font-variant-numeric: tabular-nums;
  color: var(--text-secondary);
}

.smr__tip dd.is-strong {
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
}

.smr__tip small {
  color: var(--text-tertiary);
}

@media (max-width: 640px) {
  .smr {
    --smr-name-col: minmax(80px, 120px);
    padding: var(--spacing-md);
  }

  .smr__track {
    margin-right: 56px;
  }

  .smr__tip {
    left: 8px;
    right: 8px;
    min-width: 0;
  }
}
</style>
