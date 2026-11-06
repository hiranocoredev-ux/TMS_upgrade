<template>
  <article
    class="dash-card"
    role="button"
    tabindex="0"
    @click="goWorkflow"
    @keydown.enter.prevent="goWorkflow"
    @keydown.space.prevent="goWorkflow"
  >
    <header class="dash-card__head">
      <UserAvatar
        :name="card.name"
        :profile-image="card.avatarUrl || ''"
        :size="48"
        :tooltip="false"
      />
      <div class="dash-card__id">
        <h3 class="dash-card__name">{{ card.name }}</h3>
        <div class="dash-card__chips">
          <span class="chip chip--group" :title="`Group: ${card.group}`">{{ card.group }}</span>
          <span class="chip chip--role" :title="`Role: ${roleLabel}`">{{ roleLabel }}</span>
        </div>
      </div>
    </header>

    <!-- ── Worked hours ───────────────────────────── -->
    <section class="block">
      <div class="block__label">Worked hours</div>
      <div class="hours-row">
        <div class="hours-col">
          <span class="hours-col__sub">Today</span>
          <span class="hours-col__big">{{ formatHm(card.todaySeconds) }}</span>
        </div>
        <div class="hours-col">
          <span class="hours-col__sub">Yesterday</span>
          <span class="hours-col__big hours-col__big--muted">{{ formatHm(card.yesterdaySeconds) }}</span>
        </div>
      </div>
      <div class="progress" :title="`${todayProgressPct}% of 8h target`">
        <div class="progress__bar" :style="{ width: todayProgressPct + '%' }"></div>
      </div>
    </section>

    <!-- ── Daily report ───────────────────────────── -->
    <section class="block">
      <div class="block__label">Daily report</div>
      <div class="daily-row">
        <span class="status-chip" :class="`status-chip--${dailyStatus.tone}`">
          <span class="status-chip__dot"></span>
          {{ dailyStatus.label }}
        </span>
        <span class="placeholder-pct" title="Coming soon">-%</span>
      </div>
    </section>

    <!-- ── Finance ────────────────────────────────── -->
    <section class="block block--finance">
      <div class="block__label">
        Monthly income
        <span class="block__label-sub">(this month)</span>
      </div>
      <div class="finance-row">
        <span class="finance-amount">{{ formatCurrency(card.monthlyIncome) }}</span>
        <span class="placeholder-pct" title="Plan target - coming soon">-%</span>
      </div>
    </section>
  </article>
</template>

<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import UserAvatar from '../UserAvatar.vue';
import { getRoleDisplayName } from '../../constants/roles';

const props = defineProps({
  card: { type: Object, required: true },
});

const router = useRouter();

const roleLabel = computed(() => getRoleDisplayName(props.card.role));

const formatHm = (seconds) => {
  const s = Number(seconds) || 0;
  const totalMinutes = Math.round(s / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const formatCurrency = (n) => {
  const v = Number(n) || 0;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(v);
  } catch {
    return `$${v}`;
  }
};

// Daily.state codes: 0=draft, 1=pending, 3=approved, 4=rejected, null=not started
const STATUS_MAP = {
  null: { label: 'Not Started', tone: 'gray' },
  0: { label: 'Draft', tone: 'amber' },
  1: { label: 'Pending', tone: 'blue' },
  3: { label: 'Approved', tone: 'green' },
  4: { label: 'Rejected', tone: 'red' },
};
const dailyStatus = computed(() => {
  const s = props.card.dailyTodayState;
  return STATUS_MAP[s] || STATUS_MAP[null];
});

// 8h target progress for today
const TARGET_8H = 8 * 3600;
const todayProgressPct = computed(() => {
  const pct = ((Number(props.card.todaySeconds) || 0) / TARGET_8H) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
});

const goWorkflow = () => {
  router.push({ path: '/workflow', query: { userId: props.card.userId } });
};
</script>

<style scoped>
.dash-card {
  --card-radius: 16px;
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: var(--card-radius);
  padding: 1.1rem 1.15rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.95rem;
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
  box-shadow: var(--shadow-md);
  outline: none;
  position: relative;
  overflow: hidden;
}
.dash-card::before {
  content: '';
  position: absolute;
  inset: 0 0 auto 0;
  height: 3px;
  background: linear-gradient(90deg, #6366f1, #8b5cf6, #ec4899);
  opacity: 0;
  transition: opacity 0.18s ease;
}
.dash-card:hover,
.dash-card:focus-visible {
  transform: translateY(-3px);
  border-color: rgba(99, 102, 241, 0.35);
  box-shadow:
    0 1px 2px rgba(17, 24, 39, 0.06),
    0 18px 36px -16px rgba(99, 102, 241, 0.32);
}
.dash-card:hover::before,
.dash-card:focus-visible::before {
  opacity: 1;
}

/* ── Header ── */
.dash-card__head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.dash-card__id {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  min-width: 0;
}
.dash-card__name {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dash-card__chips {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
}
.chip {
  font-size: 0.6875rem;
  font-weight: 700;
  padding: 0.1rem 0.55rem;
  border-radius: 999px;
  letter-spacing: 0.02em;
  line-height: 1.6;
  white-space: nowrap;
}
.chip--group {
  background: var(--color-primary-soft);
  color: var(--color-primary);
  border: 1px solid var(--border-medium);
}
.chip--role {
  background: color-mix(in srgb, #a21caf 14%, var(--bg-primary));
  color: #e879f9;
  border: 1px solid var(--border-medium);
}

/* ── Block ── */
.block {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding-top: 0.75rem;
  border-top: 1px dashed var(--border-light);
}
.block:first-of-type { border-top: 0; padding-top: 0.25rem; }
.block__label {
  font-size: 0.6875rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-tertiary);
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
}
.block__label-sub {
  font-weight: 600;
  text-transform: none;
  letter-spacing: 0;
  color: var(--text-tertiary);
  font-size: 0.6875rem;
}

/* ── Hours block ── */
.hours-row {
  display: flex;
  gap: 0.75rem;
  align-items: stretch;
}
.hours-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}
.hours-col__sub {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.hours-col__big {
  font-size: 1.35rem;
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: -0.01em;
  font-variant-numeric: tabular-nums;
}
.hours-col__big--muted {
  color: var(--text-tertiary);
}
.progress {
  height: 6px;
  background: var(--bg-tertiary);
  border-radius: 999px;
  overflow: hidden;
  margin-top: 0.15rem;
}
.progress__bar {
  height: 100%;
  background: linear-gradient(90deg, #6366f1, #8b5cf6, #ec4899);
  border-radius: 999px;
  transition: width 0.5s cubic-bezier(.2,.7,.3,1);
}

/* ── Daily block ── */
.daily-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}
.status-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.78rem;
  font-weight: 700;
  padding: 0.3rem 0.7rem;
  border-radius: 999px;
  border: 1px solid transparent;
}
.status-chip__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}
.status-chip--gray  { background: var(--bg-tertiary); color: var(--text-secondary); border-color: var(--border-light); }
.status-chip--amber { background: color-mix(in srgb, #f59e0b 18%, var(--bg-primary)); color: #fcd34d; border-color: var(--border-medium); }
.status-chip--blue  { background: var(--color-primary-soft); color: var(--color-primary); border-color: var(--border-medium); }
.status-chip--green { background: color-mix(in srgb, #10b981 16%, var(--bg-primary)); color: #6ee7b7; border-color: var(--border-medium); }
.status-chip--red   { background: color-mix(in srgb, var(--color-error) 18%, var(--bg-primary)); color: #fca5a5; border-color: var(--border-medium); }

.placeholder-pct {
  font-size: 0.85rem;
  font-weight: 700;
  color: #cbd5e1;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
}

/* ── Finance block ── */
.block--finance {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.06), rgba(6, 182, 212, 0.06));
  margin: 0.25rem -1.15rem -1rem;
  padding: 0.75rem 1.15rem 0.9rem;
  border-top: 1px solid rgba(16, 185, 129, 0.18);
  border-bottom-left-radius: var(--card-radius);
  border-bottom-right-radius: var(--card-radius);
}
.finance-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
}
.finance-amount {
  font-size: 1.4rem;
  font-weight: 800;
  color: #047857;
  letter-spacing: -0.01em;
  font-variant-numeric: tabular-nums;
}
</style>
