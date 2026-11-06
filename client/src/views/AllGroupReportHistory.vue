<template>
  <div class="profiles-view">

    <!-- LEFT FILTER PANEL -->
    <div class="filters-section">
      <div class="filter-2group">
        <div class="filter-group filter-group--calendar">
          <label for="agrh-date">{{ periodDateLabel }}</label>
          <ReportStatusCalendar
            id="agrh-date"
            :granularity="calendarGranularity"
            palette="group"
            :dots="allTeamsDots"
            :roster-size="rosterSizeForDots"
            v-model="filters.from"
            compact
          />
          <span class="field-hint">{{ periodDateHint }}</span>
        </div>
      </div>

      <div class="filter-group">
        <label for="agrh-group">Group</label>
        <select
          id="agrh-group"
          v-model="filters.group"
          class="filter-input group-select"
          title="Filter by group or view all groups"
        >
          <option value="All">
            All groups ({{ rosterMemberCountAll }})
          </option>
          <option
            v-for="g in groupsSorted"
            :key="g.code"
            :value="g.code"
          >
            {{ g.name }} ({{ rosterMemberCountForGroup(g.code) }})
          </option>
        </select>
        <span class="field-hint">Counts are team members per group (from user directory), not only those who filed this period.</span>
      </div>

      <div class="filter-3group">
        <label for="agrh-search">Search in content</label>
        <input
          id="agrh-search"
          v-model="filters.content"
          type="search"
          placeholder="Match words in section titles or notes…"
          title="Matches any section title or body text"
          autocomplete="off"
          class="filter-input"
        />
        <span class="field-hint">Not case-sensitive; leave empty to show all</span>
      </div>

      <p v-if="selectedPeriodSummary" class="period-summary">{{ selectedPeriodSummary }}</p>

      <div class="table-scroll">
        <table class="styled-table">
          <thead>
            <tr>
              <th class="col-group">Group</th>
              <th class="col-member">Member</th>
              <th class="col-state">State</th>
              <th class="col-created">Created</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in filteredData"
              :key="item.userId"
              :class="{
                'is-row-muted': item._missing,
                'is-selected': rowKey(item) === s_selectedMemberKey
              }"
              :aria-selected="rowKey(item) === s_selectedMemberKey"
              @click="handleRowClick(item)"
            >
              <td class="col-group">{{ displayGroupName(item.group) }}</td>
              <td class="col-member">
                <span class="member-name">{{ item.username }}</span>
                <span v-if="item.isTeamBoss" class="role-pill">Boss</span>
              </td>
              <td class="col-state">
                <span v-if="item._missing" class="state-missing">Not submitted</span>
                <span
                  v-else
                  :style="{ color: STATE_LABELS[item.state]?.color || '#6b7280' }"
                >
                  {{ STATE_LABELS[item.state]?.text || '-' }}
                </span>
              </td>
              <td class="col-created">{{ formatCreatedAt(item) }}</td>
            </tr>

            <tr v-if="filteredData.length === 0">
              <td colspan="4" class="no-data">No team members or no matches for this period / search</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="report-panel">
      <DailyReportView v-if="s_reportId" :key="`${documentKind}-${s_reportId}`" :p_id="s_reportId" />
      <DailyReportView
        v-else-if="selectedMissingMember"
        :key="`${documentKind}-compose-${selectedMissingMember.userId}-${selectedAnchorDate}`"
        :compose-user-id="selectedMissingMember.userId"
        :compose-username="selectedMissingMember.memberName"
        :compose-group="selectedMissingMember.group"
        :compose-anchor-date="selectedAnchorDate"
        @report-saved="onComposeReportSaved"
      />
      <div v-else class="empty-state">
        <p class="empty-state__title">Choose a member</p>
        <p class="empty-state__text">Select someone from the list to review their report for this period.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import ReportStatusCalendar from '../components/reports/ReportStatusCalendar.vue'
import DailyReportView from './DailyReportView_SuperAdminChild.vue'
import { buildGroupCoverageDots, rosterMemberDisplayName } from '../utils/reportCalendarDots'
import { getAllDocuments } from '../services/periodDocuments.js';
import { getDocumentKindFromRoute } from '../constants/documentKind.js';
import { fetchGroups, fetchUsers } from '../services/admin.js';
import {
  getReportPeriod,
  normalizeDateForPeriod,
  REPORT_PERIODS,
  formatDateLongEnUSFromKey
} from '../utils/reportPeriod';
import { ROLES, normalizeRole } from '../constants/roles.js';
import { useToast } from 'vue-toastification';
import { provideReportHistorySidebarRefresh } from '../composables/useReportHistorySidebarRefresh';

const EST_TIMEZONE = 'America/New_York';

const toast = useToast();
const route = useRoute();
const period = computed(() => getReportPeriod(route.meta?.reportPeriod));
const documentKind = computed(() => getDocumentKindFromRoute(route));

const isWeeklyPeriod = computed(() => period.value === REPORT_PERIODS.WEEKLY);
const isMonthlyPeriod = computed(() => period.value === REPORT_PERIODS.MONTHLY);
const calendarGranularity = computed(() => {
  if (period.value === REPORT_PERIODS.WEEKLY) return 'weekly';
  if (period.value === REPORT_PERIODS.MONTHLY) return 'monthly';
  return 'daily';
});

const groups = ref([]);
const roster = ref([]);
const loadingStats = ref(false);
const stats = ref([]);
const s_reportId = ref('');
const s_selectedMemberKey = ref('');

const filters = ref({
  from: new Date().toLocaleDateString('en-CA'),
  content: '',
  group: 'All'
});

const createdFmt = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: EST_TIMEZONE
});

const STATE_LABELS = {
  1: { text: 'Draft',    color: '#9ca3af' },
  2: { text: 'Pending',  color: '#2563eb' },
  3: { text: 'Rejected', color: '#dc2626' },
  4: { text: 'Rejected', color: '#dc2626' },
  5: { text: 'Awaiting team boss', color: '#f59e0b' },
  6: { text: 'Approved', color: '#16a34a' }
};

const periodDateLabel = computed(() => {
  if (period.value === REPORT_PERIODS.WEEKLY) return 'Week';
  if (period.value === REPORT_PERIODS.MONTHLY) return 'Month';
  return 'Report date';
});

const periodDateHint = computed(() => {
  if (period.value === REPORT_PERIODS.DAILY) return 'Lists reports for this calendar day.';
  if (period.value === REPORT_PERIODS.WEEKLY) {
    const scope =
      filters.value.group === 'All'
        ? 'all teams'
        : `team “${displayGroupName(filters.value.group)}”`;
    return `Weeks start on Monday. Dots compare members with report content to the roster for ${scope}: green = all, yellow = partial, red = missing.`;
  }
  if (period.value === REPORT_PERIODS.MONTHLY) {
    const scope =
      filters.value.group === 'All'
        ? 'all teams'
        : `team “${displayGroupName(filters.value.group)}”`;
    return `Pick a month (reports use the 1st of the month). Dots compare members with report content to the roster for ${scope}: green = all, yellow = partial, red = missing.`;
  }
  return '';
});

const reportDateKey = (item) => {
  if (!item?.date) return '';
  if (typeof item.date === 'string') return item.date.split('T')[0];
  return new Date(item.date).toISOString().slice(0, 10);
};

function normalizeUserIdKey(id) {
  if (id == null || id === '') return '';
  return String(id).trim();
}

function matchesReportPeriod(item, selectedDayStr, p) {
  const itemKey = reportDateKey(item);
  if (p === REPORT_PERIODS.DAILY) return itemKey === selectedDayStr;
  if (p === REPORT_PERIODS.WEEKLY) {
    return normalizeDateForPeriod(itemKey, REPORT_PERIODS.WEEKLY) ===
      normalizeDateForPeriod(selectedDayStr, REPORT_PERIODS.WEEKLY);
  }
  return normalizeDateForPeriod(itemKey, REPORT_PERIODS.MONTHLY) ===
    normalizeDateForPeriod(selectedDayStr, REPORT_PERIODS.MONTHLY);
}

const groupsSorted = computed(() =>
  [...groups.value].sort((a, b) => {
    const byName = String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' });
    if (byName !== 0) return byName;
    return String(a.code || '').localeCompare(String(b.code || ''), undefined, { sensitivity: 'base' });
  })
);

const groupOrderIndex = computed(() => {
  const m = new Map();
  groupsSorted.value.forEach((g, i) => m.set(g.code, i));
  return m;
});

function reportRankState(s) {
  const n = Number(s ?? 0);
  return { 6: 60, 5: 50, 2: 40, 3: 15, 4: 15, 1: 10 }[n] ?? 0;
}

function pickBestReport(candidates) {
  if (!candidates?.length) return null;
  return [...candidates].sort((a, b) => reportRankState(b.state) - reportRankState(a.state))[0];
}

function rosterUsersEligible(u) {
  if (!u || u.status === 'disabled') return false;
  if ((u.role || '') === 'SUPER_ADMIN') return false;
  return true;
}

const rosterMemberCountAll = computed(() => roster.value.filter(rosterUsersEligible).length);

function rosterMemberCountForGroup(code) {
  return roster.value.filter((u) => rosterUsersEligible(u) && String(u.group) === String(code)).length;
}

function displayGroupName(code) {
  const g = groups.value.find((x) => x.code === code);
  return g?.name || code || '-';
}

/** Roster slice for calendar dots: matches table when Group is All vs one team */
const rosterIdsForCalendar = computed(() => {
  let users = roster.value.filter(rosterUsersEligible);
  const gf = filters.value.group;
  if (gf && gf !== 'All') {
    users = users.filter((u) => String(u.group) === gf);
  }
  return users.map((u) => String(u.id ?? u._id)).filter(Boolean);
});

const rosterSizeForDots = computed(() => rosterIdsForCalendar.value.length);

const allTeamsDots = computed(() => {
  const rows = stats.value.filter((i) => Number(i.state ?? 0) >= 1);
  return buildGroupCoverageDots(rows, period.value, rosterIdsForCalendar.value).dots;
});

const selectedPeriodSummary = computed(() => {
  const key = String(filters.value.from || '').split('T')[0];
  if (!key) return '';
  if (period.value === REPORT_PERIODS.DAILY) return formatDateLongEnUSFromKey(key);
  if (period.value === REPORT_PERIODS.WEEKLY) {
    const mon = normalizeDateForPeriod(key, REPORT_PERIODS.WEEKLY);
    return `Week of ${formatDateLongEnUSFromKey(mon)}`;
  }
  const mo = normalizeDateForPeriod(key, REPORT_PERIODS.MONTHLY);
  return formatDateLongEnUSFromKey(mo);
});

function formatCreatedAt(item) {
  const raw = item.createdAt || item.updatedAt;
  const d = raw ? new Date(raw) : null;
  if (d && !Number.isNaN(d.getTime())) {
    return createdFmt.format(d);
  }
  const id = item._id;
  if (id && typeof id === 'string' && /^[a-f0-9]{24}$/i.test(id)) {
    const fromOid = new Date(parseInt(id.slice(0, 8), 16) * 1000);
    if (!Number.isNaN(fromOid.getTime())) {
      return `${createdFmt.format(fromOid)} · est.`;
    }
  }
  return '-';
}

const filteredData = computed(() => {
  const selectedRaw = String(filters.value.from || '').split('T')[0];
  const p = period.value;
  const contentQ = filters.value.content.trim().toLowerCase();
  const groupFilter = filters.value.group;

  const byKey = new Map();
  for (const item of stats.value) {
    if (item.state < 1) continue;
    if (!matchesReportPeriod(item, selectedRaw, p)) continue;
    const uid = normalizeUserIdKey(item.userId);
    const g = String(item.group ?? '');
    if (!uid || !g) continue;
    const key = `${g}::${uid}`;
    const arr = byKey.get(key) || [];
    arr.push(item);
    byKey.set(key, arr);
  }

  let users = roster.value.filter(rosterUsersEligible);

  if (groupFilter !== 'All') {
    users = users.filter((u) => String(u.group) === groupFilter);
  }

  const rows = users.map((user) => {
    const uid = normalizeUserIdKey(user.id ?? user._id);
    const g = String(user.group || '');
    const key = `${g}::${uid}`;
    const report = pickBestReport(byKey.get(key) || []);
    const hasReport = report != null && Number(report.state ?? 0) >= 1;
    const isTeamBoss =
      normalizeRole(user.role, user.degree) === ROLES.GROUP_BOSS && !!g;

    return {
      _id: report?._id,
      _missing: !report,
      userId: uid,
      username: rosterMemberDisplayName(user, report),
      group: g,
      state: report?.state,
      createdAt: report?.createdAt,
      updatedAt: report?.updatedAt,
      sections: report?.sections,
      isTeamBoss,
      hasReport
    };
  });

  let out = rows;
  if (contentQ) {
    out = rows.filter((item) => {
      if (!item.sections?.length) return false;
      const combinedNotes = item.sections
        .map((s) => `${s.title || ''} ${s.notes || ''}`)
        .join(' ')
        .toLowerCase();
      return combinedNotes.includes(contentQ);
    });
  }

  return sortRosterRows(out);
});

function sortRosterRows(rows) {
  const order = groupOrderIndex.value;
  const unknown = 999999;
  const rank = (code) => (order.has(code) ? order.get(code) : unknown);

  return [...rows].sort((a, b) => {
    const ga = rank(a.group);
    const gb = rank(b.group);
    if (ga !== gb) return ga - gb;
    if (String(a.group) !== String(b.group)) {
      return String(a.group).localeCompare(String(b.group), undefined, {
        numeric: true,
        sensitivity: 'base'
      });
    }

    const bossCmp = (a.isTeamBoss ? 1 : 0) - (b.isTeamBoss ? 1 : 0);
    if (bossCmp !== 0) return -bossCmp;

    const repCmp = (a.hasReport ? 1 : 0) - (b.hasReport ? 1 : 0);
    if (repCmp !== 0) return -repCmp;

    return String(a.username || '').localeCompare(String(b.username || ''), undefined, {
      sensitivity: 'base'
    });
  });
}

const loadStats = async () => {
  loadingStats.value = true;
  try {
    const response = await getAllDocuments(period.value, documentKind.value);
    if (response.data) {
      stats.value = response.data;
    }
  } catch (err) {
    console.error('Error loading stats:', err);
    toast.error('Failed to load reports');
  } finally {
    loadingStats.value = false;
  }
};

provideReportHistorySidebarRefresh(() => {
  void loadStats();
});

const loadGroups = async () => {
  try {
    const res = await fetchGroups();
    groups.value = res?.data?.groups || res?.groups || [];
  } catch {
    groups.value = [];
  }
};

const loadRoster = async () => {
  const all = [];
  let page = 1;
  const limit = 500;
  try {
    let totalPages = 1;
    do {
      const res = await fetchUsers({ page, limit });
      if (!res?.ok || !res?.data) break;
      const batch = res.data.users || [];
      all.push(...batch);
      totalPages = res.data.pagination?.totalPages || 1;
      page += 1;
    } while (page <= totalPages && page <= 50);
    roster.value = all;
  } catch {
    roster.value = [];
  }
};

onMounted(() => {
  loadStats();
  loadGroups();
  loadRoster();
});

watch(period, () => {
  loadStats();
});

watch(documentKind, () => {
  s_reportId.value = '';
  s_selectedMemberKey.value = '';
  loadStats();
});

function rowKey(item) {
  return `${String(item.group || '')}::${String(item.userId || '')}`;
}

function syncListSelection(rows) {
  if (!rows?.length) {
    s_reportId.value = '';
    s_selectedMemberKey.value = '';
    return;
  }
  if (s_selectedMemberKey.value) {
    const current = rows.find((r) => rowKey(r) === s_selectedMemberKey.value);
    if (current) {
      s_reportId.value = current._id || '';
      return;
    }
  }
  const firstWithReport = rows.find((r) => r._id);
  if (firstWithReport) {
    s_selectedMemberKey.value = rowKey(firstWithReport);
    s_reportId.value = firstWithReport._id;
    return;
  }
  s_selectedMemberKey.value = '';
  s_reportId.value = '';
}

watch(filteredData, syncListSelection, { immediate: true });

const selectedMissingMember = computed(() => {
  if (!s_selectedMemberKey.value || s_reportId.value) return null;
  const row = filteredData.value.find((r) => rowKey(r) === s_selectedMemberKey.value);
  if (!row?._missing) return null;
  return {
    userId: row.userId || '',
    memberName: row.username || 'Member',
    group: row.group || '',
    groupName: displayGroupName(row.group)
  };
});

async function onComposeReportSaved({ id }) {
  if (!id) return;
  await loadStats();
  s_reportId.value = String(id);
}

const selectedAnchorDate = computed(() =>
  String(filters.value.from || '').split('T')[0]
);

const handleRowClick = (item) => {
  s_selectedMemberKey.value = rowKey(item);
  s_reportId.value = item._id || '';
};
</script>

<style scoped>
.profiles-view {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  gap: clamp(12px, 2.5vw, 24px);
  width: 100%;
  max-width: min(1600px, 100%);
  margin: 0 auto;
  padding: clamp(8px, 2vw, 16px) clamp(10px, 3vw, 20px);
  padding-left: max(clamp(10px, 3vw, 20px), env(safe-area-inset-left));
  padding-right: max(clamp(10px, 3vw, 20px), env(safe-area-inset-right));
  box-sizing: border-box;
  min-height: 0;
  flex: 1;
}

.report-panel {
  flex: 1;
  min-width: 0;
  min-height: min(65vh, 600px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  -webkit-overflow-scrolling: touch;
}

.report-panel :deep(.report-view) {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: min(65vh, 560px);
  padding: 2rem 1.5rem;
  text-align: center;
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  border: 1px dashed var(--border-medium);
}

.empty-state__title {
  margin: 0 0 0.5rem;
  font-size: 1.125rem;
  font-weight: 650;
  color: var(--text-primary);
}

.empty-state__text {
  margin: 0;
  max-width: 22rem;
  font-size: 0.875rem;
  color: var(--text-tertiary);
  line-height: 1.5;
}

.filters-section {
  flex: 0 1 clamp(220px, 20vw, 300px);
  width: 100%;
  max-width: min(320px, 100%);
  align-self: flex-start;

  background: var(--bg-primary);
  padding: clamp(14px, 3vw, 20px);
  border-radius: 12px;
  border: 1px solid var(--border-light);
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  gap: clamp(12px, 2vw, 16px);
  min-width: 0;
}

.filter-group,
.filter-3group {
  display: flex;
  flex-direction: column;
  width: 100%;
  gap: 6px;
}

.filter-2group {
  display: flex;
  flex-direction: row;
  justify-content: space-around;
  gap: 12px;
  flex-wrap: wrap;
}

.filter-group--calendar {
  max-width: 100%;
}

.period-summary {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}

label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.field-hint {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-tertiary);
  line-height: 1.35;
  text-transform: none;
  letter-spacing: 0;
}

.filter-input {
  padding: 8px 12px;
  border: 1px solid var(--border-medium);
  border-radius: 8px;
  font-size: 14px;
  transition: 0.2s;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.group-select {
  font-weight: 500;
  color: var(--text-primary);
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  padding-right: 36px;
}

.filter-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-soft);
}

.table-scroll {
  min-height: 0;
  overflow-x: auto;
  overflow-y: visible;
  -webkit-overflow-scrolling: touch;
  border: 1px solid var(--border-light);
  border-radius: 8px;
}

.styled-table {
  width: max-content;
  min-width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  table-layout: auto;
}

.styled-table thead {
  background: var(--bg-tertiary);
}

.styled-table th {
  text-align: left;
  padding: clamp(6px, 1.5vw, 10px) clamp(6px, 1.5vw, 8px);
  font-weight: 600;
  color: var(--text-secondary);
  border-bottom: 2px solid var(--border-light);
}

.styled-table td {
  padding: clamp(6px, 1.5vw, 10px) clamp(6px, 1.5vw, 8px);
  border-bottom: 1px solid var(--border-light);
  color: var(--text-secondary);
  vertical-align: middle;
}

.col-group { min-width: 5rem; }
.col-member { min-width: 7rem; }
.col-created { min-width: 10.5rem; }
.col-state {
  min-width: 7.5rem;
  white-space: nowrap;
}

.member-name {
  font-weight: 600;
  color: var(--text-primary);
}

.role-pill {
  display: inline-block;
  margin-left: 8px;
  padding: 2px 8px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-primary);
  background: var(--color-primary-soft);
  border: 1px solid color-mix(in srgb, var(--color-primary) 35%, transparent);
  border-radius: 999px;
  vertical-align: middle;
}

.col-created {
  font-variant-numeric: tabular-nums;
  color: var(--text-tertiary);
  font-size: 12px;
}

.styled-table tbody tr {
  cursor: pointer;
  transition: 0.15s;
}

.styled-table tbody tr:hover {
  background: var(--color-primary-soft);
}

.styled-table tbody tr.is-selected {
  background: var(--color-primary-soft);
  box-shadow: inset 3px 0 0 0 var(--color-primary);
}

.styled-table tbody tr.is-selected:hover {
  background: var(--color-primary-soft);
}

.state-missing {
  display: inline-block;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-error) 18%, var(--bg-primary));
  color: color-mix(in srgb, var(--color-error) 88%, white);
  border: 1px solid color-mix(in srgb, var(--color-error) 38%, transparent);
  white-space: nowrap;
}

.styled-table tbody tr.is-row-muted {
  opacity: 0.92;
}

.no-data {
  text-align: center;
  padding: 24px 16px;
  color: var(--text-tertiary);
}

@media (max-width: 1100px) {
  .profiles-view {
    flex-direction: column;
    align-items: stretch;
  }

  .filters-section {
    flex: none;
    max-width: none;
  }

  .styled-table {
    font-size: clamp(11px, 2.8vw, 13px);
  }

  .report-panel {
    min-height: min(48vh, 520px);
  }
}

@media (max-width: 480px) {
  .col-created {
    font-size: 10px;
  }

  .role-pill {
    display: block;
    margin-left: 0;
    margin-top: 4px;
    width: fit-content;
  }
}
</style>
