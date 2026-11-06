<template>
  <Teleport to="body">
    <div class="swi-overlay" @mousedown.self="requestClose">
      <div
        ref="dialogRef"
        class="swi-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="swi-title"
      >
        <header class="swi-head">
          <div>
            <h2 id="swi-title">Weekly counts</h2>
            <p class="swi-sub">{{ periodLabel }}</p>
          </div>
          <button type="button" class="swi-close" aria-label="Close" :disabled="saving" @click="requestClose">×</button>
        </header>

        <form id="swi-form" class="swi-body" novalidate @submit.prevent="save">
          <!-- GROUP COUNTS: getting citizen (normal teams), job interview / job offer (job teams) -->
          <section v-for="section in groupSections" :key="section.metric" class="swi-section">
            <h3>
              {{ section.title }}
              <span>{{ section.hint }}</span>
            </h3>
            <table class="swi-table">
              <thead>
                <tr>
                  <th scope="col">{{ section.groupType === 'job' ? 'Job team' : 'Team' }}</th>
                  <th scope="col" class="c-in">Plan</th>
                  <th scope="col" class="c-in">Result</th>
                  <th scope="col" class="c-pct">%</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="g in section.groups" :key="g.code" :style="{ '--g-accent': g.accent }">
                  <th scope="row">
                    <span class="swi-name"><span class="swi-dot" aria-hidden="true"></span>{{ g.name }}</span>
                  </th>
                  <td class="c-in">
                    <input
                      v-model="countForms[key(section.metric, g.code)].plan"
                      type="number"
                      min="0"
                      step="1"
                      inputmode="numeric"
                      :placeholder="String(defaultPlan)"
                      :class="{ 'is-invalid': !isValidCount(countForms[key(section.metric, g.code)].plan) }"
                      :aria-label="`${g.name} ${section.title} plan`"
                    />
                  </td>
                  <td class="c-in">
                    <input
                      v-model="countForms[key(section.metric, g.code)].result"
                      type="number"
                      min="0"
                      step="1"
                      inputmode="numeric"
                      placeholder="0"
                      :class="{ 'is-invalid': !isValidCount(countForms[key(section.metric, g.code)].result) }"
                      :aria-label="`${g.name} ${section.title} result`"
                    />
                  </td>
                  <td class="c-pct">{{ previewPct(countForms[key(section.metric, g.code)], defaultPlan) }}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <!-- MEMBER COUNTS: calls (normal teams) / job interviews (job teams) -->
          <section v-for="section in memberSections" :key="section.groupType" class="swi-section">
            <h3>{{ section.title }} <span>{{ section.hint }}</span></h3>
            <table class="swi-table">
              <thead>
                <tr>
                  <th scope="col">Member</th>
                  <th scope="col" class="c-count">Counted</th>
                  <th scope="col" class="c-in">Plan</th>
                  <th scope="col" class="c-in">Result</th>
                  <th scope="col" class="c-pct">%</th>
                </tr>
              </thead>
              <tbody v-for="g in section.groups" :key="g.code" :style="{ '--g-accent': g.accent }">
                <tr class="swi-band">
                  <th colspan="5" scope="rowgroup">
                    <span class="swi-name"><span class="swi-dot" aria-hidden="true"></span>{{ g.name }}</span>
                  </th>
                </tr>
                <tr v-for="m in g.members" :key="m.userId" :class="{ 'is-excluded': !callForm[m.userId].counted }">
                  <th scope="row" class="swi-member">{{ m.name }}</th>
                  <td class="c-count">
                    <input
                      v-model="callForm[m.userId].counted"
                      type="checkbox"
                      :aria-label="`Count ${m.name} in this week's summarize`"
                      :title="callForm[m.userId].counted ? 'Counted in this week\'s percentages' : 'Left out of this week\'s percentages'"
                    />
                  </td>
                  <td class="c-in">
                    <input
                      v-model="callForm[m.userId].plan"
                      type="number"
                      min="0"
                      step="1"
                      inputmode="numeric"
                      placeholder="—"
                      :class="{ 'is-invalid': !isValidCount(callForm[m.userId].plan) }"
                      :aria-label="`${m.name} ${section.title} plan`"
                    />
                  </td>
                  <td class="c-in">
                    <input
                      v-model="callForm[m.userId].result"
                      type="number"
                      min="0"
                      step="1"
                      inputmode="numeric"
                      placeholder="0"
                      :class="{ 'is-invalid': !isValidCount(callForm[m.userId].result) }"
                      :aria-label="`${m.name} ${section.title} result`"
                    />
                  </td>
                  <td class="c-pct">{{ previewPct(callForm[m.userId]) }}</td>
                </tr>
              </tbody>
            </table>
          </section>
        </form>

        <footer class="swi-foot">
          <p v-if="errorMsg" class="swi-error" role="alert">{{ errorMsg }}</p>
          <span v-else class="swi-changes">
            {{ changeCount ? `${changeCount} unsaved ${changeCount === 1 ? 'change' : 'changes'}` : 'No changes' }}
          </span>
          <div class="swi-actions">
            <button type="button" class="swi-btn" :disabled="saving" @click="requestClose">Cancel</button>
            <button type="submit" form="swi-form" class="swi-btn swi-btn--primary" :disabled="saving || !changeCount">
              {{ saving ? 'Saving…' : 'Save' }}
            </button>
          </div>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { saveWeeklyInputs } from '../../services/summarize';

const props = defineProps({
  period: { type: Object, required: true },
  periodLabel: { type: String, default: '' },
  /** Summarize groups for this week: [{ code, name, type, accent, citizen, interview, offer, members }] */
  groups: { type: Array, default: () => [] },
  /** Weekly plan used for a group metric with no entry. */
  defaultPlan: { type: Number, default: 2 }
});

const emit = defineEmits(['close', 'saved']);

const dialogRef = ref(null);
const saving = ref(false);
const errorMsg = ref('');

/** The weekly outcome count of each group type. */
const METRICS = [
  { metric: 'citizen', title: 'Getting citizen', groupType: 'normal' },
  { metric: 'offer', title: 'Job offer', groupType: 'job' }
];

/** The weekly per-member count of each group type. */
const MEMBER_COUNTS = [
  { groupType: 'normal', title: 'Call count', hint: 'per member · normal teams' },
  { groupType: 'job', title: 'Interview count', hint: 'per member · job teams' }
];

const key = (metric, code) => `${metric}|${code}`;
const isJob = (g) => g.type === 'job';

const groupSections = computed(() =>
  METRICS.map((m) => ({
    ...m,
    hint: `per group · default plan ${props.defaultPlan}`,
    groups: props.groups.filter((g) => (m.groupType === 'job') === isJob(g))
  })).filter((section) => section.groups.length > 0)
);

const memberSections = computed(() =>
  MEMBER_COUNTS.map((section) => ({
    ...section,
    groups: props.groups.filter((g) => (section.groupType === 'job') === isJob(g))
  })).filter((section) => section.groups.length > 0)
);

const toInput = (v) => (v == null ? '' : String(v));

/** '' -> null, otherwise the number (validity checked separately). */
const parseCount = (v) => {
  const t = String(v ?? '').trim();
  return t === '' ? null : Number(t);
};
const isValidCount = (v) => {
  const n = parseCount(v);
  return n === null || (Number.isInteger(n) && n >= 0);
};

// Form state + a snapshot of the starting values, so only changed rows are sent.
const countForms = reactive({});
const callForm = reactive({});
const initial = { counts: {}, calls: {} };

for (const section of METRICS) {
  for (const g of props.groups.filter((x) => (section.groupType === 'job') === isJob(x))) {
    const current = g[section.metric] || {};
    const row = {
      plan: toInput(current.plan ?? props.defaultPlan),
      result: current.result ? toInput(current.result) : ''
    };
    countForms[key(section.metric, g.code)] = { ...row };
    initial.counts[key(section.metric, g.code)] = row;
  }
}

for (const g of props.groups) {
  for (const m of g.members) {
    const calls = m.calls || {};
    const hasEntry = calls.plan != null || !!calls.result;
    const row = {
      plan: toInput(calls.plan),
      result: hasEntry ? toInput(calls.result ?? 0) : '',
      counted: !m.excluded
    };
    callForm[m.userId] = { ...row };
    initial.calls[m.userId] = row;
  }
}

const rowChanged = (row, start) =>
  parseCount(row.plan) !== parseCount(start.plan) ||
  parseCount(row.result) !== parseCount(start.result) ||
  row.counted !== start.counted;

const changedCounts = computed(() =>
  Object.keys(countForms).filter((k) => rowChanged(countForms[k], initial.counts[k]))
);
const changedCalls = computed(() => Object.keys(callForm).filter((uid) => rowChanged(callForm[uid], initial.calls[uid])));
const changeCount = computed(() => changedCounts.value.length + changedCalls.value.length);

function previewPct(row, fallbackPlan = null) {
  const plan = parseCount(row.plan) ?? fallbackPlan;
  const result = parseCount(row.result) ?? 0;
  if (!(plan > 0) || !Number.isFinite(result)) return '—';
  return `${Math.round((result / plan) * 10000) / 100}%`;
}

async function save() {
  errorMsg.value = '';
  const groupCounts = changedCounts.value.map((k) => {
    const [metric, groupCode] = k.split('|');
    return { groupCode, metric, plan: parseCount(countForms[k].plan), result: parseCount(countForms[k].result) };
  });
  const callCounts = changedCalls.value.map((userId) => ({
    userId,
    plan: parseCount(callForm[userId].plan),
    result: parseCount(callForm[userId].result),
    excluded: !callForm[userId].counted
  }));

  const invalid = [...groupCounts, ...callCounts].some(
    (r) => ![r.plan, r.result].every((v) => v === null || (Number.isInteger(v) && v >= 0))
  );
  if (invalid) {
    errorMsg.value = 'Counts must be whole numbers of 0 or more.';
    return;
  }

  saving.value = true;
  try {
    await saveWeeklyInputs({ periodId: String(props.period._id), groupCounts, callCounts });
    emit('saved');
  } catch (err) {
    errorMsg.value = err?.response?.data?.message || err?.message || 'Failed to save weekly counts.';
  } finally {
    saving.value = false;
  }
}

function requestClose() {
  if (saving.value) return;
  if (changeCount.value && !window.confirm('Discard unsaved weekly counts?')) return;
  emit('close');
}

const onKeydown = (e) => {
  if (e.key === 'Escape') requestClose();
};

onMounted(async () => {
  document.addEventListener('keydown', onKeydown);
  await nextTick();
  dialogRef.value?.querySelector('input')?.focus();
});

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown);
});
</script>

<style scoped>
.swi-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal-backdrop, 1040);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(15, 23, 42, 0.55);
}

.swi-dialog {
  display: flex;
  flex-direction: column;
  width: min(760px, 100%);
  max-height: min(88vh, 900px);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  background: var(--bg-primary);
  color: var(--text-primary);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}

.swi-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--spacing-md);
  padding: var(--spacing-md) var(--spacing-lg);
  border-bottom: 1px solid var(--border-light);
}

.swi-head h2 {
  margin: 0;
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
}

.swi-sub {
  margin: 2px 0 0;
  font-size: var(--font-size-sm);
  color: var(--text-tertiary);
}

.swi-close {
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-tertiary);
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
}

.swi-close:hover:not(:disabled) {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.swi-body {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  padding: var(--spacing-md) var(--spacing-lg) var(--spacing-lg);
  overflow-y: auto;
}

.swi-section h3 {
  margin: 0 0 var(--spacing-sm);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
}

.swi-section h3 span {
  margin-left: 6px;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-normal);
  color: var(--text-tertiary);
}

.swi-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-sm);
}

.swi-table th,
.swi-table td {
  padding: 6px 10px;
  border-bottom: 1px solid var(--border-light);
  text-align: left;
}

.swi-table thead th {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  background: var(--bg-tertiary);
}

.swi-table tbody th {
  font-weight: var(--font-weight-medium);
}

.swi-band th {
  padding-top: 10px;
  background: color-mix(in srgb, var(--g-accent) 12%, var(--bg-primary));
  font-weight: var(--font-weight-semibold);
}

.swi-member {
  padding-left: 24px !important;
}

.swi-name {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.swi-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--g-accent, var(--text-tertiary));
}

.c-in {
  width: 110px;
}

.c-count {
  width: 78px;
  text-align: center !important;
}

.c-count input {
  width: 16px;
  height: 16px;
  accent-color: var(--color-primary);
  cursor: pointer;
}

/* A member switched off for the week. */
.swi-table tr.is-excluded th,
.swi-table tr.is-excluded td {
  opacity: 0.55;
}

.c-pct {
  width: 80px;
  text-align: right !important;
  font-variant-numeric: tabular-nums;
  color: var(--text-secondary);
}

.swi-table input {
  width: 100%;
  padding: 5px 8px;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-sm);
  background: var(--bg-primary);
  color: var(--text-primary);
  font: inherit;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.swi-table input:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
  border-color: var(--color-primary);
}

.swi-table input.is-invalid {
  border-color: #dc2626;
}

.swi-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm) var(--spacing-md);
  padding: var(--spacing-md) var(--spacing-lg);
  border-top: 1px solid var(--border-light);
}

.swi-changes {
  font-size: var(--font-size-sm);
  color: var(--text-tertiary);
}

.swi-error {
  margin: 0;
  font-size: var(--font-size-sm);
  color: #dc2626;
}

.swi-actions {
  display: flex;
  gap: var(--spacing-sm);
  margin-left: auto;
}

.swi-btn {
  padding: 7px 16px;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
}

.swi-btn:hover:not(:disabled) {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.swi-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.swi-btn--primary {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: var(--text-inverse);
}

.swi-btn--primary:hover:not(:disabled) {
  background: var(--color-primary-dark);
  color: var(--text-inverse);
}

.swi-btn:focus-visible,
.swi-close:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
</style>
