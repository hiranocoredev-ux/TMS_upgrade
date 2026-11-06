<template>
  <div class="mp-page">
    <header class="mp-header">
      <div>
        <h1>Monthly Plans</h1>
        <p class="mp-sub">Every member's monthly financial goal for the year, by team.</p>
      </div>

      <div class="mp-tools">
        <label class="mp-field">
          <span class="mp-field__label">Year</span>
          <select v-model="year" class="mp-select">
            <option v-for="y in years" :key="y" :value="y">{{ y }}</option>
          </select>
        </label>

        <label class="mp-field">
          <span class="mp-field__label">Team</span>
          <select v-model="groupCode" class="mp-select">
            <option value="all">All teams</option>
            <option v-for="g in groups" :key="g.code" :value="g.code">{{ g.name }}</option>
          </select>
        </label>

        <button type="button" class="mp-btn" :disabled="loading" @click="load">
          {{ loading ? 'Loading…' : 'Refresh' }}
        </button>
        <button type="button" class="mp-btn" :disabled="!rows.length" @click="exportCsv">Export CSV</button>
      </div>
    </header>

    <div v-if="loading && !rows.length" class="mp-state">
      <span class="mp-spinner" aria-hidden="true"></span>
      <p>Loading monthly plans…</p>
    </div>

    <div v-else-if="error" class="mp-state mp-state--error">
      <p>{{ error }}</p>
      <button type="button" class="mp-btn" @click="load">Try again</button>
    </div>

    <div v-else-if="!rows.length" class="mp-state">
      <p class="mp-state__title">No members to plan for</p>
      <p>There are no active team members in this selection.</p>
    </div>

    <template v-else>
      <div class="mp-table-wrap">
        <table class="mp-table">
          <thead>
            <tr>
              <th class="c-no" scope="col">No</th>
              <th class="c-member" scope="col">Member</th>
              <th v-for="m in MONTHS" :key="m.key" class="c-month" scope="col" :title="`${m.label} ${year}`">
                {{ m.short }}
              </th>
            </tr>
          </thead>

          <tbody v-for="band in bands" :key="band.code" class="mp-group" :style="{ '--g-accent': band.accent }">
            <tr class="mp-band">
              <th :colspan="MONTHS.length + 2" scope="rowgroup">
                <span class="mp-band__inner">
                  <span class="mp-band__dot" aria-hidden="true"></span>
                  <span class="mp-band__name">{{ band.name }}</span>
                  <span class="mp-band__meta">
                    {{ band.rows.length }} {{ band.rows.length === 1 ? 'member' : 'members' }} ·
                    {{ band.planned }} planned {{ band.planned === 1 ? 'month' : 'months' }}
                  </span>
                </span>
              </th>
            </tr>

            <tr v-for="(row, i) in band.rows" :key="row.id" class="mp-row">
              <td class="c-no">{{ i + 1 }}</td>
              <td class="c-member">
                <span class="mp-member">
                  <UserAvatar :name="row.name" :profile-image="row.avatarUrl" :size="24" :tooltip="false" />
                  <span class="mp-member__name" :title="row.email">{{ row.name }}</span>
                  <span v-if="row.isBoss" class="mp-tag">Boss</span>
                </span>
              </td>

              <td
                v-for="m in MONTHS"
                :key="m.key"
                class="c-month"
                :class="{ 'is-empty': !row.goals[m.key], 'is-editable': canEditRow(row) }"
                @click="canEditRow(row) && openCell(row, m)"
              >
                <button v-if="canEditRow(row)" type="button" class="mp-cell" :title="cellTitle(row, m)">
                  {{ row.goals[m.key] ? money(row.goals[m.key]) : '—' }}
                </button>
                <span v-else>{{ row.goals[m.key] ? money(row.goals[m.key]) : '—' }}</span>
              </td>

            </tr>

          </tbody>

        </table>
      </div>

      <p class="mp-legend">
        <template v-if="canEdit">
          Click any month to set or change that member's goal<template v-if="editableGroup"> in your own team</template>.
        </template>
        Each cell is that member's own plan for the month. Results and totals live in Summarize.
      </p>
    </template>

    <MonthlyPlanModal
      :is-open="editorOpen"
      :plan="editingPlan"
      :selected-user-id="editingUserId"
      :default-month="editingMonth"
      @close="closeEditor"
      @saved="onSaved"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import UserAvatar from '../components/UserAvatar.vue';
import MonthlyPlanModal from '../components/finance/MonthlyPlanModal.vue';
import { fetchMonthlyPlanMatrix, getMonthlyPlan } from '../services/finance';
import { getESTDateKey } from '../utils/timezoneHelpers';

/** The twelve columns, fixed and in order. */
const MONTHS = [
  ['01', 'January', 'Jan'],
  ['02', 'February', 'Feb'],
  ['03', 'March', 'Mar'],
  ['04', 'April', 'Apr'],
  ['05', 'May', 'May'],
  ['06', 'June', 'Jun'],
  ['07', 'July', 'Jul'],
  ['08', 'August', 'Aug'],
  ['09', 'September', 'Sep'],
  ['10', 'October', 'Oct'],
  ['11', 'November', 'Nov'],
  ['12', 'December', 'Dec'],
].map(([key, label, short]) => ({ key, label, short }));

/** Team accents, colour-blind safe, matching the summarize tables. */
const ACCENTS = ['#2563eb', '#ea580c', '#059669', '#7c3aed', '#db2777', '#0891b2'];

const thisYear = getESTDateKey().slice(0, 4);
const year = ref(thisYear);
const groupCode = ref('all');

const members = ref([]);
const groups = ref([]);
const cells = ref([]);
const canEdit = ref(false);
/** null = every team, a code = that team only, '' = nothing. */
const editableGroup = ref(null);
const loading = ref(false);
const error = ref('');

const editorOpen = ref(false);
const editingPlan = ref(null);
const editingUserId = ref('');
const editingMonth = ref('');

const years = computed(() => {
  const current = Number(thisYear);
  const range = [];
  for (let y = current - 3; y <= current + 1; y += 1) range.push(String(y));
  if (!range.includes(year.value)) range.push(year.value);
  return range.sort();
});

const money = (value) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
    Number(value) || 0,
  );

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const res = await fetchMonthlyPlanMatrix({ year: year.value, groupId: groupCode.value });
    const data = res?.data || {};
    members.value = data.members || [];
    groups.value = data.groups || [];
    cells.value = data.cells || [];
    canEdit.value = !!data.canEdit;
    editableGroup.value = data.editableGroup ?? null;
  } catch (err) {
    error.value = err?.response?.data?.message || err?.message || 'Could not load the monthly plans.';
  } finally {
    loading.value = false;
  }
}

onMounted(load);
watch([year, groupCode], load);

/** userId → { '01': goal, … } for the selected year. */
const goalsByUser = computed(() => {
  const map = new Map();
  for (const cell of cells.value) {
    const monthKey = String(cell.month || '').slice(5, 7);
    if (!monthKey) continue;
    const row = map.get(cell.userId) || map.set(cell.userId, {}).get(cell.userId);
    row[monthKey] = { goal: cell.goal, planId: cell.planId };
  }
  return map;
});

const rows = computed(() =>
  members.value.map((member) => {
    const found = goalsByUser.value.get(member.id) || {};
    const goals = {};
    let total = 0;
    for (const m of MONTHS) {
      const cell = found[m.key];
      goals[m.key] = cell?.goal || 0;
      total += cell?.goal || 0;
    }
    return { ...member, goals, plans: found, total };
  }),
);

/** One block per team, in the groups' own order. */
const bands = computed(() => {
  const order = new Map(groups.value.map((g, i) => [g.code, i]));
  const byCode = new Map();

  for (const row of rows.value) {
    if (!byCode.has(row.group)) {
      const index = order.get(row.group) ?? byCode.size;
      byCode.set(row.group, {
        code: row.group,
        name: groups.value.find((g) => g.code === row.group)?.name || row.group,
        accent: ACCENTS[index % ACCENTS.length],
        rows: [],
      });
    }
    byCode.get(row.group).rows.push(row);
  }

  return [...byCode.values()]
    .sort((a, b) => (order.get(a.code) ?? 99) - (order.get(b.code) ?? 99))
    .map((band) => {
      const totals = {};
      let total = 0;
      let planned = 0;
      for (const m of MONTHS) {
        totals[m.key] = band.rows.reduce((sum, row) => sum + row.goals[m.key], 0);
        total += totals[m.key];
        planned += band.rows.filter((row) => row.goals[m.key] > 0).length;
      }
      return { ...band, totals, total, planned };
    });
});

const totals = computed(() => {
  const months = {};
  let all = 0;
  for (const m of MONTHS) {
    months[m.key] = rows.value.reduce((sum, row) => sum + row.goals[m.key], 0);
    all += months[m.key];
  }
  return { months, all };
});

/** A boss may set their own team's goals; a super admin anyone's. */
const canEditRow = (row) => canEdit.value && (editableGroup.value === null || row.group === editableGroup.value);

const cellTitle = (row, month) =>
  `${row.name} · ${month.label} ${year.value} — ${row.goals[month.key] ? `${money(row.goals[month.key])}, click to change` : 'no plan, click to set one'}`;

/** Clicking a month opens that member's plan, loading the saved one first. */
async function openCell(row, month) {
  editingUserId.value = row.id;
  editingMonth.value = `${year.value}-${month.key}`;
  editingPlan.value = null;

  const existing = row.plans[month.key];
  if (existing?.planId) {
    try {
      const res = await getMonthlyPlan(existing.planId);
      editingPlan.value = res?.data?.plan || null;
    } catch {
      editingPlan.value = null;
    }
  }
  editorOpen.value = true;
}

function closeEditor() {
  editorOpen.value = false;
  editingPlan.value = null;
  editingUserId.value = '';
  editingMonth.value = '';
}

async function onSaved() {
  closeEditor();
  await load();
}

function exportCsv() {
  const lines = [['Team', 'Member', ...MONTHS.map((m) => m.label), 'Total']];
  for (const band of bands.value) {
    for (const row of band.rows) {
      lines.push([band.name, row.name, ...MONTHS.map((m) => row.goals[m.key] || ''), row.total || '']);
    }
    lines.push([band.name, 'Team total', ...MONTHS.map((m) => band.totals[m.key] || ''), band.total || '']);
  }
  lines.push(['All teams', 'Total', ...MONTHS.map((m) => totals.value.months[m.key] || ''), totals.value.all || '']);

  const csv = lines
    .map((row) => row.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `monthly-plans-${year.value}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
</script>

<style scoped>
.mp-page {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  max-width: min(1700px, 100%);
  margin: 0 auto;
  min-width: 0;
}

.mp-header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--spacing-md);
  padding: var(--spacing-lg) var(--spacing-xl);
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.mp-header h1 {
  margin: 0 0 var(--spacing-xs);
  font-size: var(--font-size-3xl);
  font-weight: var(--font-weight-bold);
  letter-spacing: -0.02em;
  color: var(--text-primary);
}

.mp-sub {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.mp-tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-sm);
}

.mp-field {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.mp-field__label {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.mp-select {
  padding: 7px 10px;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: var(--font-size-sm);
}

.mp-btn {
  padding: 7px 14px;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
}

.mp-btn:hover:not(:disabled) {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.mp-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.mp-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-3xl) var(--spacing-lg);
  border: 1px dashed var(--border-medium);
  border-radius: var(--radius-lg);
  color: var(--text-tertiary);
}

.mp-state p {
  margin: 0;
}

.mp-state__title {
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
}

.mp-state--error {
  border-color: #dc2626;
  color: #dc2626;
}

.mp-spinner {
  width: 26px;
  height: 26px;
  border: 3px solid var(--border-light);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: mp-spin 0.8s linear infinite;
}

@keyframes mp-spin {
  to { transform: rotate(360deg); }
}

.mp-table-wrap {
  --mp-no-width: 48px;
  max-height: calc(100vh - var(--topbar-height, 64px) - 210px);
  overflow: auto;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  box-shadow: var(--shadow-sm);
}

.mp-table {
  width: 100%;
  min-width: 1180px;
  overflow: visible;
  border: 0;
  border-radius: 0;
  border-collapse: separate;
  border-spacing: 0;
  font-size: var(--font-size-sm);
  color: var(--text-primary);
}

.mp-table th,
.mp-table td {
  padding: 8px 10px;
  border-bottom: 1px solid var(--border-light);
  background: inherit;
  white-space: nowrap;
  font-size: 13px;
  color: inherit;
  text-transform: none;
  letter-spacing: normal;
  text-align: left;
}

.mp-table thead th {
  position: sticky;
  top: 0;
  z-index: 2;
  background: #14365f;
  color: #c9d8ec;
  border-bottom: 1px solid rgba(255, 255, 255, 0.14);
  font-size: 11px;
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

[data-theme='dark'] .mp-table thead th {
  background: #0b1322;
  color: #b6c3d6;
}

.mp-table tbody tr {
  background: var(--bg-primary);
}

.mp-row:nth-child(odd) {
  background: color-mix(in srgb, var(--text-primary) 2.5%, var(--bg-primary));
}

.mp-row:hover {
  background: color-mix(in srgb, var(--color-primary) 7%, var(--bg-primary));
}

/* Each team carries its own accent down the left edge. */
.mp-group td:first-child,
.mp-group th:first-child {
  box-shadow: inset 3px 0 0 var(--g-accent);
}

.mp-band th {
  padding: 6px 12px;
  background: color-mix(in srgb, var(--g-accent) 10%, var(--bg-primary));
  border-bottom: 1px solid var(--border-light);
}

.mp-band__inner {
  position: sticky;
  left: 12px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.mp-band__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--g-accent);
}

.mp-band__name {
  font-size: 12px;
  font-weight: var(--font-weight-bold);
}

.mp-band__meta {
  font-size: 11px;
  color: var(--text-tertiary);
}

.mp-sum {
  background: color-mix(in srgb, var(--g-accent, var(--color-primary)) 8%, var(--bg-primary));
  font-weight: var(--font-weight-semibold);
}

.mp-sum--all {
  position: sticky;
  bottom: 0;
  z-index: 2;
  background: color-mix(in srgb, var(--color-primary) 12%, var(--bg-primary));
  border-top: 2px solid color-mix(in srgb, var(--color-primary) 40%, var(--border-medium));
  font-weight: var(--font-weight-bold);
}

.c-no {
  position: sticky;
  left: 0;
  z-index: 1;
  width: var(--mp-no-width);
  min-width: var(--mp-no-width);
  max-width: var(--mp-no-width);
  text-align: center !important;
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
}

.c-member {
  position: sticky;
  left: var(--mp-no-width);
  z-index: 1;
  min-width: 210px;
  box-shadow: 1px 0 0 var(--border-light);
}

.mp-table thead th.c-no,
.mp-table thead th.c-member {
  z-index: 3;
}

.mp-member {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.mp-member__name {
  font-weight: var(--font-weight-medium);
}

.mp-tag {
  padding: 1px 7px;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--color-primary) 16%, var(--bg-primary));
  color: var(--color-primary);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.c-month {
  width: 88px;
  text-align: right !important;
  font-variant-numeric: tabular-nums;
}

.c-month.is-empty {
  color: var(--text-tertiary);
}

.c-month.is-editable {
  padding: 0;
  cursor: pointer;
}

.mp-cell {
  width: 100%;
  padding: 8px 10px;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-variant-numeric: tabular-nums;
  text-align: right;
  cursor: pointer;
}

.c-month.is-editable:hover {
  background: color-mix(in srgb, var(--color-primary) 14%, var(--bg-primary));
}

.c-total {
  position: sticky;
  right: 0;
  z-index: 1;
  width: 110px;
  text-align: right !important;
  font-variant-numeric: tabular-nums;
  font-weight: var(--font-weight-semibold);
  background: inherit;
  box-shadow: inset 2px 0 0 color-mix(in srgb, var(--color-primary) 30%, var(--border-light));
}

.mp-table thead th.c-total {
  z-index: 3;
}

.mp-legend {
  margin: 0;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}
</style>
