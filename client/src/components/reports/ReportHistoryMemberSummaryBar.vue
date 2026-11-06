<template>
  <section v-if="show" class="rh-summary" aria-label="Member context">
    <div
      v-if="error && !showTicketProgressRow"
      class="rh-summary__panel rh-summary__panel--error"
      role="alert"
    >
      <p class="rh-summary__status">{{ error }}</p>
    </div>

    <div v-else class="rh-summary__panel" :class="{ 'rh-summary__panel--muted': loading && !summary }" role="note">
      <p class="rh-summary__dateHead">{{ dateLabel }}</p>

      <dl class="rh-summary__list">
        <div v-if="showTicketProgressRow" class="rh-summary__row">
          <dt>Work result progress</dt>
          <dd>
            <strong class="rh-summary__value" :class="ticketProgressColorClass">
              {{ ticketProgressDisplay }}
            </strong>
            <span v-if="ticketCount > 0" class="rh-summary__muted">
              — average of {{ ticketCount }} ticket(s)
            </span>
          </dd>
        </div>

        <p v-if="loading && !summary" class="rh-summary__status">Loading member context…</p>
        <p v-else-if="error" class="rh-summary__status rh-summary__status--error">{{ error }}</p>

        <template v-else-if="summary">
          <div class="rh-summary__row">
            <dt>Working Time</dt>
            <dd>
              <strong class="rh-summary__value">{{ workingTimeDisplay }}</strong>
              <span class="rh-summary__muted"> (target: {{ targetTimeDisplay }})</span>
            </dd>
          </div>

          <div class="rh-summary__row">
            <dt>Current Payment Result</dt>
            <dd>
              <strong class="rh-summary__value" :class="profitTone(summary.monthFinance?.profit)">
                {{ formatMoney(summary.monthFinance?.profit) }}
              </strong>
              <span class="rh-summary__muted"> — {{ monthLabel }} net profit</span>
            </dd>
          </div>

          <div class="rh-summary__row rh-summary__row--stack">
            <dt>Last Day's Payment Transactions</dt>
            <dd>
              <p v-if="!dayTransactionLines.length" class="rh-summary__empty">
                No income or outcome recorded for this date.
              </p>
              <ul v-else class="rh-summary__tx">
                <li v-for="(line, idx) in dayTransactionLines" :key="idx">{{ line }}</li>
              </ul>
            </dd>
          </div>
        </template>
      </dl>
    </div>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { getDailyReportHistorySummary } from '../../services/reports';
import { formatDateLongEnUSFromKey, REPORT_PERIODS } from '../../utils/reportPeriod';
import { getReportTicketPercentColorClass } from '../../utils/reportTickets';

const props = defineProps({
  userId: { type: String, default: '' },
  anchorDate: { type: String, default: '' },
  period: { type: String, default: REPORT_PERIODS.DAILY },
  ticketProgressAverage: { type: Number, default: null },
  showTicketProgress: { type: Boolean, default: false },
  ticketCount: { type: Number, default: 0 }
});

const loading = ref(false);
const error = ref('');
const summary = ref(null);

const show = computed(
  () => props.period === REPORT_PERIODS.DAILY && Boolean(props.userId && props.anchorDate)
);

const dateLabel = computed(() => formatDateLongEnUSFromKey(props.anchorDate));

const monthLabel = computed(() => {
  const key = String(props.anchorDate || '').slice(0, 7);
  if (!key) return '';
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  });
});

const showTicketProgressRow = computed(
  () => props.showTicketProgress && props.ticketProgressAverage != null
);

const ticketProgressDisplay = computed(() => `${props.ticketProgressAverage}%`);

const ticketProgressColorClass = computed(() => {
  const tone = getReportTicketPercentColorClass(props.ticketProgressAverage);
  if (tone === 'is-pct-complete') return 'rh-summary__value--pos';
  if (tone === 'is-pct-none') return 'rh-summary__value--neg';
  if (tone === 'is-pct-partial') return 'rh-summary__value--partial';
  return '';
});

const workingTimeDisplay = computed(() => {
  const t = summary.value?.time;
  if (!t) return '—';
  return formatHm(t.totalSeconds);
});

const targetTimeDisplay = computed(() => {
  const t = summary.value?.time;
  if (!t) return '—';
  return formatHm(t.targetSeconds);
});

const dayTransactionLines = computed(() => {
  const txs = summary.value?.dayFinance?.transactions || [];
  if (!txs.length) return [];

  return txs.map((tx) => {
    const typeLabel = tx.type === 'income' ? 'Income' : 'Outcome';
    const amount = formatMoney(tx.amount, tx.currency);
    const label = txLabel(tx);
    const status = String(tx.status || '').trim();
    const statusPart = status ? ` · ${status}` : '';
    return `${typeLabel} ${amount} — ${label}${statusPart}`;
  });
});

function formatHm(totalSeconds) {
  const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h === 0 && m === 0) return '0h 0m';
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatMoney(amount, currency = 'USD') {
  const n = Number(amount) || 0;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 0
    }).format(n);
  } catch {
    return `$${n.toFixed(0)}`;
  }
}

function profitTone(profit) {
  const n = Number(profit) || 0;
  if (n > 0) return 'rh-summary__value--pos';
  if (n < 0) return 'rh-summary__value--neg';
  return '';
}

function txLabel(tx) {
  return String(tx.description || tx.category || tx.source || '—').trim() || '—';
}

async function loadSummary() {
  if (!show.value) {
    summary.value = null;
    error.value = '';
    return;
  }
  loading.value = true;
  error.value = '';
  try {
    const res = await getDailyReportHistorySummary(props.userId, props.anchorDate);
    summary.value = res.data?.data || res.data || null;
  } catch (e) {
    summary.value = null;
    error.value = e?.response?.data?.message || 'Could not load member context.';
  } finally {
    loading.value = false;
  }
}

watch(
  () => [props.userId, props.anchorDate, props.period],
  () => {
    void loadSummary();
  },
  { immediate: true }
);
</script>

<style scoped>
.rh-summary {
  flex-shrink: 0;
  margin-bottom: 0.875rem;
}

.rh-summary__panel {
  padding: 0.75rem 1rem 0.85rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-light);
  background: var(--bg-secondary);
  box-shadow: inset 3px 0 0 0 var(--color-primary);
}

.rh-summary__panel--muted {
  box-shadow: inset 3px 0 0 0 var(--border-medium);
}

.rh-summary__panel--error {
  border-color: color-mix(in srgb, var(--color-error) 35%, var(--border-light));
  background: color-mix(in srgb, var(--color-error) 6%, var(--bg-primary));
  box-shadow: inset 3px 0 0 0 var(--color-error);
}

.rh-summary__status {
  margin: 0;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.rh-summary__status--error {
  color: var(--color-error);
}

.rh-summary__dateHead {
  margin: 0 0 0.6rem;
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}

.rh-summary__list {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.rh-summary__row {
  display: grid;
  grid-template-columns: minmax(7.5rem, 11.5rem) 1fr;
  gap: 0.35rem 0.75rem;
  align-items: baseline;
}

.rh-summary__row--stack {
  align-items: start;
}

.rh-summary__row dt {
  margin: 0;
  font-size: 0.8125rem;
  font-weight: 750;
  color: var(--text-primary);
  letter-spacing: -0.01em;
}

.rh-summary__row dd {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.5;
  color: var(--text-secondary);
}

.rh-summary__value {
  font-weight: 800;
  font-size: 0.875rem;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

.rh-summary__value--pos {
  color: var(--color-success);
}

.rh-summary__value--neg {
  color: var(--color-error);
}

.rh-summary__value--partial {
  color: #2563eb;
}

.rh-summary__muted {
  font-weight: 500;
  color: var(--text-tertiary);
}

.rh-summary__empty {
  margin: 0;
  font-weight: 600;
  color: var(--text-tertiary);
}

.rh-summary__tx {
  margin: 0.15rem 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.rh-summary__tx li {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-secondary);
  line-height: 1.45;
  padding-left: 0.65rem;
  border-left: 2px solid var(--border-medium);
}

@media (max-width: 640px) {
  .rh-summary__row {
    grid-template-columns: 1fr;
    gap: 0.15rem;
  }
}
</style>
