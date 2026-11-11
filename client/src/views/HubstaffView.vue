<template>
  <div class="tt-view">
    <header class="page-hero">
      <div class="page-hero__inner">
        <div class="page-hero__copy">
          <p class="page-hero__eyebrow">Productivity</p>
          <h1 class="page-hero__title">Time &amp; Activity</h1>
          <p class="page-hero__subtitle">
            Run a focused timer, add manual sessions, and review team rollups in one place.
          </p>
        </div>
        </div>
      </header>
    <!-- Tab Bar -->

    <!-- Tab Bar -->
    <div class="tab-bar">
      <button
        class="tab-btn"
        :class="{ active: tab === 'my' }"
        @click="tab = 'my'"
      >
        My Time
      </button>
      <button
        v-if="isAdminOrBoss"
        class="tab-btn"
        :class="{ active: tab === 'team' }"
        @click="tab = 'team'; loadSummary()"
      >
        Team Overview
      </button>
    </div>

    <!-- ════════════════════════════════════════════
         MY TIME TAB
    ═════════════════════════════════════════════ -->
    <div v-if="tab === 'my'" class="tab-content">
     
      <!-- Running Timer Card -->
      <div class="timer-card" :class="{ 'timer-card--running': running }">
        <div class="timer-display">
          <span class="timer-clock">{{ elapsedFormatted }}</span>
          <span class="timer-label">{{ running ? 'Timer running' : 'Timer stopped' }}</span>
        </div>

        <div class="timer-controls">
          <input
            v-model="timerDesc"
            class="timer-desc-input"
            placeholder="What are you working on? (optional)"
            :disabled="running"
          />
          <button
            v-if="!running"
            class="btn btn--start"
            @click="handleStart"
            :disabled="timerLoading"
          >
            ▶ Start Timer
          </button>
          <button
            v-else
            class="btn btn--stop"
            @click="handleStop"
            :disabled="timerLoading"
          >
            ■ Stop
          </button>
        </div>
      </div>

      <!-- Manual Entry Toggle -->
      <div class="section-header">
        <h3>Log Manual Entry</h3>
        <button class="btn-toggle" @click="showManual = !showManual">
          {{ showManual ? 'Cancel' : '+ Add Entry' }}
        </button>
      </div>

      <div v-if="showManual" class="manual-form">
        <div class="form-row">
          <div class="form-group">
            <label>Date</label>
            <TmsNativeCalendarField v-model="form.date" type="date" />
          </div>
          <div class="form-group">
            <label>Start Time</label>
            <input type="time" v-model="form.startTime" />
          </div>
          <div class="form-group">
            <label>End Time</label>
            <input type="time" v-model="form.endTime" />
          </div>
        </div>
        <div class="form-group">
          <label>Description</label>
          <input type="text" v-model="form.description" placeholder="What did you work on?" />
        </div>
        <div class="form-actions">
          <button class="btn btn--primary" @click="handleManualCreate" :disabled="formLoading">
            {{ formLoading ? 'Saving...' : 'Save Entry' }}
          </button>
        </div>
      </div>

      <!-- My Recent Entries -->
      <div class="section-header">
        <h3>Recent Entries</h3>
        <div class="section-header__actions">
          <div class="filter-inline">
            <TmsNativeCalendarField
              v-model="myFilters.date_from"
              type="date"
              @update:model-value="loadMyEntries"
            />
            <span>→</span>
            <TmsNativeCalendarField
              v-model="myFilters.date_to"
              type="date"
              @update:model-value="loadMyEntries"
            />
          </div>
          <button
            type="button"
            class="btn-clear-history"
            :disabled="clearHistoryLoading"
            @click="handleClearAllHistory"
          >
            {{ clearHistoryLoading ? 'Clearing…' : 'Clear all history' }}
          </button>
        </div>
      </div>

      <div v-if="myLoading" class="loading-skeletons">
        <div class="skeleton" v-for="n in 4" :key="n"></div>
      </div>

      <div v-else-if="myEntries.length === 0" class="empty-state">
        <span>⏱️</span>
        <p>No entries yet. Start a timer or add a manual entry.</p>
      </div>

      <div v-else class="entries-list">
        <!-- Group by date -->
        <div v-for="(group, date) in groupedEntries" :key="date" class="day-group">
          <div class="day-header">
            <span class="day-label">{{ formatDateLabel(date) }}</span>
            <span class="day-total">{{ formatDuration(group.total) }}</span>
          </div>
          <div
            v-for="entry in group.entries"
            :key="entry._id"
            class="entry-row"
          >
            <div class="entry-time">
              {{ formatTime(entry.startTime) }} – {{ formatTime(entry.endTime) }}
            </div>
            <div class="entry-desc">{{ entry.description || '-' }}</div>
            <div class="entry-duration">{{ formatDuration(entry.duration) }}</div>
            <button class="btn-delete" @click="handleDelete(entry._id)" title="Delete">✕</button>
          </div>
        </div>
      </div>

    </div>

    <!-- ════════════════════════════════════════════
         TEAM OVERVIEW TAB
    ═════════════════════════════════════════════ -->
    <div v-if="tab === 'team'" class="tab-content">

      <!-- Filters -->
      <div class="filters-bar">
        <div v-if="showTeamGroupFilter" class="filter-group filter-group--team">
          <label>Team</label>
          <select
            v-model="teamGroupFilter"
            class="filter-select"
            @change="onTeamGroupFilterChange"
          >
            <option value="all">All teams</option>
            <option v-for="g in teamGroups" :key="g._id || g.code" :value="g.code">
              {{ g.name || g.code }}
            </option>
          </select>
        </div>
        <div class="filter-group">
          <label>From</label>
          <TmsNativeCalendarField
            v-model="teamFilters.date_from"
            type="date"
            @update:model-value="loadSummary"
          />
        </div>
        <div class="filter-group">
          <label>To</label>
          <TmsNativeCalendarField
            v-model="teamFilters.date_to"
            type="date"
            @update:model-value="loadSummary"
          />
        </div>
        <button class="btn btn--primary" @click="loadSummary" :disabled="summaryLoading">
          {{ summaryLoading ? 'Loading...' : 'Refresh' }}
        </button>
      </div>

      <!-- Summary Cards -->
      <div v-if="summary.length" class="summary-cards">
        <div class="scard">
          <div class="scard-label">Members Tracked</div>
          <div class="scard-value">{{ summary.length }}</div>
        </div>
        <div class="scard">
          <div class="scard-label">Total Hours</div>
          <div class="scard-value">{{ formatDuration(totalTracked) }}</div>
        </div>
        <div class="scard">
          <div class="scard-label">Total Entries</div>
          <div class="scard-value">{{ totalEntries }}</div>
        </div>
        <div class="scard">
          <div class="scard-label">Date Range</div>
          <div class="scard-value scard-value--sm">{{ teamFilters.date_from }} → {{ teamFilters.date_to }}</div>
        </div>
      </div>

      <!-- Error -->
      <div v-if="summaryError" class="error-banner">
        ⚠️ {{ summaryError }}
      </div>

      <!-- Skeleton -->
      <div v-if="summaryLoading" class="loading-skeletons">
        <div class="skeleton skeleton--tall" v-for="n in 5" :key="n"></div>
      </div>

      <!-- Empty -->
      <div v-else-if="!summaryLoading && summary.length === 0 && !summaryError" class="empty-state">
        <span>📋</span>
        <p>No time entries found for this period.</p>
      </div>

      <!-- Team Table -->
      <div v-else-if="summary.length" class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Member</th>
              <th class="col-c">Days Active</th>
              <th class="col-c">Entries</th>
              <th class="col-r">Total Time</th>
              <th class="col-r">Avg / Day</th>
              <th class="col-r">Time Bar</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="row in summary" :key="row.userId">
              <tr class="trow" @click="toggleExpand(row.userId)" style="cursor:pointer">
                <td class="member-cell">
                  <UserAvatar
                    class="member-cell__avatar"
                    :name="row.user?.name || `User #${row.userId}`"
                    :profile-image="row.user?.avatarUrl || ''"
                    :size="34"
                    :tooltip="false"
                  />
                  <div>
                    <div class="mname">{{ row.user?.name || `User #${row.userId}` }}</div>
                    <div class="memail">{{ row.user?.email || '' }}</div>
                  </div>
                </td>
                <td class="col-c">
                  <span class="badge">{{ row.days }}d</span>
                </td>
                <td class="col-c">{{ row.entryCount }}</td>
                <td class="col-r tval">{{ formatDuration(row.totalDuration) }}</td>
                <td class="col-r">{{ row.days ? formatDuration(Math.round(row.totalDuration / row.days)) : '-' }}</td>
                <td class="col-r">
                  <div class="bar-wrap">
                    <div class="bar" :style="{ width: barPct(row.totalDuration) + '%' }"></div>
                  </div>
                </td>
              </tr>
              <!-- Expanded: user entries -->
              <tr v-if="expandedUser === row.userId" class="expanded-row">
                <td colspan="6">
                  <div class="expanded-content">
                    <div v-if="expandLoading" class="expand-loading">Loading entries…</div>
                    <div v-else-if="expandedEntries.length === 0" class="expand-empty">No entries in this range.</div>
                    <template v-else>
                      <div class="expanded-toolbar">
                        <span class="expanded-toolbar-label">Work timeline</span>
                        <button
                          type="button"
                          class="btn btn--export"
                          @click.stop="exportMemberTimelineCsv(row)"
                        >
                          Export CSV
                        </button>
                      </div>
                      <table class="inner-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Start</th>
                            <th>End</th>
                            <th>Duration</th>
                            <th>Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-for="e in expandedEntries" :key="e._id">
                            <td>{{ e.date }}</td>
                            <td>{{ formatTime(e.startTime) }}</td>
                            <td>{{ formatTime(e.endTime) }}</td>
                            <td>{{ formatDuration(e.duration) }}</td>
                            <td>{{ e.description || '-' }}</td>
                          </tr>
                        </tbody>
                      </table>
                    </template>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { getESTDateKey } from '../utils/timezoneHelpers';
import TmsNativeCalendarField from '../components/ui/TmsNativeCalendarField.vue';
import UserAvatar from '../components/UserAvatar.vue';
import { useAuthStore } from '../composables/useAuth';
import { hasAnyRole } from '../utils/permissions';
import { ROLES, LEGACY_ROLES } from '../constants/roles';
import { isGlobalFinanceViewerUser } from '../utils/financeAccess';
import { fetchGroups } from '../services/admin';
import {
  startTimer, stopTimer, getRunningTimer,
  getMyEntries, createEntry, deleteEntry, clearAllMyTimeEntries,
  getSummary, getUserEntries,
} from '../services/timeEntries';

// ── Auth ──────────────────────────────────────────────────────────
const auth = useAuthStore();
const isAdminOrBoss = computed(() =>
  hasAnyRole(auth.user, [
    ROLES.SUPER_ADMIN,
    ROLES.SYSTEM_ADMIN,
    ROLES.GROUP_BOSS,
    LEGACY_ROLES.ADMIN,
    LEGACY_ROLES.BOSS,
  ])
);
const showTeamGroupFilter = computed(() => isGlobalFinanceViewerUser(auth.user));
const teamGroups = ref([]);
const teamGroupFilter = ref('all');

const loadTeamGroups = async () => {
  if (!showTeamGroupFilter.value) return;
  try {
    const res = await fetchGroups();
    teamGroups.value = res?.data?.groups || res?.groups || [];
  } catch {
    teamGroups.value = [];
  }
};

const teamSummaryParams = () => {
  const params = {
    date_from: teamFilters.value.date_from,
    date_to: teamFilters.value.date_to,
  };
  if (showTeamGroupFilter.value && teamGroupFilter.value !== 'all') {
    params.groupId = teamGroupFilter.value;
  }
  return params;
};

const onTeamGroupFilterChange = () => {
  expandedUser.value = null;
  expandedEntries.value = [];
  loadSummary();
};

// ── Tab ───────────────────────────────────────────────────────────
const tab = ref('my');

// ── Timer state ───────────────────────────────────────────────────
const running = ref(null);       // TimeEntry object or null
const timerDesc = ref('');
const timerLoading = ref(false);
const elapsed = ref(0);          // seconds since startTime
let tickInterval = null;

const elapsedFormatted = computed(() => {
  if (!running.value) return '00:00:00';
  const h = Math.floor(elapsed.value / 3600).toString().padStart(2, '0');
  const m = Math.floor((elapsed.value % 3600) / 60).toString().padStart(2, '0');
  const s = (elapsed.value % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
});

const startTick = () => {
  clearInterval(tickInterval);
  if (!running.value) return;
  const base = new Date(running.value.startTime).getTime();
  tickInterval = setInterval(() => {
    elapsed.value = Math.floor((Date.now() - base) / 1000);
  }, 1000);
};

const handleStart = async () => {
  timerLoading.value = true;
  try {
    const res = await startTimer(timerDesc.value);
    running.value = res.data?.data;
    elapsed.value = 0;
    startTick();
    await loadMyEntries();
  } finally {
    timerLoading.value = false;
  }
};

const handleStop = async () => {
  timerLoading.value = true;
  try {
    await stopTimer();
    running.value = null;
    elapsed.value = 0;
    clearInterval(tickInterval);
    timerDesc.value = '';
    await loadMyEntries();
  } finally {
    timerLoading.value = false;
  }
};

// ── Manual form ───────────────────────────────────────────────────
const showManual = ref(false);
const formLoading = ref(false);
const todayStr = () => getESTDateKey();
const form = ref({ date: todayStr(), startTime: '', endTime: '', description: '' });

const handleManualCreate = async () => {
  if (!form.value.date || !form.value.startTime || !form.value.endTime) return;
  formLoading.value = true;
  try {
    await createEntry({
      date: form.value.date,
      startTime: `${form.value.date}T${form.value.startTime}:00`,
      endTime: `${form.value.date}T${form.value.endTime}:00`,
      description: form.value.description,
    });
    form.value = { date: todayStr(), startTime: '', endTime: '', description: '' };
    showManual.value = false;
    await loadMyEntries();
  } finally {
    formLoading.value = false;
  }
};

// ── My entries ────────────────────────────────────────────────────
const myLoading = ref(false);
const clearHistoryLoading = ref(false);
const myEntries = ref([]);
const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  .toISOString().slice(0, 10);
const myFilters = ref({ date_from: firstOfMonth, date_to: todayStr() });

const loadMyEntries = async () => {
  myLoading.value = true;
  try {
    const res = await getMyEntries({
      date_from: myFilters.value.date_from,
      date_to: myFilters.value.date_to,
    });
    myEntries.value = (res.data?.data?.entries || []).filter(e => e.status === 'completed');
  } finally {
    myLoading.value = false;
  }
};

const groupedEntries = computed(() => {
  const groups = {};
  for (const e of myEntries.value) {
    if (!groups[e.date]) groups[e.date] = { entries: [], total: 0 };
    groups[e.date].entries.push(e);
    groups[e.date].total += e.duration || 0;
  }
  return groups;
});

const handleDelete = async (id) => {
  if (!confirm('Delete this entry?')) return;
  await deleteEntry(id);
  await loadMyEntries();
};

const handleClearAllHistory = async () => {
  if (
    !confirm(
      'Delete all of your time entries? This cannot be undone. Any running timer will be removed as well.'
    )
  ) {
    return;
  }
  clearHistoryLoading.value = true;
  try {
    await clearAllMyTimeEntries();
    running.value = null;
    elapsed.value = 0;
    clearInterval(tickInterval);
    tickInterval = null;
    timerDesc.value = '';
    await loadMyEntries();
    const res = await getRunningTimer();
    running.value = res.data?.data || null;
    if (running.value) startTick();
  } catch (err) {
    alert(err.response?.data?.message || err.message || 'Failed to clear history');
  } finally {
    clearHistoryLoading.value = false;
  }
};

// ── Team summary ──────────────────────────────────────────────────
const summaryLoading = ref(false);
const summaryError = ref(null);
const summary = ref([]);
const teamFilters = ref({ date_from: firstOfMonth, date_to: todayStr() });

const totalTracked = computed(() => summary.value.reduce((s, r) => s + r.totalDuration, 0));
const totalEntries = computed(() => summary.value.reduce((s, r) => s + r.entryCount, 0));
const maxDuration = computed(() => Math.max(...summary.value.map(r => r.totalDuration), 1));
const barPct = (dur) => Math.round((dur / maxDuration.value) * 100);

const loadSummary = async () => {
  summaryLoading.value = true;
  summaryError.value = null;
  try {
    const res = await getSummary(teamSummaryParams());
    summary.value = res.data?.data?.summary || [];
  } catch (err) {
    summaryError.value = err.response?.data?.message || err.message;
  } finally {
    summaryLoading.value = false;
  }
};

// ── Expand user detail ────────────────────────────────────────────
const expandedUser = ref(null);
const expandedEntries = ref([]);
const expandLoading = ref(false);

const toggleExpand = async (userId) => {
  if (expandedUser.value === userId) {
    expandedUser.value = null;
    expandedEntries.value = [];
    return;
  }
  expandedUser.value = userId;
  expandedEntries.value = [];
  expandLoading.value = true;
  try {
    const res = await getUserEntries(userId, teamSummaryParams());
    expandedEntries.value = res.data?.data?.entries || [];
  } finally {
    expandLoading.value = false;
  }
};

const csvEscape = (val) => {
  const s = val == null ? '' : String(val);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

const exportMemberTimelineCsv = (row) => {
  if (!expandedEntries.value.length) return;
  const memberName = row.user?.name || `User #${row.userId}`;
  const memberEmail = row.user?.email || '';
  const header = [
    'Member Name',
    'Member Email',
    'Date',
    'Start',
    'End',
    'Duration',
    'Description',
  ].join(',');
  const lines = expandedEntries.value.map((e) =>
    [
      csvEscape(memberName),
      csvEscape(memberEmail),
      csvEscape(e.date),
      csvEscape(formatTime(e.startTime)),
      csvEscape(formatTime(e.endTime)),
      csvEscape(formatDuration(e.duration)),
      csvEscape(e.description || ''),
    ].join(',')
  );
  const csv = `\uFEFF${header}\n${lines.join('\n')}`;
  const safe = memberName.replace(/[^\w\-]+/g, '_').slice(0, 48) || 'member';
  const from = teamFilters.value.date_from;
  const to = teamFilters.value.date_to;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `time-activity_${safe}_${from}_to_${to}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

// ── Formatting ────────────────────────────────────────────────────
const formatDuration = (sec) => {
  if (!sec) return '0h 0m';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
};

const formatTime = (dt) => {
  if (!dt) return '-';
  return new Date(dt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatDateLabel = (dateStr) => {
  const d = new Date(dateStr + 'T00:00:00');
  const today = todayStr();
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (dateStr === today) return 'Today';
  if (dateStr === yesterday) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
};

// ── Init ──────────────────────────────────────────────────────────
onMounted(async () => {
  await loadTeamGroups();
  const res = await getRunningTimer();
  running.value = res.data?.data || null;
  if (running.value) startTick();
  await loadMyEntries();
});

onUnmounted(() => clearInterval(tickInterval));
</script>

<style scoped>
.tt-view {
  --tt-radius: 14px;
  --tt-radius-sm: 10px;
  --tt-line: var(--border-light, #e5e7eb);
  --tt-muted: var(--text-secondary, #6b7280);
  --tt-surface: var(--bg-primary, #fff);
  --tt-elevated: var(--bg-secondary, #f9fafb);
  max-width: 1600px;
  margin: 0 auto;
  padding: clamp(1rem, 3vw, 1.75rem);
  display: flex;
  flex-direction: column;
  gap: clamp(1.25rem, 3vw, 2rem);
}
/* ── Hero ── */
.page-hero {
  position: relative;
  border-radius: var(--tt-radius);
  padding: clamp(1.25rem, 4vw, 2rem) clamp(1.25rem, 3vw, 2rem);
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--color-primary, #6366f1) 12%, var(--tt-surface)) 0%,
    var(--tt-elevated) 48%,
    var(--tt-surface) 100%
  );
  border: 1px solid var(--tt-line);
  box-shadow: var(--shadow-sm, 0 1px 2px rgba(0, 0, 0, 0.05));
  overflow: hidden;
}
.page-hero__inner {
  position: relative;
  z-index: 1;
}
.page-hero__eyebrow {
  margin: 0 0 0.35rem;
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
.page-hero__title {
  margin: 0 0 0.5rem;
  font-size: clamp(1.5rem, 4vw, 1.875rem);
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--text-primary, #111827);
}
.page-hero__subtitle {
  margin: 0;
  max-width: 42rem;
  font-size: 0.9375rem;
  line-height: 1.55;
  color: var(--tt-muted);
}

/* ── Tabs ── */
.tab-bar {
  display: flex;
  gap: var(--spacing-sm);
  border-bottom: 2px solid var(--border-light);
  padding-bottom: 0;
}

.tab-btn {
  padding: var(--spacing-md) var(--spacing-xl);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-base);
}

.tab-btn:hover { color: var(--text-primary); }

.tab-btn.active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}

.tab-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
}

/* ── Timer Card ── */
.timer-card {
  background: var(--bg-primary);
  border: 2px solid var(--border-light);
  border-radius: var(--radius-lg);
  padding: var(--spacing-xl);
  display: flex;
  align-items: center;
  gap: var(--spacing-xl);
  flex-wrap: wrap;
  transition: border-color 0.3s ease;
  box-shadow: var(--shadow-sm);
}

.timer-card--running {
  border-color: #22c55e;
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.15);
}

.timer-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 140px;
}

.timer-clock {
  font-size: 2.5rem;
  font-weight: var(--font-weight-bold);
  font-variant-numeric: tabular-nums;
  color: var(--text-primary);
  letter-spacing: 0.04em;
}

.timer-label {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  margin-top: var(--spacing-xs);
}

.timer-controls {
  flex: 1;
  display: flex;
  gap: var(--spacing-md);
  align-items: center;
  flex-wrap: wrap;
  min-width: 0;
}

.timer-desc-input {
  flex: 1;
  min-width: 180px;
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: var(--font-size-sm);
  font-family: inherit;
}

.timer-desc-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.timer-desc-input:disabled {
  opacity: 0.6;
}

/* ── Buttons ── */
.btn {
  padding: var(--spacing-sm) var(--spacing-xl);
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: all var(--transition-base);
  white-space: nowrap;
}

.btn:disabled { opacity: 0.6; cursor: not-allowed; }

.btn--start {
  background: linear-gradient(135deg, #22c55e, #16a34a);
  color: white;
}

.btn--start:hover:not(:disabled) { filter: brightness(1.1); transform: translateY(-1px); }

.btn--stop {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  color: white;
}

.btn--stop:hover:not(:disabled) { filter: brightness(1.1); transform: translateY(-1px); }

.btn--primary {
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark, #4f46e5));
  color: white;
}

.btn--primary:hover:not(:disabled) { filter: brightness(1.1); transform: translateY(-1px); }

/* ── Section Header ── */
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-header h3 {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  margin: 0;
}

.section-header__actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  flex-wrap: wrap;
  justify-content: flex-end;
}

.btn-clear-history {
  padding: var(--spacing-xs) var(--spacing-md);
  border: 1px solid #fecaca;
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  color: #b91c1c;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: background var(--transition-base), border-color var(--transition-base);
  white-space: nowrap;
}

.btn-clear-history:hover:not(:disabled) {
  background: #fef2f2;
  border-color: #fca5a5;
}

.btn-clear-history:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.btn-toggle {
  padding: var(--spacing-xs) var(--spacing-lg);
  background: var(--bg-tertiary);
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-base);
}

.btn-toggle:hover { background: var(--border-light); color: var(--text-primary); }

/* ── Manual Form ── */
.manual-form {
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  padding: var(--spacing-xl);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  box-shadow: var(--shadow-sm);
}

.form-row {
  display: flex;
  gap: var(--spacing-lg);
  flex-wrap: wrap;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  flex: 1;
  min-width: 140px;
}

.form-group label {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.form-group input {
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: var(--font-size-sm);
  font-family: inherit;
}

.form-group input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.form-actions { display: flex; justify-content: flex-end; }

/* ── Filter inline ── */
.filter-inline {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.filter-inline :deep(.tms-ncf) {
  flex: 1 1 auto;
  max-width: 11rem;
}

/* ── Loading Skeleton ── */
.loading-skeletons { display: flex; flex-direction: column; gap: var(--spacing-sm); }

.skeleton {
  height: 48px;
  border-radius: var(--radius-md);
  background: linear-gradient(90deg, var(--bg-tertiary) 25%, var(--border-light) 50%, var(--bg-tertiary) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
}

.skeleton--tall { height: 60px; }

@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* ── Empty State ── */
.empty-state {
  text-align: center;
  padding: var(--spacing-xl);
  color: var(--text-secondary);
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  font-size: var(--font-size-sm);
}

.empty-state span { font-size: 2.5rem; display: block; margin-bottom: var(--spacing-md); }

/* ── Entries List ── */
.day-group { display: flex; flex-direction: column; }

.day-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--bg-tertiary);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-xs);
}

.day-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
}

.day-total {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
  color: var(--color-primary);
}

.entry-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-xs);
  font-size: var(--font-size-sm);
}

.entry-time {
  color: var(--text-secondary);
  white-space: nowrap;
  min-width: 120px;
  font-variant-numeric: tabular-nums;
}

.entry-desc { flex: 1; color: var(--text-primary); }

.entry-duration {
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.btn-delete {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.75rem;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  transition: all var(--transition-base);
}

.btn-delete:hover { color: #ef4444; background: #fef2f2; }

/* ── Filters Bar ── */
.filters-bar {
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg) var(--spacing-xl);
  display: flex;
  align-items: flex-end;
  gap: var(--spacing-lg);
  flex-wrap: wrap;
  box-shadow: var(--shadow-sm);
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.filter-group label {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.filter-select {
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: var(--font-size-sm);
  font-family: inherit;
}

.filter-group--team .filter-select {
  min-width: 11rem;
}

/* ── Summary Cards ── */
.summary-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: var(--spacing-lg);
}

.scard {
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  padding: var(--spacing-xl);
  box-shadow: var(--shadow-sm);
}

.scard-label {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: var(--spacing-sm);
}

.scard-value {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
}

.scard-value--sm { font-size: var(--font-size-sm); }

/* ── Error Banner ── */
.error-banner {
  background: #fef2f2;
  border: 1px solid #fca5a5;
  color: #dc2626;
  border-radius: var(--radius-md);
  padding: var(--spacing-md) var(--spacing-lg);
  font-size: var(--font-size-sm);
}

/* ── Data Table ── */
.table-wrap {
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  overflow-x: auto;
  box-shadow: var(--shadow-sm);
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-sm);
}

.data-table thead th {
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-light);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  text-align: left;
}

.col-c { text-align: center !important; }
.col-r { text-align: right !important; }

.trow {
  border-bottom: 1px solid var(--border-light);
  transition: background var(--transition-base);
}

.trow:hover { background: var(--bg-secondary); }

.trow td {
  padding: var(--spacing-md) var(--spacing-lg);
  color: var(--text-primary);
  vertical-align: middle;
}

.member-cell {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.member-cell__avatar {
  flex-shrink: 0;
}

.mname { font-weight: var(--font-weight-semibold); }
.memail { font-size: var(--font-size-xs); color: var(--text-secondary); }

.badge {
  display: inline-block;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  border-radius: var(--radius-full);
  padding: 2px 10px;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
}

.tval { font-weight: var(--font-weight-semibold); font-variant-numeric: tabular-nums; }

.bar-wrap {
  width: 80px;
  height: 8px;
  background: var(--bg-tertiary);
  border-radius: var(--radius-full);
  overflow: hidden;
  margin-left: auto;
}

.bar {
  height: 100%;
  background: linear-gradient(90deg, #6366f1, #8b5cf6);
  border-radius: var(--radius-full);
  transition: width 0.4s ease;
}

/* ── Expanded Row ── */
.expanded-row td { padding: 0; background: var(--bg-secondary); }

.expanded-content {
  padding: var(--spacing-lg) var(--spacing-xl);
  border-top: 1px solid var(--border-light);
}

.expand-loading, .expand-empty {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  padding: var(--spacing-md) 0;
}

.expanded-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-md);
}

.expanded-toolbar-label {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.btn--export {
  padding: var(--spacing-xs) var(--spacing-md);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--color-primary);
  background: var(--bg-primary);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background var(--transition-base), color var(--transition-base);
}

.btn--export:hover {
  background: var(--color-primary);
  color: #fff;
}

.inner-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-xs);
}

.inner-table th {
  padding: var(--spacing-xs) var(--spacing-md);
  text-align: left;
  font-weight: var(--font-weight-semibold);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-bottom: 1px solid var(--border-light);
}

.inner-table td {
  padding: var(--spacing-xs) var(--spacing-md);
  color: var(--text-primary);
  border-bottom: 1px solid var(--border-light);
}

.inner-table tr:last-child td { border-bottom: none; }

.page-header {
    margin-bottom: 24px;
}

.header-content {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
}

.page-header h1 {
    font-size: 28px;
    font-weight: 600;
    color: #111827;
    margin-bottom: 4px;
}

.subtitle {
    color: #6b7280;
    font-size: 14px;
}

</style>
