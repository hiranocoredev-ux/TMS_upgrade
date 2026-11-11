<template>
  <div class="wp-page">
    <header class="wp-header">
      <div>
        <h1>Weekly Plans</h1>
        <p class="wp-sub">Every member's weekly target for the month, against the month's plan.</p>
      </div>

      <div class="wp-tools">
        <label class="wp-field">
          <span class="wp-field__label">Month</span>
          <div class="wp-month">
            <button type="button" class="wp-icon-btn" aria-label="Previous month" @click="shiftMonth(-1)">‹</button>
            <TmsNativeCalendarField v-model="month" type="month" title="Month" />
            <button type="button" class="wp-icon-btn" aria-label="Next month" @click="shiftMonth(1)">›</button>
          </div>
        </label>

        <label class="wp-field">
          <span class="wp-field__label">Team</span>
          <select v-model="groupCode" class="wp-select">
            <option value="all">All teams</option>
            <option v-for="g in groups" :key="g.code" :value="g.code">{{ g.name }}</option>
          </select>
        </label>

        <router-link v-if="canEdit" class="wp-btn wp-btn--primary" :to="{ name: 'WeeklyPlansManage' }">
          Manage weeks
        </router-link>
        <router-link v-else-if="isReadOnlyAdmin" class="wp-btn" :to="{ name: 'WeeklyPlansManage' }">
          View weeks
        </router-link>
        <button type="button" class="wp-btn" :disabled="loading" @click="load">
          {{ loading ? 'Loading…' : 'Refresh' }}
        </button>
      </div>
    </header>

    <div v-if="loading && !members.length" class="wp-state">
      <span class="wp-spinner" aria-hidden="true"></span>
      <p>Loading weekly plans…</p>
    </div>

    <div v-else-if="error" class="wp-state wp-state--error">
      <p>{{ error }}</p>
      <button type="button" class="wp-btn" @click="load">Try again</button>
    </div>

    <div v-else-if="!periods.length" class="wp-state">
      <p class="wp-state__title">No weeks set up for {{ monthLabel }}</p>
      <p v-if="canEdit">Create the month's weeks first, then set each member's target.</p>
      <router-link v-if="canEdit" class="wp-btn wp-btn--primary" :to="{ name: 'WeeklyPlansManage' }">
        Manage weeks
      </router-link>
    </div>

    <template v-else>
      <div class="wp-table-wrap">
        <table class="wp-table">
          <thead>
            <tr>
              <th class="c-no" scope="col">No</th>
              <th class="c-member" scope="col">Member</th>
              <th
                v-for="p in periods"
                :key="p.id"
                class="c-week"
                scope="col"
                :class="{ 'is-active': p.id === activePeriodId }"
                :title="`${p.definition} · ${rangeLabel(p)}`"
              >
                <span class="wp-week">
                  <span class="wp-week__name">{{ weekLabel(p) }}</span>
                  <span class="wp-week__range">{{ rangeLabel(p) }}</span>
                  <span v-if="p.id === activePeriodId" class="wp-week__tag">Active</span>
                </span>
              </th>
              <th class="c-total" scope="col">Month plan</th>
            </tr>
          </thead>

          <tbody v-for="band in bands" :key="band.code" class="wp-group" :style="{ '--g-accent': band.accent }">
            <tr class="wp-band">
              <th :colspan="periods.length + 3" scope="rowgroup">
                <span class="wp-band__inner">
                  <span class="wp-band__dot" aria-hidden="true"></span>
                  <span class="wp-band__name">{{ band.name }}</span>
                  <span class="wp-band__meta">{{ band.rows.length }} {{ band.rows.length === 1 ? 'member' : 'members' }}</span>
                </span>
              </th>
            </tr>

            <tr v-for="(row, i) in band.rows" :key="row.id" class="wp-row">
              <td class="c-no">{{ i + 1 }}</td>
              <td class="c-member">
                <span class="wp-member">
                  <UserAvatar :name="row.name" :profile-image="row.avatarUrl" :size="24" :tooltip="false" />
                  <span class="wp-member__name" :title="row.email">{{ row.name }}</span>
                  <span v-if="row.isBoss" class="wp-tag">Boss</span>
                </span>
              </td>

              <td
                v-for="p in periods"
                :key="p.id"
                class="c-week"
                :class="{ 'is-empty': !row.weeks[p.id]?.goal, 'is-editable': canEditRow(row), 'is-active': p.id === activePeriodId }"
                @click="canEditRow(row) && openCell(row, p)"
              >
                <span class="wp-cell">
                  <span class="wp-cell__goal">{{ row.weeks[p.id]?.goal ? money(row.weeks[p.id].goal) : '—' }}</span>
                  <span v-if="row.weeks[p.id]?.income" class="wp-cell__income">{{ money(row.weeks[p.id].income) }} in</span>
                </span>
              </td>

              <td class="c-total">{{ row.monthGoal ? money(row.monthGoal) : '—' }}</td>
            </tr>

          </tbody>

        </table>
      </div>

      <p class="wp-legend">
        <template v-if="canEdit">
          Click a week to set that member's target<template v-if="editableGroup"> in your own team</template>.
        </template>
        Each cell is that week's own target, with the income booked in it underneath.
        <strong>Month plan</strong> is the member's plan for the month, for reference.
        The latest week of the month is the active one.
      </p>
    </template>

    <PeriodicPlanModal
      :is-open="editorOpen"
      :plan="editingPlan"
      :periods="modalPeriods"
      :default-user-id="editingUserId"
      :default-period-id="editingPeriodId"
      :remaining="editingRemaining"
      :is-last-week="editingIsLastWeek"
      @close="closeEditor"
      @saved="onSaved"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import UserAvatar from '../components/UserAvatar.vue';
import TmsNativeCalendarField from '../components/ui/TmsNativeCalendarField.vue';
import PeriodicPlanModal from '../components/finance/PeriodicPlanModal.vue';
import { fetchPeriodicPlanMatrix, getPeriodicPlan } from '../services/finance';
import { getESTMonthKey } from '../utils/timezoneHelpers';
import { useAuthStore } from '../composables/useAuth';
import { isSystemAdminRole } from '../constants/roles';

const ACCENTS = ['#2563eb', '#ea580c', '#059669', '#7c3aed', '#db2777', '#0891b2'];

const month = ref(getESTMonthKey());
const groupCode = ref('all');

const members = ref([]);
const groups = ref([]);
const periods = ref([]);
const cells = ref([]);
const monthlyGoals = ref([]);
const canEdit = ref(false);
const authStore = useAuthStore();
/** Admin (SYSTEM_ADMIN): finance read-only, may still open the weeks page to view. */
const isReadOnlyAdmin = computed(() => isSystemAdminRole(authStore.user?.role, authStore.user?.degree));
/** null = every team, a code = that team only, '' = nothing. */
const editableGroup = ref(null);
const loading = ref(false);
const error = ref('');

const editorOpen = ref(false);
const editingPlan = ref(null);
const editingUserId = ref('');
const editingPeriodId = ref('');
const editingRemaining = ref(null);
const editingIsLastWeek = ref(false);

const money = (value) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
    Number(value) || 0,
  );

const monthLabel = computed(() => {
  const [y, m] = String(month.value || '').split('-').map(Number);
  if (!y || !m) return month.value;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
});

const dayFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const rangeLabel = (period) =>
  `${dayFormat.format(new Date(period.startDate))} – ${dayFormat.format(new Date(period.endDate))}`;

/** "Sep-Week1" reads better in a column head than a free-form name. */
const weekLabel = (period, index = periods.value.indexOf(period)) => {
  const name = String(period.definition || '').trim();
  if (/^[A-Za-z]{3}-Week\d+$/i.test(name)) return name;
  const [, m] = String(period.month || month.value).split('-').map(Number);
  const short = new Date(Date.UTC(2000, (m || 1) - 1, 1)).toLocaleDateString('en-US', {
    month: 'short',
    timeZone: 'UTC',
  });
  return `${short}-Week${index + 1}`;
};

/** The month's last week by date is the one being worked. */
const activePeriodId = computed(() => (periods.value.length ? periods.value[periods.value.length - 1].id : ''));

const modalPeriods = computed(() =>
  periods.value.map((p) => ({ _id: p.id, definition: p.definition, startDate: p.startDate, endDate: p.endDate })),
);

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const res = await fetchPeriodicPlanMatrix({ month: month.value, groupId: groupCode.value });
    const data = res?.data || {};
    members.value = data.members || [];
    groups.value = data.groups || [];
    periods.value = data.periods || [];
    cells.value = data.cells || [];
    monthlyGoals.value = data.monthlyGoals || [];
    canEdit.value = !!data.canEdit;
    editableGroup.value = data.editableGroup ?? null;
  } catch (err) {
    error.value = err?.response?.data?.message || err?.message || 'Could not load the weekly plans.';
  } finally {
    loading.value = false;
  }
}

onMounted(load);
watch([month, groupCode], load);

function shiftMonth(delta) {
  const [y, m] = month.value.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1 + delta, 1));
  month.value = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`;
}

const monthGoalByUser = computed(() => new Map(monthlyGoals.value.map((g) => [g.userId, g.goal])));

const rows = computed(() =>
  members.value.map((member) => {
    const weeks = {};
    let weekTotal = 0;
    let income = 0;
    for (const period of periods.value) {
      const cell = cells.value.find((c) => c.userId === member.id && c.periodId === period.id);
      const found = cells.value.filter((c) => c.userId === member.id && c.periodId === period.id)[0];
      weeks[period.id] = { goal: cell?.goal || 0, income: found?.income || 0, planId: cell?.planId || '' };
      weekTotal += weeks[period.id].goal;
      income += weeks[period.id].income;
    }
    const monthGoal = monthGoalByUser.value.get(member.id) || 0;
    return { ...member, weeks, weekTotal, income, monthGoal, left: Math.max(0, monthGoal - income) };
  }),
);

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
      for (const period of periods.value) {
        totals[period.id] = band.rows.reduce((sum, row) => sum + row.weeks[period.id].goal, 0);
      }
      const weekTotal = band.rows.reduce((sum, row) => sum + row.weekTotal, 0);
      const monthGoal = band.rows.reduce((sum, row) => sum + row.monthGoal, 0);
      const left = band.rows.reduce((sum, row) => sum + row.left, 0);
      return { ...band, totals, weekTotal, monthGoal, left };
    });
});

const totals = computed(() => {
  const weeks = {};
  for (const period of periods.value) {
    weeks[period.id] = rows.value.reduce((sum, row) => sum + row.weeks[period.id].goal, 0);
  }
  return {
    weeks,
    weekTotal: rows.value.reduce((sum, row) => sum + row.weekTotal, 0),
    monthGoal: rows.value.reduce((sum, row) => sum + row.monthGoal, 0),
    left: rows.value.reduce((sum, row) => sum + row.left, 0),
  };
});

/** A boss may set their own team's targets; a super admin anyone's. */
const canEditRow = (row) => canEdit.value && (editableGroup.value === null || row.group === editableGroup.value);

const leftClass = (row) => {
  if (!row.monthGoal) return '';
  if (row.left === 0) return 'is-done';
  return row.weekTotal >= row.left ? 'is-covered' : 'is-short';
};

/**
 * What the weeks from this one on still have to bring in:
 * the month's plan minus everything booked in the earlier weeks.
 */
function remainingFor(row, period) {
  if (!row.monthGoal) return null;
  const index = periods.value.findIndex((p) => p.id === period.id);
  const earlier = periods.value.slice(0, Math.max(0, index));
  const booked = earlier.reduce((sum, p) => sum + (row.weeks[p.id]?.income || 0), 0);
  return Math.max(0, row.monthGoal - booked);
}

async function openCell(row, period) {
  editingUserId.value = row.id;
  editingPeriodId.value = period.id;
  editingRemaining.value = remainingFor(row, period);
  editingIsLastWeek.value = period.id === activePeriodId.value;
  editingPlan.value = null;

  const planId = row.weeks[period.id]?.planId;
  if (planId) {
    try {
      const res = await getPeriodicPlan(planId);
      editingPlan.value = res?.data?.periodicPlan || res?.data?.plan || null;
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
  editingPeriodId.value = '';
  editingRemaining.value = null;
  editingIsLastWeek.value = false;
}

async function onSaved() {
  closeEditor();
  await load();
}
</script>

<style scoped>
.wp-page {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  max-width: min(1700px, 100%);
  margin: 0 auto;
  min-width: 0;
}

.wp-header {
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

.wp-header h1 {
  margin: 0 0 var(--spacing-xs);
  font-size: var(--font-size-3xl);
  font-weight: var(--font-weight-bold);
  letter-spacing: -0.02em;
  color: var(--text-primary);
}

.wp-sub {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.wp-tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-sm);
}

.wp-field {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.wp-field__label {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.wp-month {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.wp-icon-btn {
  width: 28px;
  height: 28px;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
}

.wp-select {
  padding: 7px 10px;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: var(--font-size-sm);
}

.wp-btn {
  display: inline-flex;
  align-items: center;
  padding: 7px 14px;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  text-decoration: none;
  cursor: pointer;
}

.wp-btn:hover:not(:disabled) {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.wp-btn--primary {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: var(--text-inverse);
}

.wp-btn--primary:hover {
  color: var(--text-inverse);
  filter: brightness(1.05);
}

.wp-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.wp-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-3xl) var(--spacing-lg);
  border: 1px dashed var(--border-medium);
  border-radius: var(--radius-lg);
  color: var(--text-tertiary);
}

.wp-state p {
  margin: 0;
}

.wp-state__title {
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
}

.wp-state--error {
  border-color: #dc2626;
  color: #dc2626;
}

.wp-spinner {
  width: 26px;
  height: 26px;
  border: 3px solid var(--border-light);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: wp-spin 0.8s linear infinite;
}

@keyframes wp-spin {
  to { transform: rotate(360deg); }
}

.wp-table-wrap {
  --wp-no-width: 48px;
  max-height: calc(100vh - var(--topbar-height, 64px) - 210px);
  overflow: auto;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  box-shadow: var(--shadow-sm);
}

.wp-table {
  width: 100%;
  min-width: 1080px;
  overflow: visible;
  border: 0;
  border-radius: 0;
  border-collapse: separate;
  border-spacing: 0;
  font-size: var(--font-size-sm);
  color: var(--text-primary);
}

.wp-table th,
.wp-table td {
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

.wp-table thead th {
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
  vertical-align: bottom;
}

[data-theme='dark'] .wp-table thead th {
  background: #0b1322;
  color: #b6c3d6;
}

.wp-table thead th.is-active {
  background: #1d4b80;
  color: #fff;
}

.wp-week {
  display: inline-flex;
  flex-direction: column;
  gap: 1px;
}

.wp-week__range {
  font-size: 10px;
  font-weight: var(--font-weight-medium);
  text-transform: none;
  letter-spacing: 0;
  opacity: 0.75;
}

.wp-week__tag {
  margin-top: 2px;
  padding: 0 6px;
  border-radius: var(--radius-full);
  background: rgba(255, 255, 255, 0.18);
  font-size: 9px;
  letter-spacing: 0.06em;
}

.wp-table tbody tr {
  background: var(--bg-primary);
}

.wp-row:nth-child(odd) {
  background: color-mix(in srgb, var(--text-primary) 2.5%, var(--bg-primary));
}

.wp-row:hover {
  background: color-mix(in srgb, var(--color-primary) 7%, var(--bg-primary));
}

.wp-group td:first-child,
.wp-group th:first-child {
  box-shadow: inset 3px 0 0 var(--g-accent);
}

.wp-band th {
  padding: 6px 12px;
  background: color-mix(in srgb, var(--g-accent) 10%, var(--bg-primary));
  border-bottom: 1px solid var(--border-light);
}

.wp-band__inner {
  position: sticky;
  left: 12px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.wp-band__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--g-accent);
}

.wp-band__name {
  font-size: 12px;
  font-weight: var(--font-weight-bold);
}

.wp-band__meta {
  font-size: 11px;
  color: var(--text-tertiary);
}

.wp-sum {
  background: color-mix(in srgb, var(--g-accent, var(--color-primary)) 8%, var(--bg-primary));
  font-weight: var(--font-weight-semibold);
}

.wp-sum--all {
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
  width: var(--wp-no-width);
  min-width: var(--wp-no-width);
  max-width: var(--wp-no-width);
  text-align: center !important;
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
}

.c-member {
  position: sticky;
  left: var(--wp-no-width);
  z-index: 1;
  width: 240px;
  min-width: 240px;
  box-shadow: 1px 0 0 var(--border-light);
}

.wp-table thead th.c-no,
.wp-table thead th.c-member,
.wp-table thead th.c-total {
  z-index: 3;
}

.wp-member {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.wp-member__name {
  font-weight: var(--font-weight-medium);
}

.wp-tag {
  padding: 1px 7px;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--color-primary) 16%, var(--bg-primary));
  color: var(--color-primary);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.c-week {
  min-width: 124px;
  text-align: right !important;
  font-variant-numeric: tabular-nums;
}

.c-week.is-empty {
  color: var(--text-tertiary);
}

.c-week.is-editable {
  cursor: pointer;
}

.c-week.is-editable:hover {
  background: color-mix(in srgb, var(--color-primary) 14%, var(--bg-primary));
}

tbody .c-week.is-active {
  background: color-mix(in srgb, var(--color-primary) 6%, transparent);
}

.wp-cell {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 1px;
}

.wp-cell__income {
  font-size: 11px;
  color: #1f7a4d;
}

[data-theme='dark'] .wp-cell__income {
  color: #4ade80;
}

.c-num {
  min-width: 118px;
  text-align: right !important;
  font-variant-numeric: tabular-nums;
}

.c-total {
  position: sticky;
  right: 0;
  z-index: 1;
  width: 112px;
  text-align: right !important;
  font-variant-numeric: tabular-nums;
  font-weight: var(--font-weight-semibold);
  background: inherit;
  box-shadow: inset 2px 0 0 color-mix(in srgb, var(--color-primary) 30%, var(--border-light));
}

.c-total.is-done {
  color: #1f7a4d;
}

.c-total.is-covered {
  color: var(--text-primary);
}

.c-total.is-short {
  color: #b45309;
}

[data-theme='dark'] .c-total.is-done {
  color: #4ade80;
}

[data-theme='dark'] .c-total.is-short {
  color: #fbbf24;
}

.wp-legend {
  margin: 0;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
  line-height: 1.7;
}
</style>
