<template>
  <div class="profiles-view">

    <!-- LEFT FILTER PANEL -->
    <div class="filters-section">
      <div class="filter-group">
        <label>Your team</label>
        <p class="team-readonly" :title="teamGroupCode || undefined">
          {{ teamDisplayLabel }}
        </p>
        <span class="field-hint">Only this team’s reports are loaded; you cannot switch groups here.</span>
      </div>

      <div class="filter-2group">
        <div class="filter-group filter-group--calendar">
          <label for="grh-date-from">{{ periodDateLabel }}</label>
          <ReportStatusCalendar
            id="grh-date-from"
            :granularity="calendarGranularity"
            palette="group"
            :dots="groupDots"
            :roster-size="teamRosterSize"
            v-model="filters.from"
            compact
          />
          <span class="field-hint">{{ periodDateHint }}</span>
        </div>
      </div>

      <div class="filter-3group">
        <label for="grh-search">Search in content</label>
        <input
          id="grh-search"
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
      <div class="grh-table-scroll">
        <table class="styled-table">
          <thead>
            <tr>
              <th>Member</th>
              <th>State</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in sidebarRows"
              :key="row.uid"
              :class="{
                'is-row-muted': !row.report,
                'is-selected': row.uid === s_selectedMemberKey
              }"
              :aria-selected="row.uid === s_selectedMemberKey"
              @click="handleRowClick(row)"
            >
              <td><b>{{ row.username }}</b></td>
              <td>
                <span
                  v-if="row.report"
                  :style="{ color: STATE_LABELS[row.report.state]?.color || '#6b7280' }"
                >
                  {{ STATE_LABELS[row.report.state]?.text || '-' }}
                </span>
                <span v-else class="state-missing">Not submitted</span>
              </td>
            </tr>

            <tr v-if="sidebarRows.length === 0">
              <td colspan="2" class="no-data">
                <template v-if="!teamGroupCode">No team assigned.</template>
                <template v-else-if="teamRoster.length === 0">No members loaded for this team.</template>
                <template v-else>No matches for your search.</template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="report-panel">
      <component
        :is="detailViewer"
        v-if="s_reportId"
        :key="`${documentKind}-${s_reportId}`"
        :p_id="s_reportId"
      />
      <ReportHistoryPendingPreview
        v-else-if="selectedMissingMember"
        :key="`${documentKind}-pending-${selectedAnchorDate}-${selectedMissingMember.userId}`"
        :user-id="selectedMissingMember.userId"
        :period="period"
        :anchor-date="selectedAnchorDate"
        :member-name="selectedMissingMember.memberName"
        :group-name="teamDisplayLabel"
        :document-kind="documentKind"
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
import ReportHistoryPendingPreview from '../components/reports/ReportHistoryPendingPreview.vue'
import { fetchUsers } from '../services/users.js'
import {
  buildGroupCoverageDots,
  extractTeamRosterUsersFromResponse,
  rosterMemberDisplayName
} from '../utils/reportCalendarDots'
import DailyReportViewBoss from './DailyReportView_BossChild.vue'
import DailyReportViewSuperAdmin from './DailyReportView_SuperAdminChild.vue'
import { useAuthStore } from '../composables/useAuth';
import { hasAnyRole } from '../utils/permissions';
import { ROLES, normalizeRole } from '../constants/roles';
import { getTeamDocuments } from '../services/periodDocuments.js';
import { getDocumentKindFromRoute } from '../constants/documentKind.js';
import { getReportPeriod, normalizeDateForPeriod, REPORT_PERIODS, formatDateLongEnUSFromKey } from '../utils/reportPeriod';
import { fetchGroups } from '../services/admin.js';
import { useToast } from 'vue-toastification';
import { provideReportHistorySidebarRefresh } from '../composables/useReportHistorySidebarRefresh';

const toast = useToast();
const authStore = useAuthStore();
const route = useRoute();

const detailViewer = computed(() =>
  hasAnyRole(authStore.user, [ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMIN]) ? DailyReportViewSuperAdmin : DailyReportViewBoss
);
const period = computed(() => getReportPeriod(route.meta?.reportPeriod));
const documentKind = computed(() => getDocumentKindFromRoute(route));
const loadingStats = ref(false);
const stats = ref([]);
const s_reportId = ref('');
const s_selectedMemberKey = ref('');
const groups = ref([]);
const teamRoster = ref([]);

const calendarGranularity = computed(() => {
  if (period.value === REPORT_PERIODS.WEEKLY) return 'weekly';
  if (period.value === REPORT_PERIODS.MONTHLY) return 'monthly';
  return 'daily';
});

const teamMemberIds = computed(() =>
  teamRoster.value.map((u) => String(u.id ?? u._id)).filter(Boolean)
);

const teamRosterSize = computed(() => teamMemberIds.value.length);

const groupDots = computed(() => {
  const rows = stats.value.filter((i) => Number(i.state ?? 0) >= 1);
  return buildGroupCoverageDots(rows, period.value, teamMemberIds.value).dots;
});
const STATE_LABELS = {
  1: { text: 'Draft', color: '#9ca3af' },
  2: { text: 'Pending', color: '#2563eb' },
  3: { text: 'Rejected', color: '#dc2626' },
  4: { text: 'Rejected', color: '#dc2626' },
  5: { text: 'Awaiting team boss', color: '#f59e0b' },
  6: { text: 'Approved', color: '#16a34a' }
};

const teamGroupCode = computed(() => (authStore.user?.group && authStore.user.group !== '*' ? authStore.user.group : ''));

const teamDisplayLabel = computed(() => {
  const code = teamGroupCode.value;
  if (!code) return '-';
  const g = groups.value.find((x) => x.code === code);
  return g?.name ? `${g.name} (${code})` : code;
});

const periodDateLabel = computed(() => {
  if (period.value === REPORT_PERIODS.WEEKLY) return 'Week';
  if (period.value === REPORT_PERIODS.MONTHLY) return 'Month';
  return 'Report date';
});

const periodDateTitle = computed(() => {
  if (period.value === REPORT_PERIODS.DAILY) {
    return 'Calendar day: list each member’s report for this day';
  }
  if (period.value === REPORT_PERIODS.WEEKLY) {
    return 'Pick any day in the week; the list uses that whole week';
  }
  return 'Pick any day in the month; the list uses that whole month';
});

const periodDateHint = computed(() => {
  if (period.value === REPORT_PERIODS.DAILY) {
    return 'One day: every team member is listed; open a row when a report exists for that date.';
  }
  if (period.value === REPORT_PERIODS.WEEKLY) {
    return 'Reports are keyed by week (Monday). All members are listed; missing reports show in red.';
  }
  return 'Reports are keyed by calendar month. All members are listed; missing reports show in red.';
});

const loadStats = async ({ preserveSelection = false } = {}) => {
  loadingStats.value = true;
  if (!preserveSelection) {
    s_reportId.value = '';
  }
  const g = teamGroupCode.value;
  if (!g) {
    stats.value = [];
    loadingStats.value = false;
    toast.error('Your account has no team group; cannot load team reports.');
    return;
  }
  try {
    const response = await getTeamDocuments(period.value, g, documentKind.value);
    if (response.data) {
      stats.value = response.data;
    }
  } catch (err) {
    console.error('Error loading stats:', err);
    toast.error('Failed to load reports');
    stats.value = [];
  } finally {
    loadingStats.value = false;
    if (!preserveSelection) {
      syncListSelection(sidebarRows.value);
    }
  }
};

async function loadTeamRoster() {
  const g = teamGroupCode.value;
  if (!g) {
    teamRoster.value = [];
    return;
  }
  try {
    const res = await fetchUsers({ group: g, limit: 1000 });
    teamRoster.value = extractTeamRosterUsersFromResponse(res, { includeBoss: true });
  } catch {
    teamRoster.value = [];
  }
}

onMounted(async () => {
  try {
    const data = await fetchGroups();
    groups.value = data?.data?.groups || data?.groups || [];
  } catch {
    groups.value = [];
  }
  await loadTeamRoster();
  loadStats();
});

watch(period, () => {
  loadStats();
});

watch(documentKind, () => {
  s_reportId.value = '';
  s_selectedMemberKey.value = '';
  loadStats();
});

watch(teamGroupCode, async () => {
  await loadTeamRoster();
});

provideReportHistorySidebarRefresh(() => loadStats({ preserveSelection: true }));

/* ------------------ FILTER STATE ------------------ */
const filters = ref({
  from: new Date().toLocaleDateString("en-CA"),
  content: ""
})

/* ------------------ REPORT DATE KEY (matches other daily report views) ------------------ */
const reportDateKey = (item) => {
  if (!item?.date) return '';
  if (typeof item.date === 'string') return item.date.split('T')[0];
  return new Date(item.date).toISOString().slice(0, 10);
};

function isUserTeamBossInGroup(user, groupCode) {
  if (!user || !groupCode) return false;
  if (String(user.group || '') !== String(groupCode)) return false;
  return normalizeRole(user.role, user.degree) === ROLES.GROUP_BOSS;
}

function reportRankState(s) {
  const n = Number(s ?? 0);
  return { 6: 60, 5: 50, 2: 40, 3: 15, 4: 15, 1: 10 }[n] ?? 0;
}

function pickBestReport(candidates) {
  if (!candidates?.length) return null;
  return [...candidates].sort((a, b) => reportRankState(b.state) - reportRankState(a.state))[0];
}

function normalizeUserIdKey(id) {
  if (id == null || id === '') return '';
  return String(id).trim();
}

function reportMatchesSelectedPeriod(item, selectedRaw, p) {
  const itemKey = reportDateKey(item);
  if (!itemKey) return false;
  if (p === REPORT_PERIODS.DAILY) return itemKey === selectedRaw;
  if (p === REPORT_PERIODS.WEEKLY) {
    return (
      normalizeDateForPeriod(itemKey, REPORT_PERIODS.WEEKLY) ===
      normalizeDateForPeriod(selectedRaw, REPORT_PERIODS.WEEKLY)
    );
  }
  return (
    normalizeDateForPeriod(itemKey, REPORT_PERIODS.MONTHLY) ===
    normalizeDateForPeriod(selectedRaw, REPORT_PERIODS.MONTHLY)
  );
}

/** Full roster + optional report per member; team boss first, then submitted, then missing */
const sidebarRows = computed(() => {
  const selectedRaw = String(filters.value.from || '').split('T')[0];
  const p = period.value;
  const g = teamGroupCode.value;
  const contentQ = filters.value.content.trim().toLowerCase();

  if (!g) return [];

  const byUid = new Map();
  for (const item of stats.value) {
    if (item.state < 1) continue;
    if (!reportMatchesSelectedPeriod(item, selectedRaw, p)) continue;
    const uid = normalizeUserIdKey(item.userId);
    if (!uid) continue;
    const arr = byUid.get(uid) || [];
    arr.push(item);
    byUid.set(uid, arr);
  }

  let rows = teamRoster.value
    .filter((u) => String(u.group || '') === g)
    .map((user) => {
      const uid = normalizeUserIdKey(user.id ?? user._id);
      const report = pickBestReport(byUid.get(uid));
      const hasReport = report != null && Number(report.state ?? 0) >= 1;
      return {
        uid,
        username: rosterMemberDisplayName(user, report),
        report,
        hasReport,
        isTeamBoss: isUserTeamBossInGroup(user, g)
      };
    });

  if (contentQ) {
    rows = rows.filter((row) => {
      if (!row.report) return false;
      let combinedNotes = '';
      if (row.report.sections?.length) {
        combinedNotes = row.report.sections
          .map((s) => `${s.title || ''} ${s.notes || ''}`)
          .join(' ')
          .toLowerCase();
      }
      return combinedNotes.includes(contentQ);
    });
  }

  rows.sort((a, b) => {
    if (a.isTeamBoss !== b.isTeamBoss) return a.isTeamBoss ? -1 : 1;
    if (a.hasReport !== b.hasReport) return a.hasReport ? -1 : 1;
    return String(a.username || '').localeCompare(String(b.username || ''), undefined, {
      sensitivity: 'base'
    });
  });

  return rows;
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

function firstReportIdFromRows(rows) {
  for (const row of rows) {
    const id = row.report?._id;
    if (id) return id;
  }
  return '';
}

function syncListSelection(rows) {
  if (!rows?.length) {
    s_reportId.value = '';
    s_selectedMemberKey.value = '';
    return;
  }
  if (s_selectedMemberKey.value) {
    const current = rows.find((r) => r.uid === s_selectedMemberKey.value);
    if (current) {
      s_reportId.value = current.report?._id || '';
      return;
    }
  }
  const firstWithReport = rows.find((r) => r.report?._id);
  if (firstWithReport) {
    s_selectedMemberKey.value = firstWithReport.uid;
    s_reportId.value = firstWithReport.report._id;
    return;
  }
  s_selectedMemberKey.value = '';
  s_reportId.value = '';
}

watch(sidebarRows, syncListSelection, { immediate: true });

const selectedAnchorDate = computed(() =>
  String(filters.value.from || '').split('T')[0]
);

const selectedMissingMember = computed(() => {
  if (!s_selectedMemberKey.value || s_reportId.value) return null;
  const row = sidebarRows.value.find((r) => r.uid === s_selectedMemberKey.value);
  if (!row || row.report) return null;
  return {
    userId: row.uid,
    memberName: row.username || 'Member'
  };
});

/* ------------------ ROW CLICK ------------------ */
const handleRowClick = (row) => {
  s_selectedMemberKey.value = row.uid;
  s_reportId.value = row.report?._id || '';
};
</script>

<style scoped>
.profiles-view {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  gap: clamp(12px, 2.5vw, 24px);
  width: 100%;
  max-width: 100%;
  margin: 0;
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
  min-height: min(70vh, 640px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  -webkit-overflow-scrolling: touch;
  background: transparent;
  border: none;
  border-radius: 0;
  box-shadow: none;
}

.report-panel :deep(.report-view) {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: min(40vh, 320px);
  padding: 24px 16px;
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  border: 1px dashed var(--border-medium);
}

.empty-state p {
  color: var(--text-secondary);
  font-size: clamp(0.9rem, 2.5vw, 1rem);
  text-align: center;
}

/* FILTER PANEL */
.filters-section {
  flex: 0 0 clamp(200px, 18vw, 260px);
  width: 100%;
  max-width: min(280px, 100%);
  align-self: flex-start;

  background: var(--bg-primary);
  padding: clamp(14px, 3vw, 20px);
  border-radius: 12px;
  border: 1px solid var(--border-light);
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  gap: clamp(12px, 2vw, 18px);
  min-width: 0;
}

.grh-table-scroll {
  min-height: 0;
  overflow-x: auto;
  overflow-y: visible;
  -webkit-overflow-scrolling: touch;
  border: 1px solid var(--border-light);
  border-radius: 8px;
}

.filter-group,
.filter-3group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 99%;
}

.filter-group--calendar {
  max-width: 100%;
}

.filter-2group {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
}

.field-hint {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-tertiary);
  line-height: 1.35;
  text-transform: none;
  letter-spacing: 0;
}

.team-readonly {
  margin: 0;
  padding: 8px 10px;
  border: 1px solid var(--border-light);
  border-radius: 6px;
  background: var(--bg-tertiary);
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.period-summary {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}

.filter-input {
  padding: 8px 10px;
  border: 1px solid var(--border-medium);
  border-radius: 6px;
  font-size: 14px;
  transition: 0.2s;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.filter-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-soft);
}

/* TABLE */
.table-section {
  flex: 1;
  background: var(--bg-primary);
  padding: 20px;
  border-radius: 10px;
  border: 1px solid var(--border-light);
  box-shadow: var(--shadow-sm);
}

.styled-table {
  width: max-content;
  min-width: 100%;
  border-collapse: collapse;
  font-size: clamp(13px, 1.8vw, 14px);
  table-layout: auto;
}

.styled-table thead {
  background: var(--bg-tertiary);
}

.styled-table th {
  text-align: left;
  padding: clamp(8px, 2vw, 12px);
  font-weight: 600;
  color: var(--text-secondary);
  border-bottom: 2px solid var(--border-light);
}

.styled-table td {
  padding: clamp(8px, 2vw, 12px);
  border-bottom: 1px solid var(--border-light);
  color: var(--text-secondary);
  word-break: break-word;
}

.styled-table td b {
  color: var(--text-primary);
}

.styled-table tbody tr {
  cursor: pointer;
  transition: 0.2s;
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

.styled-table tbody tr.is-row-muted {
  opacity: 0.92;
}

.state-missing {
  display: inline-block;
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.12rem 0.45rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-error) 18%, var(--bg-primary));
  color: var(--color-error);
  border: 1px solid color-mix(in srgb, var(--color-error) 35%, transparent);
  white-space: nowrap;
}

.no-data {
  text-align: center;
  padding: 20px;
  color: var(--text-tertiary);
}

@media (max-width: 1024px) {
  .profiles-view {
    flex-direction: column;
    align-items: stretch;
  }

  .filters-section {
    flex: none;
    max-width: none;
  }

  .report-panel {
    min-height: min(55vh, 560px);
    background: transparent;
    border: none;
    box-shadow: none;
  }
}

@media (max-width: 640px) {
  .profiles-view {
    padding-left: max(10px, env(safe-area-inset-left));
    padding-right: max(10px, env(safe-area-inset-right));
  }

  .filters-section {
    padding: 14px;
    border-radius: 10px;
  }
}
</style>