<template>
  <div class="wf-view">

    <!-- ── Top Filter Card ───────────────────────────── -->
    <div class="filter-card">
      <div class="tools-row">
        <div class="filter-group filter-group--group">
          <label class="filter-label">Group</label>
          <select class="filter-input" v-model="chartGroupFilter">
            <option value="all">ALL members</option>
            <option v-for="g in workflowGroups" :key="String(g)" :value="String(g)">
              {{ g }}
            </option>
          </select>
        </div>

        <div class="filter-group">
          <label class="filter-label">View</label>
          <select class="filter-input" v-model="viewType">
            <option value="byDate">By Date</option>
            <option value="byWeek">By Week</option>
            <option value="byMonth">By Month</option>
            <option value="byDateRange">By Date Range</option>
          </select>
        </div>

        <div v-if="viewType === 'byDate'" class="filter-group">
          <label class="filter-label">Date</label>
          <div class="date-inline-controls">
            <button
              class="btn btn--sort btn--icon"
              type="button"
              title="Previous date"
              aria-label="Previous date"
              @click="shiftSelectedDate(-1)"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <TmsNativeCalendarField
              v-model="selectedDate"
              class="filter-calendar"
              type="date"
            />
            <button
              class="btn btn--sort btn--icon"
              type="button"
              title="Next date"
              aria-label="Next date"
              @click="shiftSelectedDate(1)"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>
        </div>

        <div v-else-if="viewType === 'byWeek'" class="filter-group">
          <label class="filter-label">Week</label>
          <TmsNativeCalendarField
            v-model="selectedWeek"
            class="filter-calendar"
            type="week"
          />
        </div>

        <div v-else-if="viewType === 'byMonth'" class="filter-group">
          <label class="filter-label">Month</label>
          <TmsNativeCalendarField
            v-model="selectedMonth"
            class="filter-calendar"
            type="month"
          />
        </div>

        <div v-else class="filter-group">
          <label class="filter-label">From</label>
          <TmsNativeCalendarField
            v-model="rangeFrom"
            class="filter-calendar"
            type="date"
          />
        </div>

        <div v-if="viewType === 'byDateRange'" class="filter-group">
          <label class="filter-label">To</label>
          <TmsNativeCalendarField
            v-model="rangeTo"
            class="filter-calendar"
            type="date"
          />
        </div>

        <div class="toolbar-group">
          <button
            class="btn btn--sort btn--icon"
            :class="{ 'btn--sort-active': sortOrder === 'desc' }"
            @click="setSortOrder('desc')"
            title="Highest values first (members or teams, depending on graph type)"
            aria-label="Sort descending by value"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 4v14m0 0l-4-4m4 4l4-4M14 7h7M14 12h5M14 17h3" />
            </svg>
          </button>
          <button
            class="btn btn--sort btn--icon"
            :class="{ 'btn--sort-active': sortOrder === 'asc' }"
            @click="setSortOrder('asc')"
            title="Lowest values first (members or teams, depending on graph type)"
            aria-label="Sort ascending by value"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 20V6m0 0l-4 4m4-4l4 4M14 7h3M14 12h5M14 17h7" />
            </svg>
          </button>
        </div>

        <div class="toolbar-group">
          <button
            class="btn btn--sort btn--icon"
            :class="{ 'btn--sort-active': chartOrientation === 'vertical' }"
            @click="setChartOrientation('vertical')"
            title="Vertical bars (categories on the X axis)"
            aria-label="Vertical bar chart"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="4" y="13" width="4" height="7" rx="1" />
              <rect x="10" y="9" width="4" height="11" rx="1" />
              <rect x="16" y="5" width="4" height="15" rx="1" />
            </svg>
          </button>
          <button
            class="btn btn--sort btn--icon"
            :class="{ 'btn--sort-active': chartOrientation === 'horizontal' }"
            @click="setChartOrientation('horizontal')"
            title="Horizontal bars (names on the Y axis)"
            aria-label="Horizontal bar chart"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="4" y="4" width="15" height="4" rx="1" />
              <rect x="4" y="10" width="11" height="4" rx="1" />
              <rect x="4" y="16" width="7" height="4" rx="1" />
            </svg>
          </button>
        </div>

        <div class="toolbar-group">
          <button
            class="btn btn--sort"
            :class="{ 'btn--sort-active': graphMetric === 'hours' }"
            @click="setGraphMetric('hours')"
            title="Scale bars by total logged hours (tracked + manual)"
            aria-label="Measure by logged hours"
          >
            Hours
          </button>
          <button
            class="btn btn--sort"
            :class="{ 'btn--sort-active': graphMetric === 'percent' }"
            @click="setGraphMetric('percent')"
            title="Scale bars by actual time vs target for the selected period"
            aria-label="Measure by target achievement percent"
          >
            Target %
          </button>
        </div>

        <div v-if="!isSingleDayView" class="toolbar-group">
          <label
            class="include-holiday-toggle"
            title="Include weekends/holidays: count their hours and treat each holiday as 100% of the daily-averaged target"
          >
            <input type="checkbox" v-model="includeHoliday" />
            <span>Include Holiday</span>
          </label>
        </div>

        <div class="toolbar-group toolbar-group--right">
          <div v-if="showFinalSyncControls" class="final-sync-tools">
            <span v-if="finalSyncConfirmed" class="confirmed-badge">Confirmed</span>
            <!-- Stays available after confirmation so the day can be re-synced. -->
            <button
              class="btn btn--primary"
              :disabled="finalSyncLoading"
              :title="finalSyncConfirmed ? 'Run the final update again for this day' : 'Run the final update for this day'"
              @click="runFinalSync"
            >
              {{ finalSyncLoading ? 'Final Updating...' : 'Final Update' }}
            </button>
          </div>
          <button v-if="canAddTime" class="btn btn--add" @click="openModal">＋ Add Time</button>
        </div>
      </div>
    </div>

    <div class="summary-card">
      <div class="summary-grid">
        <div class="summary-item">
          <p class="summary-label">My Current Worktime</p>
          <strong class="summary-value">{{ formatMinutes(mySummary.currentMinutes) }}</strong>
        </div>
        <div class="summary-item">
          <p class="summary-label">Remaining Target</p>
          <strong class="summary-value">{{ formatSignedMinutes(mySummary.remainingMinutes) }}</strong>
        </div>
        <div class="summary-item">
          <p class="summary-label">Today's Target</p>
          <strong class="summary-value">{{ formatMinutes(mySummary.dailyTargetMinutes) }}</strong>
        </div>
        <div class="summary-item">
          <p class="summary-label">Achievement</p>
          <strong class="summary-value">{{ mySummary.percentText }}</strong>
        </div>
      </div>
    </div>

    <!-- ── Filter banner (when arriving with ?userId=) ── -->
    <div v-if="focusUserName" class="focus-banner">
      <span class="focus-banner__label">Filtered to</span>
      <strong class="focus-banner__name">{{ focusUserName }}</strong>
      <button class="focus-banner__clear" @click="clearFocus" type="button">Show all</button>
    </div>

    <!-- ── Chart Card ────────────────────────────────── -->
    <div class="wf-card chart-card">
      <div v-if="finalSyncLoading" class="sync-overlay">
        <div class="sync-spinner"></div>
        <p>Syncing selected date from Hubstaff and updating database...</p>
      </div>
      <div v-if="loading" class="chart-loading">
        <div class="skeleton skeleton--chart"></div>
      </div>
      <div v-else-if="error" class="error-banner">⚠️ {{ error }}</div>
      <div v-else-if="displayData.length === 0" class="empty-state">
        <span>📊</span>
        <p>No users found. Make sure there are active users in the system.</p>
      </div>
      <div v-else class="chart-wrap">
        <div class="chart-viewport" :class="{ 'chart-viewport--scroll': chartOrientation === 'horizontal' }">
          <canvas
            ref="chartCanvas"
            :class="['chart-canvas', { 'chart-canvas--clickable': chartMemberDetailInteractive }]"
            :style="chartCanvasStyle"
          ></canvas>
        </div>

        <div class="graph-breakdown" role="group" aria-label="How to group chart bars">
          <span class="graph-breakdown__label">Graph type</span>
          <div class="segmented" role="tablist">
            <button
              type="button"
              role="tab"
              class="segmented__btn"
              :class="{ 'segmented__btn--active': chartBreakdownMode === 'byUser' }"
              :aria-selected="chartBreakdownMode === 'byUser'"
              title="One bar per person — same as before"
              @click="setChartBreakdownMode('byUser')"
            >
              By users
            </button>
            <button
              type="button"
              role="tab"
              class="segmented__btn"
              :class="{ 'segmented__btn--active': chartBreakdownMode === 'byGroup' }"
              :aria-selected="chartBreakdownMode === 'byGroup'"
              title="One bar per team: average logged hours per member vs average member target"
              @click="setChartBreakdownMode('byGroup')"
            >
              By group
            </button>
          </div>
        </div>

        <div class="score-list-wrap">
          <div class="score-list-title">{{ scoreListTitle }}</div>
          <div class="score-list">
            <div
              v-for="row in chartRows"
              :key="row.isGroupAggregate ? `score-g-${row.name}` : `score-u-${row.userId}`"
              class="score-chip"
              :class="{ 'score-chip--achieved': row.achieved, 'score-chip--group': row.isGroupAggregate }"
              :title="scoreChipTitle(row)"
            >
              <UserAvatar
                v-if="!row.isGroupAggregate"
                class="score-chip__avatar"
                :name="row.name"
                :profile-image="row.avatarUrl || ''"
                :size="26"
                :tooltip="false"
              />
              <div v-else class="score-chip__group-avatar" aria-hidden="true">
                {{ groupInitial(row.name) }}
              </div>
              <span class="score-chip__name">{{ row.name }}</span>
              <span v-if="row.isGroupAggregate" class="score-chip__meta">{{ row.memberCount }} members</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── ADD TIME Modal ─────────────────────────────── -->
    <teleport to="body">
      <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div class="modal-header">
            <h3 id="modal-title" class="modal-title">Add Time</h3>
            <button class="modal-close" @click="closeModal" aria-label="Close">✕</button>
          </div>

          <div class="modal-body">
            <!-- Member select -->
            <div class="form-group">
              <label class="form-label">Members</label>
              <div class="member-picker">
                <label class="member-picker__all">
                  <input
                    type="checkbox"
                    :checked="modalForm.applyToAll"
                    :disabled="usersLoading"
                    @change="toggleApplyToAll(($event.target).checked)"
                  />
                  <span>Select All Users</span>
                </label>
                <div v-if="!modalForm.applyToAll" class="member-picker__list">
                  <label v-for="u in users" :key="u._id" class="member-picker__item">
                    <input
                      type="checkbox"
                      class="member-picker__checkbox"
                      :value="u._id"
                      :checked="modalForm.userIds.includes(u._id)"
                      :disabled="usersLoading"
                      @change="toggleUserSelection(u._id, ($event.target).checked)"
                    />
                    <UserAvatar
                      class="member-picker__avatar"
                      :name="u.name"
                      :profile-image="u.avatarUrl || ''"
                      :size="28"
                      :tooltip="false"
                    />
                    <span class="member-picker__text">
                      <span class="member-picker__name">{{ u.name }}</span>
                      <span v-if="u.email" class="member-picker__email">{{ u.email }}</span>
                    </span>
                  </label>
                </div>
                <div v-if="!usersLoading" class="member-picker__hint">
                  {{ selectedUsersCountText }}
                </div>
              </div>
            </div>

            <!-- Date -->
            <div class="form-group">
              <label class="form-label">Date</label>
              <TmsNativeCalendarField v-model="modalForm.date" type="date" class="form-input" />
            </div>

            <!-- Hours / Minutes -->
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Hours</label>
                <input
                  type="number"
                  v-model.number="modalForm.hours"
                  min="0"
                  step="1"
                  class="form-input"
                  placeholder="0"
                />
              </div>
              <div class="form-group">
                <label class="form-label">Minutes</label>
                <input
                  type="number"
                  v-model.number="modalForm.minutes"
                  min="0"
                  step="1"
                  class="form-input"
                  placeholder="0"
                  title="May exceed 59 (e.g. 250 minutes is added correctly)"
                />
              </div>
            </div>
            <p class="field-hint field-hint--modal">
              Enter time as hours plus minutes (e.g. 4 hours and 10 minutes), or put the full amount in minutes only (e.g. 250 minutes). Total is summed as hours × 60 + minutes.
            </p>

            <!-- Total preview -->
            <div class="time-preview" v-if="modalTotalDurationMinutes > 0">
              Total added:
              <strong>{{ modalNormalizedHours }}h {{ modalNormalizedMinutes }}m</strong>
              <template v-if="modalDurationNeedsNormalize">
                <span class="time-preview__raw">
                  (from {{ modalRawHoursLabel }}h {{ modalRawMinutesLabel }}m input)
                </span>
              </template>
            </div>

            <!-- Short reason -->
            <div class="form-group">
              <label class="form-label">Short reason <span class="optional">(shown on graph tooltip)</span></label>
              <input
                v-model="modalForm.shortReason"
                type="text"
                maxlength="120"
                class="form-input"
                placeholder="e.g. Meeting, Onboarding"
              />
            </div>

            <!-- Description -->
            <div class="form-group">
              <label class="form-label">Description <span class="optional">(optional)</span></label>
              <textarea
                v-model="modalForm.description"
                class="form-input form-textarea"
                rows="3"
                placeholder="What was worked on?"
              ></textarea>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn btn--cancel" @click="closeModal">Cancel</button>
            <button class="btn btn--primary" @click="handleAddTime" :disabled="modalLoading">
              {{ modalLoading ? 'Saving…' : 'Submit' }}
            </button>
          </div>
        </div>
      </div>
    </teleport>

    <WorktimeMemberDetailModal
      v-model="memberDetailOpen"
      :chart-user="memberDetailUser"
      :date-from="dateFrom"
      :date-to="dateTo"
      :allow-manage="canManageMemberManualDetail"
      @saved="fetchChart({ silent: true })"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { monthKeyOfDateKey, monthRangeKeys } from '../utils/businessMonth';
import { weekStartDateKey, weekRangeKeys } from '../utils/weekRule';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'vue-toastification';
import Chart from 'chart.js/auto';
import {
  getWorkflowChartData,
  getWorkflowUsers,
  addWorkflowTime,
  getWorktimeTargets,
  getWorkflowFinalSyncStatus,
  triggerWorkflowFinalSync,
} from '../services/workflow';
import TmsNativeCalendarField from '../components/ui/TmsNativeCalendarField.vue';
import UserAvatar from '../components/UserAvatar.vue';
import WorktimeMemberDetailModal from '../components/workflow/WorktimeMemberDetailModal.vue';
import { getESTDateKey } from '../utils/timezoneHelpers';
import { computeWorktimeMetrics } from '../utils/worktimeMetrics';
import { useThemeAppearance } from '../composables/useThemeAppearance';
import { useAuthStore } from '../composables/useAuth';
import { hasAnyRole } from '../utils/permissions';
import { ROLES } from '../constants/roles';

const toast = useToast();
const { effectiveTheme } = useThemeAppearance();
const authStore = useAuthStore();

/** Stacked bar colors: soft success (met target) vs soft warning (below target). */
function worktimeStackColors(achieved, dark) {
  if (achieved) {
    return dark
      ? {
          tracked: 'rgba(52, 211, 153, 0.82)',
          trackedHover: 'rgba(16, 185, 129, 0.93)',
          added: 'rgba(167, 243, 208, 0.76)',
          addedHover: 'rgba(110, 231, 183, 0.88)',
        }
      : {
          tracked: 'rgba(45, 166, 134, 0.86)',
          trackedHover: 'rgba(32, 139, 112, 0.94)',
          added: 'rgba(132, 217, 184, 0.9)',
          addedHover: 'rgba(98, 196, 159, 0.95)',
        };
  }
  return dark
    ? {
        tracked: 'rgba(251, 191, 36, 0.76)',
        trackedHover: 'rgba(245, 158, 11, 0.9)',
        added: 'rgba(253, 224, 154, 0.7)',
        addedHover: 'rgba(252, 211, 77, 0.85)',
      }
    : {
        tracked: 'rgba(234, 162, 94, 0.88)',
        trackedHover: 'rgba(214, 134, 62, 0.94)',
        added: 'rgba(244, 208, 164, 0.9)',
        addedHover: 'rgba(235, 182, 126, 0.95)',
      };
}

function workflowChartChrome() {
  const dark = effectiveTheme.value === 'dark';
  return {
    axisTitle: dark ? '#cbd5e1' : '#334155',
    ticks: dark ? '#94a3b8' : '#475569',
    /** High-contrast labels drawn above each bar (canvas text). */
    barValueLabel: dark ? '#f8fafc' : '#0f172a',
    barValueLabelOutline: dark ? 'rgba(15, 23, 42, 0.55)' : 'rgba(255, 255, 255, 0.85)',
    grid: dark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.22)',
    bar: dark ? '#6366f1' : '#4f46e5',
    barHover: dark ? '#7c83ff' : '#4338ca'
  };
}
const route = useRoute();
const router = useRouter();
const MAX_PERCENT_CHART_VALUE = 300;

// ── Helpers ────────────────────────────────────────────────────────
// EST is the system-wide timezone; "today" must be the EST calendar day, not
// the browser's local/UTC day (which made the default range timezone-dependent).
const todayStr = () => getESTDateKey();

// Pure UTC calendar-day math so adding days never shifts across a timezone
// boundary (parsing/formatting both in UTC). Mixing local parse + UTC format
// previously collapsed the single-day range to empty for users ahead of UTC.
const addDays = (dateStr, n) => {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const startOfWeek = () => {
  const d = new Date();
  const day = d.getDay(); // 0 = Sunday
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
};

const startOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};

// ── State ───────────────────────────────────────────────────────────
const viewType = ref('byDate');
const selectedDate = ref(todayStr());
const selectedWeek = ref('');
const selectedMonth = ref(todayStr().slice(0, 7));
const rangeFrom = ref(todayStr());
const rangeTo = ref(todayStr());
const dateFrom = ref(todayStr());
const dateTo = ref(addDays(todayStr(), 1));

const loading = ref(false);
const error = ref(null);
const rawData = ref([]); // original order from API
/** Distinct non-empty group codes (from chart API); used by the toolbar filter. */
const workflowGroups = ref([]);
/** `'all'` = every member; otherwise matches `User.group` */
const chartGroupFilter = ref('all');

const sortOrder = ref('desc'); // 'asc' | 'desc'
const chartOrientation = ref('vertical'); // 'vertical' | 'horizontal'
const graphMetric = ref('hours'); // 'hours' | 'percent'
/**
 * When ON, weekends/holidays are counted: their hours are summed and each
 * holiday contributes 100% to the per-day-averaged achievement.
 * When OFF, holidays are excluded from both hours and the percent average.
 */
const includeHoliday = ref(true);
/** Single-day ("By Date") view: no holiday toggle — always show that one day. */
const isSingleDayView = computed(() => viewType.value === 'byDate');
/**
 * In single-day view the day is always counted (a holiday just reads 100%); for
 * week/month/range it follows the checkbox.
 */
const effectiveIncludeHoliday = computed(() =>
  isSingleDayView.value ? true : includeHoliday.value
);
/** Chart bars: one per user (default) or one per team (per-member averages for time/target). */
const chartBreakdownMode = ref('byUser'); // 'byUser' | 'byGroup'

// Chart
const chartCanvas = ref(null);
let chartInstance = null;

// Modal
const showModal = ref(false);
const modalLoading = ref(false);
const users = ref([]);
const usersLoading = ref(false);
const modalForm = ref({
  userIds: [],
  applyToAll: false,
  date: todayStr(),
  hours: null,
  minutes: null,
  shortReason: '',
  description: '',
});
const monthTargetsByUser = ref(new Map());
const periodTargetsByUser = ref(new Map());
const finalSyncLoading = ref(false);
const finalSyncConfirmed = ref(false);
const memberDetailOpen = ref(false);
const memberDetailUser = ref(null);

// ── Computed ────────────────────────────────────────────────────────

// Number of days in the selected range: max(1, dateTo - dateFrom in days)
const numDays = computed(() => {
  if (!dateFrom.value || !dateTo.value) return 1;
  const from = new Date(dateFrom.value + 'T00:00:00');
  const to = new Date(dateTo.value + 'T00:00:00');
  const diff = Math.round((to - from) / 86400000);
  return Math.max(1, diff);
});

// Y-axis ceiling in hours (per calendar day × range length)
const yAxisMax = computed(() => 20 * numDays.value);
const getDailyTargetMinutesByUser = (userId) => {
  const defaultTargetMinutes = 13 * 60 + 30;
  return monthTargetsByUser.value.get(String(userId)) ?? defaultTargetMinutes;
};
const getPeriodTargetMinutesByUser = (userId) => getDailyTargetMinutesByUser(userId) * numDays.value;

/**
 * Holiday-aware per-member metrics computed from the API's per-day breakdown
 * (shared with Summarize — see utils/worktimeMetrics.js for the rules).
 */
const computeMemberMetrics = (row) =>
  computeWorktimeMetrics(row, {
    includeHoliday: effectiveIncludeHoliday.value,
    fallbackPeriodTargetMinutes:
      periodTargetsByUser.value.get(String(row?.userId)) ?? getPeriodTargetMinutesByUser(row?.userId),
  });

/**
 * Roll up member rows (already carrying holiday-aware metrics) into one row per
 * `group`, averaging each metric across the group's members.
 */
const buildGroupAggregateRows = (userRows) => {
  const map = new Map();
  for (const row of userRows) {
    const g = row.group != null && String(row.group).trim() !== '' ? String(row.group) : '';
    const key = g || '__ungrouped__';
    if (!map.has(key)) {
      map.set(key, {
        userId: `group:${key}`,
        name: g || 'Unassigned',
        group: g,
        avatarUrl: '',
        trackedHours: 0,
        addedHours: 0,
        trackedPercent: 0,
        addedPercent: 0,
        periodTargetMinutes: 0,
        memberIds: new Set(),
        isGroupAggregate: true,
      });
    }
    const acc = map.get(key);
    acc.trackedHours += Number(row.trackedHours) || 0;
    acc.addedHours += Number(row.addedHours) || 0;
    acc.trackedPercent += Number(row.trackedPercent) || 0;
    acc.addedPercent += Number(row.addedPercent) || 0;
    acc.periodTargetMinutes += Number(row.periodTargetMinutes) || 0;
    acc.memberIds.add(String(row.userId));
  }

  const list = [];
  for (const acc of map.values()) {
    const n = acc.memberIds.size || 1;
    const trackedHours = acc.trackedHours / n;
    const addedHours = acc.addedHours / n;
    const trackedPercent = acc.trackedPercent / n;
    const addedPercent = acc.addedPercent / n;
    list.push({
      userId: acc.userId,
      name: acc.name,
      group: acc.group,
      avatarUrl: '',
      trackedHours,
      addedHours,
      trackedPercent,
      addedPercent,
      achievementPercent: trackedPercent + addedPercent,
      totalHours: trackedHours + addedHours,
      periodTargetMinutes: acc.periodTargetMinutes / n,
      hubstaff_id: null,
      memberCount: acc.memberIds.size,
      isGroupAggregate: true,
    });
  }

  const valueForSort = (r) =>
    graphMetric.value === 'percent'
      ? Number(r.achievementPercent) || 0
      : Number(r.totalHours) || 0;
  list.sort((a, b) =>
    sortOrder.value === 'desc'
      ? valueForSort(b) - valueForSort(a)
      : valueForSort(a) - valueForSort(b));

  return list;
};

const dataMax = computed(() => {
  if (!chartRows.value.length) return 0;
  return Math.max(...chartRows.value.map((r) => Number(r.chartValue) || 0));
});
const chartMax = computed(() => {
  if (graphMetric.value === 'percent') {
    return Math.min(MAX_PERCENT_CHART_VALUE, Math.max(100, Math.ceil(dataMax.value)));
  }
  return Math.max(yAxisMax.value, Math.ceil(dataMax.value));
});

// Optional single-user focus, driven by ?userId= in the URL (e.g. when
// arriving from the dashboard card). Cleared via the banner's "Show all".
const focusUserId = computed(() => route.query.userId || '');
const focusUserName = computed(() => {
  if (!focusUserId.value) return '';
  const row = rawData.value.find(r => String(r.userId) === String(focusUserId.value));
  return row?.name || '';
});
const clearFocus = () => {
  router.replace({ query: { ...route.query, userId: undefined } });
};

// Sorted (and optionally focused) display data
const displayData = computed(() => {
  let copy = [...rawData.value];
  if (focusUserId.value) {
    copy = copy.filter(r => String(r.userId) === String(focusUserId.value));
  }
  const valueForSort = (row) =>
    graphMetric.value === 'percent'
      ? computeMemberMetrics(row).achievementPercent
      : computeMemberMetrics(row).totalHours;
  copy.sort((a, b) =>
    sortOrder.value === 'desc'
      ? valueForSort(b) - valueForSort(a)
      : valueForSort(a) - valueForSort(b)
  );
  return copy;
});

// Member rows enriched with holiday-aware metrics (respecting includeHoliday).
const memberRowsWithMetrics = computed(() =>
  displayData.value.map((row) => ({ ...row, ...computeMemberMetrics(row) }))
);

const breakdownSourceRows = computed(() => {
  if (chartBreakdownMode.value !== 'byGroup') return memberRowsWithMetrics.value;
  return buildGroupAggregateRows(memberRowsWithMetrics.value);
});

const chartRows = computed(() =>
  breakdownSourceRows.value.map((row) => {
    const trackedHours = Math.max(0, Number(row.trackedHours) || 0);
    const addedHours = Math.max(0, Number(row.addedHours) || 0);
    const trackedPercent = Math.max(0, Number(row.trackedPercent) || 0);
    const addedPercent = Math.max(0, Number(row.addedPercent) || 0);
    const achievementPercent = Math.max(0, Number(row.achievementPercent) || 0);
    const totalHours = trackedHours + addedHours;
    const isPercent = graphMetric.value === 'percent';
    const chartTrackedValue = isPercent
      ? Math.min(MAX_PERCENT_CHART_VALUE, trackedPercent)
      : trackedHours;
    const chartAddedValue = isPercent
      ? Math.min(MAX_PERCENT_CHART_VALUE, addedPercent)
      : addedHours;
    return {
      ...row,
      // Holiday-aware totals so the score list / tooltips stay consistent.
      total_hours: totalHours,
      periodTargetMinutes: Number(row.periodTargetMinutes) || 0,
      achievementPercent,
      achieved: achievementPercent >= 100,
      chartTrackedValue,
      chartAddedValue,
      chartTotalValue: isPercent
        ? Math.min(MAX_PERCENT_CHART_VALUE, chartTrackedValue + chartAddedValue)
        : totalHours,
      chartValue: isPercent
        ? Math.min(MAX_PERCENT_CHART_VALUE, achievementPercent)
        : totalHours,
      memberCount: row.memberCount,
      isGroupAggregate: !!row.isGroupAggregate,
    };
  })
);

const chartHeight = computed(() =>
  chartOrientation.value === 'horizontal'
    ? Math.min(900, Math.max(440, chartRows.value.length * 30 + 80))
    : 460
);
const chartCanvasStyle = computed(() => ({ height: `${chartHeight.value}px` }));

const scoreListTitle = computed(() =>
  chartBreakdownMode.value === 'byGroup'
    ? 'Group averages (per member)'
    : 'Member target summary'
);

const canAddTime = computed(() =>
  hasAnyRole(authStore.user, [ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMIN])
);

/** Super Admin / Admin: add/edit/remove manual entries inside the breakdown modal */
const canManageMemberManualDetail = computed(() =>
  hasAnyRole(authStore.user, [ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMIN])
);

/** “By users” chart: tap a member bar for manual breakdown (scoped by role on the API). */
const chartMemberDetailInteractive = computed(() => chartBreakdownMode.value === 'byUser');

/** Open for any member bar; READ access is enforced by GET /manual-time-detail. Super Admin-only UI via allowManage. */
const openMemberDetailFromChart = (row) => {
  if (!chartMemberDetailInteractive.value || !row || row.isGroupAggregate) return;
  memberDetailUser.value = {
    userId: row.userId,
    name: row.name,
    avatarUrl: row.avatarUrl || '',
    group: row.group || '',
  };
  memberDetailOpen.value = true;
};
const currentUserId = computed(() => String(authStore.user?._id || authStore.user?.id || ''));
// A month runs from the 6th to the 5th of the next month.
const targetMonthKey = computed(() => monthKeyOfDateKey(dateFrom.value || todayStr()));
const isTodaySelected = computed(() => selectedDate.value === todayStr());
const showFinalSyncControls = computed(() =>
  canAddTime.value && viewType.value === 'byDate' && !!selectedDate.value && !isTodaySelected.value
);

const mySummary = computed(() => {
  const me = rawData.value.find((r) => String(r.userId) === currentUserId.value);
  // Holiday-aware metrics so the summary card matches this member's chart bar.
  const metrics = me ? computeMemberMetrics(me) : null;
  const currentMinutes = Math.round((Number(metrics?.totalHours) || 0) * 60);

  if (canAddTime.value) {
    return {
      currentMinutes,
      remainingMinutes: 0,
      dailyTargetMinutes: 0,
      percentText: '0.0%',
    };
  }

  const defaultTargetMinutes = 13 * 60 + 30;
  // Worktime target value is configured by month, but represents the per-day target.
  const dailyTargetMinutes = monthTargetsByUser.value.get(currentUserId.value) ?? defaultTargetMinutes;
  const periodTargetMinutes = Number(metrics?.periodTargetMinutes) || 0;
  const remainingMinutes = periodTargetMinutes > 0 ? (periodTargetMinutes - currentMinutes) : 0;
  const percent = Number(metrics?.achievementPercent) || 0;

  return {
    currentMinutes,
    remainingMinutes,
    dailyTargetMinutes,
    percentText: `${Math.max(0, Math.min(999, percent)).toFixed(1)}%`,
  };
});

const toISODate = (d) => d.toISOString().slice(0, 10);

const getWeekDateRange = (weekValue) => {
  const m = /^(\d{4})-W(\d{2})$/.exec(weekValue || '');
  if (!m) return null;
  const year = Number(m[1]);
  const week = Number(m[2]);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const mondayWeek1 = new Date(jan4);
  mondayWeek1.setUTCDate(jan4.getUTCDate() - jan4Day + 1);
  const start = new Date(mondayWeek1);
  start.setUTCDate(mondayWeek1.getUTCDate() + (week - 1) * 7);
  const endExclusive = new Date(start);
  endExclusive.setUTCDate(start.getUTCDate() + 7);
  return { from: toISODate(start), to: toISODate(endExclusive) };
};

const toWeekInput = (dateValue) => {
  const d = new Date(`${dateValue}T00:00:00Z`);
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
};

const shiftSelectedDate = (direction) => {
  const base = selectedDate.value || todayStr();
  selectedDate.value = addDays(base, direction);
};

const syncQueryRangeFromView = () => {
  if (viewType.value === 'byDate') {
    dateFrom.value = selectedDate.value || todayStr();
    dateTo.value = addDays(dateFrom.value, 1);
    return;
  }

  if (viewType.value === 'byWeek') {
    // Weeks run Saturday → Friday, the same unit the finance weeks use.
    const start = weekStartDateKey(selectedWeek.value) || weekStartDateKey(todayStr());
    selectedWeek.value = start;
    const { endExclusive } = weekRangeKeys(start);
    dateFrom.value = start;
    dateTo.value = endExclusive;
    return;
  }

  if (viewType.value === 'byMonth') {
    const m = /^(\d{4})-(\d{2})$/.exec(selectedMonth.value || '');
    if (!m) {
      selectedMonth.value = monthKeyOfDateKey(todayStr());
    }
    // A month runs from the 6th to the 5th of the next month.
    const { start, endExclusive } = monthRangeKeys(selectedMonth.value);
    dateFrom.value = start;
    dateTo.value = endExclusive;
    return;
  }

  // byDateRange (inclusive end date in UI)
  dateFrom.value = rangeFrom.value || todayStr();
  const end = rangeTo.value || dateFrom.value;
  dateTo.value = addDays(end, 1);
};

// ── Data fetch ──────────────────────────────────────────────────────
// `silent: true` skips the loading skeleton so background refreshes
// don't make the chart disappear and re-animate from scratch.
const fetchChart = async ({ silent = false } = {}) => {
  if (!silent) loading.value = true;
  error.value = null;
  try {
    syncQueryRangeFromView();
    const chartParams = { date_from: dateFrom.value, date_to: dateTo.value };
    if (chartGroupFilter.value && chartGroupFilter.value !== 'all') {
      chartParams.group = chartGroupFilter.value;
    }
    const res = await getWorkflowChartData(chartParams);
    rawData.value = res.data?.data?.chartData || [];
    const pMap = new Map();
    rawData.value.forEach((r) => {
      pMap.set(String(r.userId), Number(r.periodTargetMinutes) || 0);
    });
    periodTargetsByUser.value = pMap;
    workflowGroups.value = res.data?.data?.groups ?? [];
  } catch (err) {
    if (!silent) {
      error.value = err.response?.data?.message || err.message;
      rawData.value = [];
      periodTargetsByUser.value = new Map();
    }
  } finally {
    if (!silent) loading.value = false;
  }
};

const fetchMonthTarget = async () => {
  if (!targetMonthKey.value) return;
  try {
    const res = await getWorktimeTargets(targetMonthKey.value);
    const users = res.data?.data?.users || [];
    const nextMap = new Map();
    users.forEach((u) => {
      nextMap.set(String(u.userId), Number(u.targetMinutes) || 0);
    });
    monthTargetsByUser.value = nextMap;
  } catch {
    monthTargetsByUser.value = new Map();
  }
};

const fetchFinalSyncStatus = async () => {
  if (!showFinalSyncControls.value) {
    finalSyncConfirmed.value = false;
    return;
  }
  try {
    const res = await getWorkflowFinalSyncStatus(selectedDate.value);
    finalSyncConfirmed.value = !!res.data?.data?.confirmed;
  } catch {
    finalSyncConfirmed.value = false;
  }
};

const runFinalSync = async () => {
  if (!showFinalSyncControls.value || finalSyncLoading.value) return;
  finalSyncLoading.value = true;
  try {
    await triggerWorkflowFinalSync(selectedDate.value);
    finalSyncConfirmed.value = true;
    await fetchChart();
    toast.success('Final update completed and graph refreshed.');
  } catch (err) {
    toast.error(err.response?.data?.message || err.message || 'Final update failed');
  } finally {
    finalSyncLoading.value = false;
  }
};

// Auto-refresh: pull fresh worked-hours from the workflow collection every 10 minutes.
const REFRESH_INTERVAL_MS = 10 * 60 * 1000;
let refreshTimerId = null;
const startAutoRefresh = () => {
  stopAutoRefresh();
  refreshTimerId = setInterval(() => {
    fetchChart({ silent: true });
  }, REFRESH_INTERVAL_MS);
};
const stopAutoRefresh = () => {
  if (refreshTimerId) {
    clearInterval(refreshTimerId);
    refreshTimerId = null;
  }
};

// ── Chart management ────────────────────────────────────────────────

// Decimal hours → "Xh Ym"
const formatHm = (hoursDecimal) => {
  const totalMinutes = Math.round(hoursDecimal * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0 && m === 0) return '';
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

const formatMinutes = (totalMinutes) => {
  const mins = Math.max(0, Number(totalMinutes) || 0);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

const formatSignedMinutes = (totalMinutes) => {
  const n = Number(totalMinutes) || 0;
  const absText = formatMinutes(Math.abs(n));
  return n < 0 ? `+${absText}` : absText;
};

const formatMetricValue = (value, metric) => {
  if (metric === 'percent') {
    const v = Number(value) || 0;
    return v >= MAX_PERCENT_CHART_VALUE ? `${MAX_PERCENT_CHART_VALUE}%+` : `${v.toFixed(1)}%`;
  }
  return formatHm(value) || '0m';
};

const userScoreDetailText = (row) => {
  const workedMinutes = Math.round((Number(row?.total_hours) || 0) * 60);
  const workedText = formatMinutes(workedMinutes);
  const targetText = formatMinutes(row?.periodTargetMinutes || 0);
  const rawPct = Number(row?.achievementPercent) || 0;
  const pctText = rawPct >= MAX_PERCENT_CHART_VALUE ? `${MAX_PERCENT_CHART_VALUE}%+` : `${rawPct.toFixed(1)}%`;
  return `${row?.name || ''}: ${workedText} / ${targetText} (${pctText})`;
};

const groupInitial = (name) => {
  const s = (name || '').trim();
  if (!s) return '?';
  return s.charAt(0).toUpperCase();
};

const scoreChipTitle = (row) => {
  let text = userScoreDetailText(row);
  if (row?.isGroupAggregate && row.memberCount != null) {
    text += ` · ${row.memberCount} members (avg. per member)`;
  }
  return text;
};

// Linear gradient brush for the bars — higher luminance on dark backgrounds
const makeBarGradient = (ctx, chartArea) => {
  return workflowChartChrome().bar;
};

const barValueLabelsPlugin = {
  id: 'barValueLabels',
  afterDatasetsDraw(chart) {
    const trackedMeta = chart.getDatasetMeta(0);
    const addedMeta = chart.getDatasetMeta(1);
    if (!trackedMeta?.data?.length) return;
    const { ctx } = chart;
    const chrome = workflowChartChrome();
    ctx.save();
    ctx.font =
      '800 13px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = chrome.barValueLabel;
    ctx.strokeStyle = chrome.barValueLabelOutline;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    const isHorizontal = chart.options.indexAxis === 'y';
    ctx.textBaseline = 'middle';

    trackedMeta.data.forEach((bar, index) => {
      const tracked = Number(chart.data.datasets[0].data[index]) || 0;
      const added = Number(chart.data.datasets[1]?.data?.[index]) || 0;
      const value = tracked + added;
      const label = formatMetricValue(value, graphMetric.value);
      const topBar = added > 0 && addedMeta?.data?.[index] ? addedMeta.data[index] : bar;
      if (isHorizontal) {
        ctx.textAlign = 'left';
        ctx.strokeText(label, topBar.x + 10, topBar.y);
        ctx.fillText(label, topBar.x + 10, topBar.y);
      } else {
        ctx.textAlign = 'center';
        const ly = topBar.y - 12;
        ctx.strokeText(label, topBar.x, ly);
        ctx.fillText(label, topBar.x, ly);
      }
    });

    ctx.restore();
  },
};

const buildChart = () => {
  if (!chartCanvas.value) return;
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
  if (chartRows.value.length === 0) return;

  const labels = chartRows.value.map(u => u.name);
  const trackedValues = chartRows.value.map(u => +((u.chartTrackedValue || 0)).toFixed(2));
  const addedValues = chartRows.value.map(u => +((u.chartAddedValue || 0)).toFixed(2));
  const darkTheme = effectiveTheme.value === 'dark';
  const barPalettes = chartRows.value.map((u) => worktimeStackColors(u.achieved, darkTheme));
  const trackedBg = barPalettes.map((p) => p.tracked);
  const trackedHoverBg = barPalettes.map((p) => p.trackedHover);
  const addedBg = barPalettes.map((p) => p.added);
  const addedHoverBg = barPalettes.map((p) => p.addedHover);
  const maxY = chartMax.value;
  const chrome = workflowChartChrome();
  const isHorizontal = chartOrientation.value === 'horizontal';
  const teamBars = chartBreakdownMode.value === 'byGroup';
  const axisTitle = graphMetric.value === 'percent'
    ? teamBars
      ? 'Group vs avg. member target (%)'
      : 'Achievement (%)'
    : teamBars
      ? 'Avg. hours per member'
      : 'Working Hours';

  const trackedLabel = teamBars
    ? graphMetric.value === 'percent'
      ? 'Tracked (% of avg. target)'
      : 'Tracked time (per-member avg.)'
    : graphMetric.value === 'percent'
      ? 'Tracked (%)'
      : 'Tracked time';
  const addedLabel = teamBars
    ? graphMetric.value === 'percent'
      ? 'Manual (% of avg. target)'
      : 'Manual time (per-member avg.)'
    : graphMetric.value === 'percent'
      ? 'Manual added (%)'
      : 'Manual added time';

  chartInstance = new Chart(chartCanvas.value, {
    type: 'bar',
    plugins: [barValueLabelsPlugin],
    data: {
      labels,
      datasets: [
        {
          label: trackedLabel,
          data: trackedValues,
          backgroundColor: trackedBg,
          hoverBackgroundColor: trackedHoverBg,
          stack: 'worktime',
          borderSkipped: false,
          borderRadius: 0,
          borderWidth: 0,
          barThickness: 'flex',
          maxBarThickness: 40,
          categoryPercentage: 0.93,
          barPercentage: 0.82,
        },
        {
          label: addedLabel,
          data: addedValues,
          backgroundColor: addedBg,
          hoverBackgroundColor: addedHoverBg,
          stack: 'worktime',
          borderSkipped: false,
          borderRadius: 0,
          borderWidth: 0,
          barThickness: 'flex',
          maxBarThickness: 40,
          categoryPercentage: 0.93,
          barPercentage: 0.82,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: isHorizontal ? 'y' : 'x',
      layout: {
        padding: isHorizontal
          ? { top: 14, right: 18, bottom: 10, left: 4 }
          : { top: 24, right: 12, bottom: 12, left: 8 }
      },
      animation: {
        duration: chartRows.value.length > 80 ? 0 : 420,
        easing: 'easeOutCubic',
        delay: (ctx) => (ctx.type === 'data' ? Math.min(ctx.dataIndex, 40) * 8 : 0),
      },
      interaction: { mode: 'nearest', intersect: true, axis: 'x' },
      onClick: (_evt, elements) => {
        if (!chartMemberDetailInteractive.value) return;
        if (!elements?.length) return;
        const idx = elements[0].index;
        const row = chartRows.value[idx];
        if (!row) return;
        if (row.isGroupAggregate) {
          toast.info('Switch to “By users” to open one member’s manual time detail.');
          return;
        }
        openMemberDetailFromChart(row);
      },
      scales: {
        x: {
          beginAtZero: true,
          max: isHorizontal ? maxY : undefined,
          stacked: true,
          border: { display: false },
          title: {
            display: isHorizontal,
            text: axisTitle,
            font: { size: 15, weight: '800', family: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' },
            color: chrome.axisTitle,
            padding: { bottom: 8 },
          },
          ticks: {
            callback(value) {
              if (isHorizontal) {
                return graphMetric.value === 'percent' ? `${value}%` : `${value}h`;
              }
              const label = this.getLabelForValue(value) || '';
              return label.length > 14 ? `${label.slice(0, 14)}...` : label;
            },
            color: chrome.ticks,
            font: { size: 12, weight: '700', family: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' },
            padding: 6,
            maxRotation: isHorizontal ? 0 : 30,
            minRotation: isHorizontal ? 0 : 0,
          },
          grid: {
            color: chrome.grid,
            drawTicks: false,
            lineWidth: 1,
            display: isHorizontal ? true : false,
          },
        },
        y: {
          beginAtZero: true,
          max: isHorizontal ? undefined : maxY,
          stacked: true,
          border: { display: false },
          title: {
            display: !isHorizontal,
            text: axisTitle,
            font: { size: 15, weight: '800', family: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' },
            color: chrome.axisTitle,
            padding: { bottom: 8 },
          },
          ticks: {
            color: chrome.ticks,
            autoSkip: false,
            font: { size: 12, weight: '600', family: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' },
            callback(value) {
              if (isHorizontal) {
                const label = this.getLabelForValue(value) || '';
                return label.length > 18 ? `${label.slice(0, 18)}...` : label;
              }
              return graphMetric.value === 'percent' ? `${value}%` : `${value}h`;
            }
          },
          grid: {
            display: isHorizontal ? false : true,
            drawTicks: false,
            color: chrome.grid,
            lineWidth: 1,
          },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true,
          backgroundColor: 'rgba(17, 24, 39, 0.95)',
          titleColor: '#ffffff',
          titleFont: { weight: '700', size: 13 },
          bodyColor: '#e5e7eb',
          bodyFont: { size: 12 },
          padding: 12,
          cornerRadius: 10,
          displayColors: false,
          caretSize: 6,
          titleMarginBottom: 6,
          callbacks: {
            title: (items) => items[0]?.label || '',
            label: (ctx) => {
              const v = isHorizontal ? ctx.parsed.x : ctx.parsed.y;
              return `${ctx.dataset.label}: ${formatMetricValue(v, graphMetric.value)}`;
            },
            afterBody: (items) => {
              const index = items?.[0]?.dataIndex ?? -1;
              const row = index >= 0 ? chartRows.value[index] : null;
              if (!row) return [];
              const achievedText = row?.achieved ? 'Reached' : 'Not reached';
              const targetLabel = row?.isGroupAggregate ? 'Avg. member target' : 'Target';
              const lines = [];
              if (row?.isGroupAggregate && row.memberCount != null) {
                lines.push(`Members: ${row.memberCount}`);
              }
              lines.push(
                `Total:   ${formatMetricValue(row.chartTotalValue || 0, graphMetric.value)}`,
                `${targetLabel}:  ${formatMinutes(row?.periodTargetMinutes || 0)} (${achievedText})`,
              );
              // Manual added time, broken down by short reason (per-member rows only).
              const addedReasons = Array.isArray(row?.addedReasons) ? row.addedReasons : [];
              if (!row?.isGroupAggregate && addedReasons.length) {
                lines.push('', 'Added time:');
                const MAX_REASONS = 6;
                addedReasons.slice(0, MAX_REASONS).forEach((r) => {
                  const label = String(r?.shortReason || '').trim() || '(no reason)';
                  lines.push(`  • ${label}: ${formatMinutes(Math.round((Number(r?.seconds) || 0) / 60))}`);
                });
                if (addedReasons.length > MAX_REASONS) {
                  lines.push(`  • +${addedReasons.length - MAX_REASONS} more`);
                }
              }
              return lines;
            },
          },
        },
      },
    },
  });
};

// Re-render chart when plotted rows or scale cap change (includes graph type toggle)
watch(
  [chartRows, yAxisMax, chartBreakdownMode],
  async () => {
    await nextTick();
    buildChart();
  },
  { deep: false }
);

watch(effectiveTheme, async () => {
  await nextTick();
  buildChart();
});

// ── Sort ─────────────────────────────────────────────────────────────
const setSortOrder = (order) => {
  sortOrder.value = order; // watcher on displayData triggers chart rebuild
};

const setGraphMetric = (metric) => {
  graphMetric.value = metric;
};

const setChartOrientation = (orientation) => {
  chartOrientation.value = orientation;
};

const setChartBreakdownMode = (mode) => {
  chartBreakdownMode.value = mode;
};

const toggleApplyToAll = (checked) => {
  modalForm.value.applyToAll = checked;
  if (checked) {
    modalForm.value.userIds = [];
  }
};

const toggleUserSelection = (userId, checked) => {
  const current = new Set(modalForm.value.userIds);
  if (checked) current.add(userId);
  else current.delete(userId);
  modalForm.value.userIds = Array.from(current);
};

const selectedUsersCountText = computed(() => {
  if (usersLoading.value) return 'Loading users...';
  if (modalForm.value.applyToAll) return `Selected: All users (${users.value.length})`;
  return `Selected: ${modalForm.value.userIds.length} user(s)`;
});

/** Add-time modal: total minutes = hours×60 + minutes (minutes may exceed 59). */
const modalParsedHours = computed(() => {
  const n = Number(modalForm.value.hours);
  return Number.isFinite(n) && n >= 0 ? n : 0;
});
const modalParsedMinutes = computed(() => {
  const n = Number(modalForm.value.minutes);
  return Number.isFinite(n) && n >= 0 ? n : 0;
});
const modalTotalDurationMinutes = computed(() =>
  Math.max(0, Math.round(modalParsedHours.value * 60 + modalParsedMinutes.value))
);
const modalNormalizedHours = computed(() =>
  modalTotalDurationMinutes.value > 0 ? Math.floor(modalTotalDurationMinutes.value / 60) : 0
);
const modalNormalizedMinutes = computed(() =>
  modalTotalDurationMinutes.value > 0 ? modalTotalDurationMinutes.value % 60 : 0
);
/** Show literal input vs canonical breakdown when minute field ≥ 60 or fractional hours are used */
const modalDurationNeedsNormalize = computed(() => {
  if (modalTotalDurationMinutes.value <= 0) return false;
  if (modalParsedMinutes.value >= 60) return true;
  const h = modalParsedHours.value;
  return Number.isFinite(h) && h % 1 !== 0;
});

const modalRawHoursLabel = computed(() => modalForm.value.hours ?? 0);
const modalRawMinutesLabel = computed(() => modalForm.value.minutes ?? 0);

watch(chartOrientation, async () => {
  await nextTick();
  buildChart();
});

// ── Modal ─────────────────────────────────────────────────────────────
const loadUsers = async () => {
  if (users.value.length > 0) return; // already loaded
  usersLoading.value = true;
  try {
    const res = await getWorkflowUsers();
    users.value = res.data?.data?.users || [];
  } catch {
    users.value = [];
  } finally {
    usersLoading.value = false;
  }
};

const openModal = async () => {
  if (!canAddTime.value) {
    toast.warning('Only super admin can add time.');
    return;
  }
  modalForm.value = {
    userIds: [],
    applyToAll: false,
    date: dateFrom.value || todayStr(),
    hours: null,
    minutes: null,
    shortReason: '',
    description: '',
  };
  showModal.value = true;
  await loadUsers();
};

const closeModal = () => {
  showModal.value = false;
};

const handleAddTime = async () => {
  const { userIds, applyToAll, date, hours, minutes, shortReason, description } = modalForm.value;

  const targetUserIds = applyToAll ? users.value.map((u) => u._id) : userIds;
  if (!targetUserIds.length) {
    toast.warning('Please select at least one user.');
    return;
  }
  if (!date) {
    toast.warning('Please select a date.');
    return;
  }
  const h = Number(hours) || 0;
  const m = Number(minutes) || 0;
  if (h === 0 && m === 0) {
    toast.warning('Please enter hours or minutes greater than 0.');
    return;
  }

  modalLoading.value = true;
  try {
    const results = await Promise.allSettled(
      targetUserIds.map((uid) =>
        addWorkflowTime({ userId: uid, date, hours: h, minutes: m, shortReason, description })
      )
    );
    const successCount = results.filter((r) => r.status === 'fulfilled').length;
    const failCount = results.length - successCount;
    if (failCount === 0) {
      toast.success(`Time added successfully for ${successCount} user(s).`);
    } else {
      toast.warning(`Added for ${successCount} user(s), failed for ${failCount} user(s).`);
    }
    closeModal();
    await fetchChart();
  } catch (err) {
    toast.error(err.response?.data?.message || err.message || 'Failed to add time.');
  } finally {
    modalLoading.value = false;
  }
};

// ── Lifecycle ─────────────────────────────────────────────────────────
onMounted(() => {
  selectedWeek.value = weekStartDateKey(todayStr());
  fetchChart();
  fetchMonthTarget();
  fetchFinalSyncStatus();
  startAutoRefresh();
});

const isFilterComplete = () => {
  if (viewType.value === 'byDate') return !!selectedDate.value;
  if (viewType.value === 'byWeek') return !!selectedWeek.value;
  if (viewType.value === 'byMonth') return !!selectedMonth.value;
  if (viewType.value === 'byDateRange') return !!rangeFrom.value && !!rangeTo.value;
  return true;
};

watch(
  [viewType, selectedDate, selectedWeek, selectedMonth, rangeFrom, rangeTo],
  () => {
    if (!isFilterComplete()) return;
    fetchChart();
    fetchFinalSyncStatus();
  }
);

watch(chartGroupFilter, () => {
  if (!isFilterComplete()) return;
  fetchChart();
});

watch(targetMonthKey, () => {
  fetchMonthTarget();
});

onUnmounted(() => {
  stopAutoRefresh();
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
});
</script>

<style scoped>
/* ── Layout ── */
.wf-view {
  --wf-radius: 14px;
  --wf-line: var(--border-light, #e5e7eb);
  --wf-surface: var(--bg-primary, #fff);
  --wf-elevated: var(--bg-secondary, #f9fafb);
  --wf-muted: var(--text-secondary, #6b7280);
  max-width: 1400px;
  margin: 0 auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}


/* ── Focus banner ── */
.focus-banner {
  display: inline-flex;
  align-self: flex-start;
  align-items: center;
  gap: .5rem;
  padding: .4rem .7rem;
  background: var(--bg-primary);
  border: 1px solid var(--border-medium);
  border-radius: 8px;
  font-size: .78rem;
  color: var(--text-secondary);
  box-shadow: none;
}
.focus-banner__label {
  font-weight: 600;
  color: var(--text-tertiary);
}
.focus-banner__name {
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: -.01em;
}
.focus-banner__clear {
  background: var(--bg-primary);
  border: 1px solid var(--border-medium);
  color: var(--text-secondary);
  padding: .15rem .5rem;
  border-radius: 6px;
  font-size: .72rem;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: background .15s, color .15s;
}
.focus-banner__clear:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

/* ── Card ── */
.wf-card {
  background: var(--wf-surface);
  border: 1px solid var(--wf-line);
  border-radius: var(--wf-radius);
  padding: var(--spacing-lg, 1.25rem) var(--spacing-xl, 1.5rem);
  box-shadow: none;
  transition: border-color .15s ease;
}
.wf-card:hover {
  border-color: var(--border-medium);
}

/* staggered entry for each card on page load */
.filter-card,
.controls-card {
  animation: none;
}

/* ── Filter Card ── */
.tools-row {
  display: flex;
  align-items: flex-end;
  gap: .65rem;
  flex-wrap: nowrap;
  overflow: hidden;
  padding-bottom: 2px;
}

.toolbar-group {
  display: flex;
  align-items: center;
  gap: .35rem;
  flex-shrink: 0;
  min-height: 36px;
}

.toolbar-group--right {
  margin-left: auto;
  align-self: flex-end;
}
.include-holiday-toggle {
  display: inline-flex;
  align-items: center;
  gap: .4rem;
  padding: .35rem .6rem;
  border: 1px solid var(--border-color, #d1d5db);
  border-radius: 8px;
  font-size: .82rem;
  font-weight: 600;
  color: var(--text-secondary, #374151);
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}
.include-holiday-toggle:hover { background: var(--bg-secondary); }
.include-holiday-toggle input { cursor: pointer; accent-color: var(--color-primary); margin: 0; }
.final-sync-tools {
  display: inline-flex;
  align-items: center;
  gap: .45rem;
  margin-right: .45rem;
}
.confirmed-badge {
  height: 32px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, #10b981 40%, var(--border-light));
  background: color-mix(in srgb, #10b981 12%, var(--bg-primary));
  color: #047857;
  font-size: .75rem;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  text-transform: uppercase;
  letter-spacing: .04em;
}
.filter-group {
  display: flex;
  flex-direction: column;
  gap: .3rem;
  flex-shrink: 0;
  min-height: 52px;
  justify-content: flex-end;
}
.filter-label {
  font-size: .6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: var(--wf-muted);
}
.filter-input {
  padding: .38rem .68rem;
  border: 1px solid var(--border-medium, #d1d5db);
  border-radius: var(--radius-md, 8px);
  background: var(--wf-elevated);
  color: var(--text-primary, #111827);
  font-size: .875rem;
  font-family: inherit;
  min-width: 130px;
  height: 40px;
  box-sizing: border-box;
}
.filter-input:focus {
  outline: none;
  border-color: var(--color-primary, #6366f1);
  box-shadow: 0 0 0 3px rgba(99,102,241,.15);
}
.filter-group--group .filter-input {
  min-width: 11rem;
}

/* ── Chart Card ── */
.chart-card {
  min-height: 420px;
  display: flex;
  align-items: stretch;
  background: var(--wf-surface);
  animation: none;
  position: relative;
}
.sync-overlay {
  position: absolute;
  inset: 0;
  z-index: 5;
  background: rgba(15, 23, 42, 0.35);
  backdrop-filter: blur(1px);
  -webkit-backdrop-filter: blur(1px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #fff;
  border-radius: var(--wf-radius);
}
.sync-overlay p {
  margin: 0;
  font-size: .88rem;
  font-weight: 600;
}
.sync-spinner {
  width: 30px;
  height: 30px;
  border: 3px solid rgba(255, 255, 255, .3);
  border-top-color: #fff;
  border-radius: 999px;
  animation: wf-spin .8s linear infinite;
}
@keyframes wf-spin {
  to { transform: rotate(360deg); }
}
.chart-wrap {
  width: 100%;
  position: relative;
  min-height: 420px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.chart-viewport {
  width: 100%;
}
.chart-viewport--scroll {
  max-height: min(70vh, 760px);
  overflow-y: auto;
  overflow-x: hidden;
  border: 1px solid var(--wf-line);
  border-radius: 10px;
  padding: 6px;
}
.chart-canvas {
  width: 100% !important;
  min-height: 420px;
}
.chart-canvas--clickable {
  cursor: pointer;
}

.graph-breakdown {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 10px 16px;
  padding: 10px 12px;
  border: 1px solid var(--wf-line);
  border-radius: 12px;
  background: var(--wf-elevated);
}
.graph-breakdown__label {
  font-size: .6875rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .08em;
  color: var(--wf-muted);
}
.segmented {
  display: inline-flex;
  padding: 3px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--text-primary, #0f172a) 8%, transparent);
  border: 1px solid var(--wf-line);
  gap: 2px;
}
.segmented__btn {
  appearance: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
  font-size: .8125rem;
  font-weight: 650;
  padding: .45rem 1rem;
  border-radius: 8px;
  color: var(--text-secondary, #475569);
  background: transparent;
  transition: background .15s ease, color .15s ease, box-shadow .15s ease;
}
.segmented__btn:hover {
  color: var(--text-primary, #0f172a);
  background: color-mix(in srgb, var(--color-primary, #6366f1) 8%, transparent);
}
.segmented__btn--active {
  color: #fff;
  background: var(--color-primary, #6366f1);
  box-shadow: 0 4px 12px rgba(79, 70, 229, .28);
}

.score-list-wrap {
  border-top: 1px solid var(--wf-line);
  padding-top: 10px;
}
.score-list-title {
  margin-bottom: 8px;
  font-size: .72rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .05em;
  color: var(--wf-muted);
}
.score-list {
  display: flex;
  align-items: stretch;
  gap: 6px;
  flex-wrap: wrap;
  overflow: visible;
  padding: 2px 0 2px;
}
.score-chip {
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
  max-width: 200px;
  min-height: 34px;
  border: 2px solid #dc2626;
  background: rgba(254, 226, 226, 0.55);
  color: var(--text-primary);
  border-radius: 999px;
  padding: 4px 10px 4px 4px;
  font-size: 0.7rem;
  font-weight: 700;
  box-sizing: border-box;
}
.score-chip--achieved {
  border-color: #059669;
  background: rgba(209, 250, 229, 0.7);
}
.score-chip__avatar {
  flex-shrink: 0;
}
.score-chip__group-avatar {
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: .65rem;
  font-weight: 800;
  color: #fff;
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
  box-shadow: inset 0 0 0 2px rgba(255, 255, 255, .28);
}
.score-chip--group {
  max-width: 240px;
}
.score-chip__meta {
  font-size: .62rem;
  font-weight: 650;
  color: var(--text-secondary, #64748b);
  white-space: nowrap;
}
.score-chip__name {
  font-weight: 750;
  min-width: 0;
  max-width: 9.5rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@keyframes card-rise {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: none; }
}

/* Skeleton */
.chart-loading { width: 100%; }
.skeleton--chart {
  width: 100%;
  height: 340px;
  border-radius: var(--radius-md, 8px);
  background: linear-gradient(90deg, var(--bg-tertiary, #f3f4f6) 25%, var(--wf-line) 50%, var(--bg-tertiary, #f3f4f6) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
}
@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Empty / Error */
.empty-state {
  width: 100%;
  text-align: center;
  padding: 3rem 1rem;
  color: var(--wf-muted);
  font-size: .9375rem;
}
.empty-state span { font-size: 2.5rem; display: block; margin-bottom: .75rem; }
.error-banner {
  width: 100%;
  padding: 1rem 1.25rem;
  background: color-mix(in srgb, var(--color-error) 14%, var(--bg-primary));
  border: 1px solid color-mix(in srgb, var(--color-error) 40%, var(--border-light));
  color: color-mix(in srgb, var(--color-error) 88%, white);
  border-radius: var(--radius-md, 8px);
  font-size: .875rem;
}

.controls-label {
  font-size: .72rem;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: .03em;
  margin-right: .2rem;
}
/* ── Buttons ── */
.btn {
  padding: .38rem .78rem;
  border: 1px solid var(--border-medium);
  border-radius: 6px;
  font-size: .8rem;
  font-weight: 600;
  cursor: pointer;
  transition: background .15s ease, border-color .15s ease, color .15s ease;
  white-space: nowrap;
  font-family: inherit;
  height: 40px;
  box-sizing: border-box;
}

.btn--icon {
  width: 40px;
  height: 40px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.btn--icon svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.9;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.filter-card {
  background: transparent;
  border: none;
  box-shadow: none;
  padding: 0;
}

.summary-card {
  background: var(--wf-surface);
  border: 1px solid var(--wf-line);
  border-radius: var(--wf-radius);
  padding: 12px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.summary-item {
  border: 1px solid var(--wf-line);
  border-radius: 10px;
  padding: 10px 12px;
  background: var(--bg-primary);
}

.summary-label {
  margin: 0 0 6px;
  font-size: .7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .05em;
  color: var(--wf-muted);
}

.summary-value {
  font-size: 1.05rem;
  font-weight: 800;
  color: var(--text-primary);
}

.filter-calendar {
  min-width: 170px;
}

.date-inline-controls {
  display: flex;
  align-items: center;
  gap: .35rem;
}
.btn:disabled { opacity: .6; cursor: not-allowed; }

.btn--primary {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: #fff;
}
.btn--primary:hover:not(:disabled) {
  background: color-mix(in srgb, var(--color-primary) 90%, #000);
}
.btn--primary:active:not(:disabled) { background: color-mix(in srgb, var(--color-primary) 85%, #000); }

.btn--sort {
  background: var(--bg-primary);
  border-color: var(--wf-line);
  color: var(--wf-muted);
}
.btn--sort:hover { background: var(--bg-secondary); color: var(--text-primary, #111827); }
.btn--sort-active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: #fff;
}
.btn--sort-active:hover { background: color-mix(in srgb, var(--color-primary) 90%, #000); }

.btn--add {
  background: #0f9d6b;
  border-color: #0f9d6b;
  color: #fff;
  font-size: .82rem;
  padding: .45rem .9rem;
}
.btn--add:hover {
  background: #0c835a;
  border-color: #0c835a;
}


.btn--cancel {
  background: var(--wf-elevated);
  border-color: var(--wf-line);
  color: var(--wf-muted);
}
.btn--cancel:hover { background: var(--wf-line); }

/* ── Modal ── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.65);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}
.modal {
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: var(--wf-radius);
  box-shadow: var(--shadow-lg);
  width: 100%;
  max-width: 480px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  opacity: 1;
  animation: modal-in .2s ease;
}
@keyframes modal-in {
  from { opacity: 0; transform: scale(.96) translateY(8px); }
  to   { opacity: 1; transform: none; }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem 1rem;
  border-bottom: 1px solid var(--border-light);
  background: var(--bg-tertiary);
}
.modal-title {
  font-size: 1.0625rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}
.modal-close {
  background: none;
  border: none;
  font-size: .875rem;
  color: var(--wf-muted);
  cursor: pointer;
  padding: .25rem .5rem;
  border-radius: var(--radius-sm, 6px);
  transition: background .15s, color .15s;
  font-family: inherit;
}
.modal-close:hover {
  background: color-mix(in srgb, var(--color-error) 16%, var(--bg-primary));
  color: var(--color-error);
}

.modal-body {
  padding: 1.25rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  overflow-y: auto;
  max-height: 60vh;
  background: var(--bg-primary);
}

.modal-footer {
  display: flex;
  gap: .75rem;
  justify-content: flex-end;
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border-light);
  background: var(--bg-primary);
}

.modal .form-input {
  background: var(--bg-primary);
  border-color: var(--border-medium);
  color: var(--text-primary);
}
.modal .form-input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-soft);
}
.modal .form-label {
  color: var(--text-tertiary);
}
.modal .time-preview {
  background: var(--color-primary-soft);
  border: 1px solid var(--border-light);
  color: var(--color-primary);
}

/* ── Form elements ── */
.form-group {
  display: flex;
  flex-direction: column;
  gap: .3rem;
}
.form-row {
  display: flex;
  gap: 1rem;
}
.form-row .form-group { flex: 1; }

.form-label {
  font-size: .6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: var(--wf-muted);
}
.optional {
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
  font-size: .6875rem;
  color: var(--wf-muted);
}
.form-input {
  padding: .5rem .75rem;
  border: 1px solid var(--border-medium, #d1d5db);
  border-radius: var(--radius-md, 8px);
  background: var(--wf-elevated);
  color: var(--text-primary, #111827);
  font-size: .875rem;
  font-family: inherit;
  width: 100%;
  box-sizing: border-box;
}
.member-picker {
  border: 1px solid var(--border-medium, #d1d5db);
  border-radius: var(--radius-md, 8px);
  background: var(--wf-elevated);
  padding: .5rem .625rem;
}
.member-picker__all {
  display: inline-flex;
  align-items: center;
  gap: .45rem;
  font-size: .84rem;
  font-weight: 600;
  color: var(--text-primary, #111827);
}
.member-picker__list {
  margin-top: .55rem;
  max-height: 160px;
  overflow-y: auto;
  border-top: 1px solid var(--border-light);
  padding-top: .45rem;
  display: flex;
  flex-direction: column;
  gap: .3rem;
}
.member-picker__item {
  display: inline-flex;
  align-items: center;
  gap: .5rem;
  font-size: .82rem;
  color: var(--text-primary, #111827);
  cursor: pointer;
}
.member-picker__checkbox {
  flex-shrink: 0;
}
.member-picker__avatar {
  flex-shrink: 0;
}
.member-picker__text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
  gap: 2px;
  line-height: 1.2;
}
.member-picker__name {
  font-weight: 650;
}
.member-picker__email {
  font-size: .74rem;
  color: var(--wf-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}
.field-hint--modal {
  margin: -6px 0 4px;
  font-size: .75rem;
  color: var(--wf-muted);
  line-height: 1.35;
}
.time-preview__raw {
  display: inline;
  margin-left: 0.35rem;
  font-size: .78rem;
  font-weight: 500;
  color: var(--text-secondary);
  opacity: 0.92;
}
.member-picker__hint {
  margin-top: .45rem;
  font-size: .75rem;
  color: var(--wf-muted);
}
.form-input:focus {
  outline: none;
  border-color: var(--color-primary, #6366f1);
  box-shadow: 0 0 0 3px rgba(99,102,241,.15);
}
.form-textarea {
  resize: vertical;
  min-height: 80px;
}

.time-preview {
  font-size: .875rem;
  color: var(--color-primary, #6366f1);
  background: rgba(99,102,241,.08);
  border: 1px solid rgba(99,102,241,.2);
  border-radius: var(--radius-md, 8px);
  padding: .5rem .875rem;
}

@media (max-width: 1024px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .summary-grid {
    grid-template-columns: 1fr;
  }
}
</style>
