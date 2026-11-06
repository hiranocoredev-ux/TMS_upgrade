<template>
  <div class="fin-card" :class="{ 'is-missing': plan.missing, 'is-report': isReport }">
    <header class="fin-card__head">
      <div class="fin-card__title">
        <h3>{{ label }}</h3>
        <p class="fin-card__range">{{ range.label || '—' }}</p>
      </div>
      <span class="fin-card__source">From Finance Management</span>
    </header>

    <p v-if="loading" class="fin-card__state">Loading the finance figures…</p>
    <p v-else-if="error" class="fin-card__state fin-card__state--error" role="alert">{{ error }}</p>

    <template v-else>
      <!-- The numbers this section is about -->
      <div class="fin-figures" :class="{ 'is-report': isReport }">
        <div class="fin-figure fin-figure--plan">
          <span class="fin-figure__label">Plan</span>
          <span class="fin-figure__value">{{ plan.missing ? '—' : money(plan.amount) }}</span>
          <span v-if="plan.label" class="fin-figure__note">{{ plan.label }}</span>
        </div>

        <template v-if="isReport">
          <div class="fin-figure">
            <span class="fin-figure__label">Income</span>
            <span class="fin-figure__value">{{ money(result.income) }}</span>
            <span v-if="result.pendingIncome" class="fin-figure__note">
              {{ money(result.pendingIncome) }} pending
            </span>
          </div>
          <div class="fin-figure">
            <span class="fin-figure__label">Outcome</span>
            <span class="fin-figure__value">{{ result.outcome ? money(result.outcome) : '—' }}</span>
          </div>
          <div class="fin-figure fin-figure--result">
            <span class="fin-figure__label">Result</span>
            <span class="fin-figure__value">{{ money(result.profit) }}</span>
            <span class="fin-figure__note">income − outcome</span>
          </div>
          <div class="fin-figure fin-figure--percent" :class="percentTier">
            <span class="fin-figure__label">Achieved</span>
            <span class="fin-figure__value">{{ percent === null ? '—' : `${percent}%` }}</span>
            <span class="fin-percent-bar" aria-hidden="true">
              <span class="fin-percent-bar__fill" :style="{ width: `${Math.min(100, Math.max(0, percent || 0))}%` }"></span>
            </span>
          </div>
        </template>
      </div>

      <p v-if="plan.missing" class="fin-warning" role="alert">
        <strong>No financial plan for this {{ period === 'weekly' ? 'week' : 'month' }} yet.</strong>
        {{ plan.reason || 'A team boss sets it in Finance Management → ' + (period === 'weekly' ? 'Weekly Plans' : 'Monthly Plans') }}.
        <template v-if="mode === 'plan'"> The plan cannot be submitted until it is set.</template>
      </p>

      <!-- Where the number came from, line by line -->
      <section v-if="isReport && transactions.length" class="fin-tx">
        <button type="button" class="fin-tx__toggle" @click="showTransactions = !showTransactions">
          {{ showTransactions ? 'Hide' : 'Show' }} the {{ transactions.length }} transaction{{ transactions.length === 1 ? '' : 's' }}
        </button>

        <table v-if="showTransactions" class="fin-tx__table">
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Source</th>
              <th scope="col">Category</th>
              <th scope="col" class="c-amount">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="tx in transactions" :key="tx.id" :class="`is-${tx.type}`">
              <td>{{ dayLabel(tx.date) }}</td>
              <td>
                <span class="fin-tx__source">{{ tx.source || tx.description || '—' }}</span>
                <span v-if="tx.status === 'pending'" class="fin-tx__pending">pending</span>
              </td>
              <td class="fin-tx__category">{{ tx.category || '—' }}</td>
              <td class="c-amount" :class="tx.type === 'outcome' ? 'is-neg' : 'is-pos'">
                {{ tx.type === 'outcome' ? '−' : '+' }}{{ money(tx.amount) }}
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <th colspan="3" scope="row">Result</th>
              <td class="c-amount">{{ money(result.profit) }}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      <p v-else-if="isReport" class="fin-tx__empty">No transactions in this range yet.</p>

      <!-- The member's own words about the numbers -->
      <div class="fin-notes">
        <span class="fin-notes__label">{{ isReport ? 'How it went' : 'How you plan to reach it' }}</span>
        <ReportRichEditor
          v-if="editable"
          :model-value="modelValue"
          :placeholder="isReport ? 'What brought these numbers in, and what held them back…' : 'Where this income will come from…'"
          @update:model-value="(v) => $emit('update:modelValue', v)"
        />
        <div v-else-if="hasNotes" class="fin-notes__read" v-html="modelValue"></div>
        <p v-else class="fin-notes__empty">—</p>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import ReportRichEditor from './ReportRichEditor.vue';
import { getReportFinanceSection } from '../../services/reportFinance';

/**
 * The income / outcome block that opens every monthly and weekly plan and
 * report. The figures come from Finance Management and the member's own
 * transactions; only the description below them is written here.
 */
const props = defineProps({
  /** 'monthly' | 'weekly' */
  period: { type: String, required: true },
  /** The document's anchor date, YYYY-MM-DD. */
  anchorDate: { type: String, required: true },
  /** Whose figures to read; defaults to the signed-in user. */
  userId: { type: String, default: '' },
  /** 'plan' shows the target only; 'report' adds the result and transactions. */
  mode: { type: String, default: 'plan' },
  modelValue: { type: String, default: '' },
  editable: { type: Boolean, default: true },
  label: { type: String, default: '' },
});

const emit = defineEmits(['update:modelValue', 'status']);

const loading = ref(true);
const error = ref('');
const plan = ref({ amount: 0, missing: true, label: '', reason: '' });
const result = ref({ income: 0, outcome: 0, profit: 0, pendingIncome: 0, count: 0 });
const range = ref({ from: '', to: '', label: '' });
const percent = ref(null);
const transactions = ref([]);
const showTransactions = ref(true);

const isReport = computed(() => props.mode === 'report');

/** Anything worth showing in the read-only view. */
const hasNotes = computed(() =>
  String(props.modelValue || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .trim().length > 0,
);

const money = (value) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
    Number(value) || 0,
  );

const dayLabel = (key) =>
  new Date(`${key}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });

const percentTier = computed(() => {
  if (percent.value === null) return 'is-none';
  if (percent.value >= 100) return 'is-good';
  if (percent.value >= 80) return 'is-ok';
  if (percent.value >= 50) return 'is-warn';
  return 'is-low';
});

async function load() {
  if (!props.anchorDate || !props.period) return;
  loading.value = true;
  error.value = '';
  try {
    const res = await getReportFinanceSection({
      period: props.period,
      date: props.anchorDate,
      userId: props.userId,
    });
    const data = res?.data || {};
    plan.value = data.plan || plan.value;
    result.value = data.result || result.value;
    range.value = data.range || range.value;
    percent.value = data.percent ?? null;
    transactions.value = data.transactions || [];
    emit('status', {
      missing: !!plan.value.missing,
      plan: plan.value.amount,
      result: result.value.profit,
      percent: percent.value,
    });
  } catch (err) {
    error.value = err?.response?.data?.message || err?.message || 'Could not read the finance figures.';
    emit('status', { missing: true, plan: 0, result: 0, percent: null, error: error.value });
  } finally {
    loading.value = false;
  }
}

watch(() => [props.period, props.anchorDate, props.userId], load, { immediate: true });
</script>

<style scoped>
.fin-card {
  border: 1px solid var(--border-light, #e5e7eb);
  border-left: 4px solid var(--color-primary, #2563eb);
  border-radius: 10px;
  background: var(--bg-primary, #fff);
  padding: 16px 18px;
}

.fin-card.is-missing {
  border-left-color: #d97706;
}

.fin-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.fin-card__title h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary, #111827);
}

.fin-card__range {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--text-tertiary, #6b7280);
}

.fin-card__source {
  padding: 2px 9px;
  border-radius: 999px;
  background: var(--bg-tertiary, #f3f4f6);
  color: var(--text-tertiary, #6b7280);
  font-size: 11px;
  white-space: nowrap;
}

.fin-card__state {
  margin: 0;
  font-size: 13px;
  color: var(--text-tertiary, #6b7280);
}

.fin-card__state--error {
  color: #dc2626;
}

.fin-figures {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}

.fin-figure {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  border: 1px solid var(--border-light, #e5e7eb);
  border-radius: 8px;
  background: var(--bg-secondary, #f9fafb);
}

.fin-figure__label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-tertiary, #6b7280);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.fin-figure__value {
  font-size: 20px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--text-primary, #111827);
}

.fin-figure__note {
  font-size: 11px;
  color: var(--text-tertiary, #6b7280);
}

.fin-figure--plan {
  border-color: color-mix(in srgb, var(--color-primary, #2563eb) 35%, transparent);
  background: color-mix(in srgb, var(--color-primary, #2563eb) 7%, var(--bg-primary, #fff));
}

.fin-figure--result .fin-figure__value {
  color: #1f7a4d;
}

.fin-figure--percent .fin-figure__value {
  color: var(--text-primary, #111827);
}

.fin-figure--percent.is-good .fin-figure__value { color: #1f7a4d; }
.fin-figure--percent.is-ok .fin-figure__value { color: #2563eb; }
.fin-figure--percent.is-warn .fin-figure__value { color: #b45309; }
.fin-figure--percent.is-low .fin-figure__value { color: #dc2626; }

.fin-percent-bar {
  display: block;
  height: 4px;
  margin-top: 4px;
  border-radius: 999px;
  background: var(--bg-tertiary, #e5e7eb);
  overflow: hidden;
}

.fin-percent-bar__fill {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: currentColor;
}

.is-good .fin-percent-bar__fill { background: #1f7a4d; }
.is-ok .fin-percent-bar__fill { background: #2563eb; }
.is-warn .fin-percent-bar__fill { background: #d97706; }
.is-low .fin-percent-bar__fill { background: #dc2626; }

.fin-warning {
  margin: 0 0 12px;
  padding: 9px 12px;
  border-left: 3px solid #d97706;
  border-radius: 0 6px 6px 0;
  background: #fffbeb;
  font-size: 12.5px;
  color: #92400e;
}

.fin-tx {
  margin-bottom: 12px;
}

.fin-tx__toggle {
  padding: 4px 10px;
  border: 1px solid var(--border-medium, #d1d5db);
  border-radius: 6px;
  background: var(--bg-primary, #fff);
  color: var(--text-secondary, #374151);
  font-size: 12px;
  cursor: pointer;
}

.fin-tx__table {
  width: 100%;
  margin-top: 8px;
  border-collapse: collapse;
  font-size: 12.5px;
}

.fin-tx__table th,
.fin-tx__table td {
  padding: 6px 8px;
  border-bottom: 1px solid var(--border-light, #e5e7eb);
  text-align: left;
}

.fin-tx__table thead th {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-tertiary, #6b7280);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.fin-tx__table tfoot th,
.fin-tx__table tfoot td {
  border-bottom: 0;
  border-top: 2px solid var(--border-medium, #d1d5db);
  font-weight: 700;
}

.fin-tx__source {
  font-weight: 500;
}

.fin-tx__pending {
  margin-left: 6px;
  padding: 0 6px;
  border-radius: 999px;
  background: #fef3c7;
  color: #92400e;
  font-size: 10px;
}

.fin-tx__category {
  color: var(--text-tertiary, #6b7280);
}

.c-amount {
  text-align: right !important;
  font-variant-numeric: tabular-nums;
}

.c-amount.is-pos {
  color: #1f7a4d;
}

.c-amount.is-neg {
  color: #dc2626;
}

.fin-tx__empty {
  margin: 0 0 12px;
  font-size: 12.5px;
  color: var(--text-tertiary, #6b7280);
}

.fin-notes__read {
  font-size: 13.5px;
  line-height: 1.6;
  color: var(--text-primary, #111827);
}

.fin-notes__empty {
  margin: 0;
  color: var(--text-tertiary, #6b7280);
}

.fin-notes__label {
  display: block;
  margin-bottom: 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-tertiary, #6b7280);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
</style>
