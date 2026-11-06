<template>
  <span v-if="isEmpty" class="pc-none" title="No account">·</span>
  <span v-else class="pc" :class="{ 'pc--strong': strong }" :title="title">
    <span class="pc__slot pc__slot--big" :class="{ 'is-zero': !big }">{{ big || '·' }}</span>
    <span v-if="reviews" class="pc__slot pc__slot--rev" :class="{ 'is-zero': !reviewCount }">{{ reviewCount || '·' }}</span>
    <span class="pc__slot pc__slot--new" :class="{ 'is-zero': !fresh }">{{ fresh || '·' }}</span>
  </span>
</template>

<script setup>
import { computed } from 'vue';

/**
 * One account cell in the monthly profile summarize. The slots always hold
 * their place — big profiles, the reviews behind them (Upwork / Freelancer
 * only) and the new profiles — so a column reads straight down even when a
 * member has nothing on that platform.
 */
const props = defineProps({
  cell: { type: Object, default: null },
  /** True on the platforms that track reviews, which show the middle slot. */
  reviews: { type: Boolean, default: false },
  strong: { type: Boolean, default: false },
});

const big = computed(() => props.cell?.big || 0);
const fresh = computed(() => props.cell?.fresh || 0);
const reviewCount = computed(() => props.cell?.reviews || 0);
const isEmpty = computed(() => !big.value && !fresh.value && !reviewCount.value);

const title = computed(() => {
  if (isEmpty.value) return 'No account';
  const parts = [`${big.value} big`];
  if (props.reviews) parts.push(`${reviewCount.value} review${reviewCount.value === 1 ? '' : 's'}`);
  parts.push(`${fresh.value} new`);
  if (props.cell?.counted !== undefined) parts.push(`counts ${props.cell.counted}`);
  return parts.join(' · ');
});
</script>

<style scoped>
.pc {
  display: inline-flex;
  align-items: stretch;
  gap: 2px;
  padding: 1px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--text-primary) 4%, transparent);
}

.pc-none {
  color: var(--text-tertiary);
}

.pc__slot {
  min-width: 22px;
  padding: 2px 5px;
  border-radius: 5px;
  font-size: 12px;
  font-weight: var(--font-weight-bold);
  font-variant-numeric: tabular-nums;
  line-height: 1.35;
  text-align: center;
}

.pc--strong .pc__slot {
  min-width: 24px;
  font-size: 13px;
}

/* Established profiles carry the weight of the cell. */
.pc__slot--big {
  background: color-mix(in srgb, #1f7a4d 20%, var(--bg-primary));
  color: #14512f;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, #1f7a4d 28%, transparent);
}

/* The reviews behind them, reading as a second figure. */
.pc__slot--rev {
  background: color-mix(in srgb, #2563eb 16%, var(--bg-primary));
  color: #1b4bb8;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, #2563eb 24%, transparent);
}

/* New profiles stay quiet: outlined, not filled. */
.pc__slot--new {
  background: var(--bg-primary);
  color: var(--text-secondary);
  box-shadow: inset 0 0 0 1px var(--border-medium);
}

/* An empty slot keeps the column aligned without drawing the eye. */
.pc__slot.is-zero {
  background: transparent;
  color: color-mix(in srgb, var(--text-tertiary) 55%, transparent);
  font-weight: var(--font-weight-medium);
  box-shadow: none;
}

[data-theme='dark'] .pc__slot--big {
  background: color-mix(in srgb, #4ade80 22%, var(--bg-primary));
  color: #86efac;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, #4ade80 32%, transparent);
}

[data-theme='dark'] .pc__slot--rev {
  background: color-mix(in srgb, #60a5fa 22%, var(--bg-primary));
  color: #bfdbfe;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, #60a5fa 30%, transparent);
}

[data-theme='dark'] .pc__slot--new {
  background: transparent;
  color: var(--text-secondary);
}

/* Last, so an empty slot stays empty whichever colour it would have had. */
[data-theme='dark'] .pc__slot.is-zero {
  background: transparent;
  color: color-mix(in srgb, var(--text-tertiary) 65%, transparent);
  box-shadow: none;
}
</style>
