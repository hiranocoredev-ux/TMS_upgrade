<template>
  <div class="main-layout">
    <aside class="sidebar">
      <div class="sidebar-header">
        <router-link to="/dashboard" class="logo-link" aria-label="Go to Dashboard">
          <div class="brand-mark" aria-hidden="true">TMS</div>
          <div class="brand-text">
            <strong>Team Management</strong>
            <span>System</span>
          </div>
        </router-link>
      </div>

      <nav class="sidebar-nav">
        <!-- =====================
             DASHBOARD
        ====================== -->
        <router-link :to="{ name: 'Dashboard' }" class="nav-item">
          <span class="group-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M3 10.5L12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-10.5Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>
          <span>Dashboard</span>
        </router-link>

        <!-- =====================
             USER MANAGEMENT
        ====================== -->
        <div v-if="isAdmin" class="nav-group">
          <div
            @click="userManagementMenuOpen = !userManagementMenuOpen"
            class="nav-item nav-group-header"
            :class="{ active: isUserManagementRoute }"
          >
            <span class="group-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                <circle cx="9" cy="8" r="3" stroke="currentColor" stroke-width="1.8"/>
                <path d="M22 19v-1a4 4 0 0 0-3-3.87" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                <path d="M16 5.13a3 3 0 0 1 0 5.74" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
              </svg>
            </span>
            <span>User Management</span>
            <span class="nav-arrow" :class="{ open: userManagementMenuOpen }">▼</span>
          </div>

          <div v-show="userManagementMenuOpen" class="nav-submenu">
            <router-link :to="{ name: 'UserManagement' }" class="nav-item nav-subitem">
              <span>Users</span>
            </router-link>
            <router-link :to="{ name: 'GroupTreeManagement' }" class="nav-item nav-subitem">
              <span>Groups</span>
            </router-link>
          </div>
        </div>
        <!-- =====================
             USER MANAGEMENT
        ====================== -->
        <!-- <router-link v-if="isAdmin" :to="{ name: 'CompetitionManagement' }" class="nav-item">
          <span class="nav-icon">👥</span>
          <span>Competition Management</span>
        </router-link> -->

        <!-- =====================
             WORKFLOW
        ====================== -->
        <div v-if="!isFinanceManager" class="nav-group">
          <div
            @click="workflowMenuOpen = !workflowMenuOpen"
            class="nav-item nav-group-header"
            :class="{ active: isWorkflowRoute }"
          >
            <span class="group-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/>
                <path d="M12 7v5l3 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </span>
            <span>WorkTime Management</span>
            <span class="nav-arrow" :class="{ open: workflowMenuOpen }">▼</span>
          </div>

          <div v-show="workflowMenuOpen" class="nav-submenu">
            <router-link :to="{ name: 'WorkflowGraph' }" class="nav-item nav-subitem">
              <span>Worktime Summarize</span>
            </router-link>
            <router-link :to="{ name: 'WorkflowSettings' }" class="nav-item nav-subitem">
              <span>WorkTime Settings</span>
            </router-link>
          </div>
        </div>

        <!-- =====================
             COMPETITION
        ====================== -->
        <div v-if="!isFinanceManager" class="nav-group">
          <div
            @click="competitionMenuOpen = !competitionMenuOpen"
            class="nav-item nav-group-header"
            :class="{ active: isCompetitionRoute }"
          >
            <span class="group-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7L12 17.8 5.7 21l2.3-7-6-4.6h7.6L12 2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
              </svg>
            </span>
            <span>Competition</span>
            <span class="nav-arrow" :class="{ open: competitionMenuOpen }">▼</span>
          </div>

          <div v-show="competitionMenuOpen" class="nav-submenu">
            <router-link :to="{ name: 'CompetitionDashboard' }" class="nav-item nav-subitem">
              <span>Leaderboard</span>
            </router-link>
            <router-link :to="{ name: 'CompetitionHistory' }" class="nav-item nav-subitem">
              <span>History</span>
            </router-link>
            <router-link :to="{ name: 'CompetitionRules' }" class="nav-item nav-subitem">
              <span>Rules &amp; settings</span>
            </router-link>
          </div>
        </div>

        <!-- ==========================================================================================
                             Daily Report Management     Created By : Tom(2026/2/24 11:22 AM)
        ========================================================================================== -->
        <div v-if="!isFinanceManager" class="nav-group report-nav-group">
          <div @click="dailyreportMenuOpen = !dailyreportMenuOpen" class="nav-item nav-group-header"
            :class="{ active: isDailyReportRoute }">
            <span class="group-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <rect x="5" y="3" width="14" height="18" rx="2" stroke="currentColor" stroke-width="1.8"/>
                <path d="M8 8h8M8 12h8M8 16h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
              </svg>
            </span>
            <span>Report management</span>
            <span v-if="showActions"  class="badge">⏳</span>
            <span class="nav-arrow" :class="{ open: dailyreportMenuOpen }">▼</span>
          </div>

          <ReportNavSubmenu v-show="dailyreportMenuOpen" :is-admin="isAdmin" :is-boss="isBoss" />
        </div>

        <!-- =====================
             PROFILES
        ====================== -->
        <div v-if="!isFinanceManager" class="nav-group">
          <div @click="profileMenuOpen = !profileMenuOpen" class="nav-item nav-group-header"
            :class="{ active: isProfileRoute }">
            <span class="group-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.8"/>
                <circle cx="9" cy="11" r="2.4" stroke="currentColor" stroke-width="1.8"/>
                <path d="M5.4 17c.7-1.9 2.2-2.9 3.6-2.9s2.9 1 3.6 2.9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                <path d="M14.5 9.5h4.5M14.5 12h4.5M14.5 14.5h3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
              </svg>
            </span>
            <span>Profiles</span>
            <span class="nav-arrow" :class="{ open: profileMenuOpen }">▼</span>
          </div>

          <div v-show="profileMenuOpen" class="nav-submenu">
            <router-link :to="{ name: 'CitizenProfiles' }" class="nav-item nav-subitem">
              <span>Profiles</span>
            </router-link>

            <router-link :to="{ name: 'MemberProfiles' }" class="nav-item nav-subitem">
              <span>Member's Summarize</span>
            </router-link>
          </div>
        </div>
        <!-- =====================
             Interview
        ====================== -->
        <!-- <router-link :to="{ name: 'InterviewBoardsList' }" class="nav-item">
          <span class="nav-icon">💼</span>
          <span>Interviews Management</span>
        </router-link> -->

        <!-- <router-link :to="{ name: 'Assignments' }" class="nav-item ">
          <span class="nav-icon">📝</span>
          <span>Project & Task</span>
        </router-link> -->
        <!-- =====================
             ASSIGNMENTS
        ====================== -->
        <!-- <div class="nav-group">
          <div @click="assignmentMenuOpen = !assignmentMenuOpen" class="nav-item nav-group-header"
            :class="{ active: isAssignmentsRoute }">
            <span class="nav-icon">📝</span>
            <span>Assignments</span>
            <span class="nav-arrow" :class="{ open: assignmentMenuOpen }">▼</span>
          </div> -->

        <!-- <div class="nav-submenu">
            <router-link
              :to="{ name: 'Assignments' }"
              class="nav-item nav-subitem"
            >
              <span class="nav-icon">📝</span>
              <span>Assignments</span>
            </router-link> -->
        <!-- 
            <router-link
              :to="{ name: 'AssignmentCreate' }"
              class="nav-item nav-subitem"
            >
              <span class="nav-icon">➕</span>
              <span>New Assignment</span>
            </router-link> -->

        <!-- <router-link
              :to="{ name: 'EarningsTrend' }"
              class="nav-item nav-subitem"
            >
              <span class="nav-icon">📈</span>
              <span>Earnings Trend</span>
            </router-link> -->
        <!-- </div> -->
        <!-- </div> -->

        <!-- =====================
             FINANCE
        ====================== -->
        <div class="nav-group">
          <div @click="financeMenuOpen = !financeMenuOpen" class="nav-item nav-group-header"
            :class="{ active: isFinanceRoute }">
            <span class="group-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M12 3v18M16 7.5a4 4 0 0 0-4-2.5c-2.21 0-4 1.34-4 3s1.79 3 4 3 4 1.34 4 3-1.79 3-4 3a4 4 0 0 1-4-2.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
              </svg>
            </span>
            <span>Finance Management</span>
            <span class="nav-arrow" :class="{ open: financeMenuOpen }">▼</span>
          </div>

          <div v-show="financeMenuOpen" class="nav-submenu">
            <router-link :to="{ name: 'FinanceOverview' }" class="nav-item nav-subitem">
              <span>Overview</span>
            </router-link>

            <router-link :to="{ name: 'MonthlyPlansView' }" class="nav-item nav-subitem">
              <span>Monthly Plans</span>
            </router-link>

            <router-link :to="{ name: 'PeriodicPlansView' }" class="nav-item nav-subitem">
              <span>Weekly Plans</span>
            </router-link>

            <router-link :to="{ name: 'TransactionsView' }" class="nav-item nav-subitem">
              <span>Transactions</span>
            </router-link>

            <router-link :to="{ name: 'PaymentRequests' }" class="nav-item nav-subitem">
              <span>Payment requests</span>
            </router-link>

            <!-- Legacy Finance view (kept for backward compatibility) -->
            <!-- <router-link
              :to="{ name: 'Finance' }"
              class="nav-item nav-subitem"
            >
              <span class="nav-icon">💼</span>
              <span>Finance (Legacy)</span>
            </router-link> -->
          </div>
        </div>

        <!-- =====================
             SUMMARIZE
        ====================== -->
        <div class="nav-group">
          <div
            @click="summarizeMenuOpen = !summarizeMenuOpen"
            class="nav-item nav-group-header"
            :class="{ active: isSummarizeRoute }"
          >
            <span class="group-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" stroke-width="1.8"/>
                <path d="M3 9h18M3 14.5h18M9 9v11" stroke="currentColor" stroke-width="1.8"/>
              </svg>
            </span>
            <span>Summarize</span>
            <span class="nav-arrow" :class="{ open: summarizeMenuOpen }">▼</span>
          </div>

          <div v-show="summarizeMenuOpen" class="nav-submenu">
            <router-link :to="{ name: 'SummarizeWeekly' }" class="nav-item nav-subitem">
              <span>Weekly Summarize</span>
            </router-link>
            <router-link :to="{ name: 'SummarizeMonthly' }" class="nav-item nav-subitem">
              <span>Monthly Summarize</span>
            </router-link>
          </div>
        </div>

        <!-- =====================
             HUBSTAFF
        ====================== -->
        <!-- <router-link :to="{ name: 'Hubstaff' }" class="nav-item">
          <span class="nav-icon">⏱️</span>
          <span>Time & Activity</span>
        </router-link> -->


        <!-- =====================
             AUDIT LOGS
        ====================== -->
        <router-link v-if="canViewAuditLogs(authStore.user)" :to="{ name: 'AuditLogs' }" class="nav-item">
          <span class="group-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M4 19h16M7 16V8M12 16V5M17 16v-3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
          </span>
          <span>Audit Logs</span>
        </router-link>

        <router-link v-if="!isFinanceManager" :to="{ name: 'NotificationSettings' }" class="nav-item">
          <span class="group-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M6 8a6 6 0 1 1 12 0v5l2 3H4l2-3V8Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M10 19a2 2 0 0 0 4 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
          </span>
          <span>Notify Settings</span>
        </router-link>

        <router-link v-if="!isFinanceManager" :to="{ name: 'SendMessage' }" class="nav-item">
          <span class="group-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M22 2L11 13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
              <path d="M22 2L15 22l-4-9-9-4 20-7Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
            </svg>
          </span>
          <span>Send Message</span>
        </router-link>

        <!-- =====================
             DATABASE MANAGEMENT
        ====================== -->
        <router-link v-if="isSuperAdmin" :to="{ name: 'DatabaseManagement' }" class="nav-item">
          <span class="group-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <ellipse cx="12" cy="6" rx="7" ry="3" stroke="currentColor" stroke-width="1.8"/>
              <path d="M5 6v12c0 1.66 3.13 3 7 3s7-1.34 7-3V6" stroke="currentColor" stroke-width="1.8"/>
              <path d="M5 12c0 1.66 3.13 3 7 3s7-1.34 7-3" stroke="currentColor" stroke-width="1.8"/>
            </svg>
          </span>
          <span>Database Management</span>
        </router-link>
      </nav>

      <div class="sidebar-footer">
        <div class="user-menu-wrap">
          <button class="user-info" @click="userMenuOpen = !userMenuOpen">
            <UserAvatar
              :name="authStore.user?.name || 'User'"
              :profile-image="authStore.user?.avatarUrl"
              :size="34"
              :tooltip="false"
            />
            <span class="user-meta">
              <span class="user-name">{{ authStore.user?.name || 'User' }}</span>
              <span class="user-role">{{ formatRole(authStore.user?.role) }}</span>
            </span>
            <span class="user-menu-arrow">▾</span>
          </button>
          <div v-if="userMenuOpen" class="user-menu">
            <router-link :to="{ name: 'MyProfile' }" class="user-menu-item" @click="userMenuOpen = false">
              My Profile
            </router-link>
            <button class="user-menu-item danger" @click="handleLogout">Logout</button>
          </div>
        </div>
      </div>
    </aside>

    <div class="layout-content">
      <header class="topbar">
        <div class="topbar-brand-icon" aria-hidden="true">TMS</div>
        <h1 class="page-title">{{ currentPageTitle }}</h1>
        <div class="topbar-actions">
          <div class="theme-control">
            <label class="theme-control__label" for="tms-theme-select">Theme</label>
            <select
              id="tms-theme-select"
              v-model="themePreference"
              class="theme-control__select"
              aria-label="Interface color theme"
            >
              <option v-for="opt in themeOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>
          <time
            class="topbar-est-clock"
            :datetime="estClockIso"
            aria-live="polite"
            :title="'Current time in Eastern Time (' + EST_DISPLAY_LABEL + ')'"
          >
            {{ estClockText }}
          </time>
          <router-link :to="{ name: 'MyProfile' }" class="topbar-user">
            <UserAvatar
              :name="authStore.user?.name || 'User'"
              :profile-image="authStore.user?.avatarUrl"
              :size="28"
              :tooltip="false"
            />
            <span class="topbar-user-name">{{ authStore.user?.name || 'User' }}</span>
          </router-link>
        </div>
      </header>

      <div v-if="notifySetupWarning" class="notify-warning-banner">
        <span class="notify-warning-banner__dot">!</span>
        <span>
          Notifications are disabled or not configured. Please complete setup in
          <router-link :to="{ name: 'MyProfile' }">My Profile</router-link>.
        </span>
      </div>
      <div v-if="reportRejectWarning.show" class="reject-global-banner">
        <span class="reject-global-banner__dot">!</span>
        <span>
          You have a rejected report that needs update:
          <strong>{{ reportRejectWarning.periodLabel }}</strong> ({{ reportRejectWarning.dateKey }}).
          Reason: {{ reportRejectWarning.reason }}
        </span>
      </div>

      <main class="main-content">
        <div class="content-shell">
          <router-view :key="route.fullPath" />
        </div>
      </main>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '../composables/useAuth';
import { useThemeAppearance } from '../composables/useThemeAppearance';
import { canViewAuditLogs, hasAnyRole } from '../utils/permissions';
import { ROLES, LEGACY_ROLES, isFinanceManagerRole, isFullAdminRole } from '../constants/roles';
import UserAvatar from '../components/UserAvatar.vue';
import ReportNavSubmenu from '../components/navigation/ReportNavSubmenu.vue';
import { getReportsByUser } from '../services/reports';
import { REPORT_PERIODS, normalizeDateForPeriod, shiftPeriodDate } from '../utils/reportPeriod';

const authStore = useAuthStore();
const route = useRoute();
const { themePreference, themeOptions } = useThemeAppearance();

/** Matches backend `America/New_York` (EST / EDT). */
const EST_TIMEZONE = 'America/New_York';
const EST_DISPLAY_LABEL = 'US Eastern';

const estClockText = ref('');
const estClockIso = ref('');

const estClockFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: EST_TIMEZONE,
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
  hour12: true,
  timeZoneName: 'short'
});

function tickEstClock() {
  const now = new Date();
  estClockIso.value = now.toISOString();
  estClockText.value = estClockFormatter.format(now);
}

tickEstClock();

let estClockTimer = null;
onMounted(() => {
  estClockTimer = setInterval(tickEstClock, 1000);
});
onBeforeUnmount(() => {
  if (estClockTimer) clearInterval(estClockTimer);
});

const dailyreportMenuOpen = ref(false);
const profileMenuOpen = ref(false);
const assignmentMenuOpen = ref(false);
const financeMenuOpen = ref(false);
const userManagementMenuOpen = ref(false);
const workflowMenuOpen = ref(false);
const competitionMenuOpen = ref(false);
const summarizeMenuOpen = ref(false);
const userMenuOpen = ref(false);

const isBadge = ref(false)
const showActions = computed(() => isBadge.value)
/** Finance manager: sidebar shows Dashboard, Finance and Summarize only. */
const isFinanceManager = computed(() =>
  isFinanceManagerRole(authStore.user?.role, authStore.user?.degree)
);
// Finance managers get no report reminders, so there is nothing to set up.
const notifySetupWarning = computed(() =>
  !!authStore.user && !isFinanceManager.value && (authStore.user.notification?.needsSetupWarning ?? true)
);
const reportRejectWarning = ref({ show: false, reason: '', periodLabel: '', dateKey: '' });

const Badge = () => {
 
  if (authStore.user.group === "*") isBadge.value = true
  else isBadge.value = false
  // alert(authStore.user.group)
}

/** Super admin or Admin (SYSTEM_ADMIN): every non-finance admin section. */
const isAdmin = computed(() =>
  isFullAdminRole(authStore.user?.role, authStore.user?.degree)
);
/** Super admin only (Database Management). */
const isSuperAdmin = computed(() =>
  hasAnyRole(authStore.user, [ROLES.SUPER_ADMIN])
);
const isBoss = computed(() =>
  hasAnyRole(authStore.user, [ROLES.GROUP_BOSS, LEGACY_ROLES.ADMIN, LEGACY_ROLES.BOSS])
);

const isFinanceAdmin = computed(() =>
  hasAnyRole(authStore.user, [
    ROLES.SUPER_ADMIN,
    ROLES.GROUP_BOSS,
    LEGACY_ROLES.ADMIN,
    LEGACY_ROLES.BOSS,
  ])
);


const isDailyReportRoute = computed(() => route.path.startsWith('/dailyreports'));
const currentReportPeriod = computed(() => route.meta?.reportPeriod || 'daily');

const isProfileRoute = computed(() => route.path.startsWith('/profiles'));
const isAssignmentsRoute = computed(() => route.path.startsWith('/assignments'));
const isFinanceRoute = computed(() => route.path.startsWith('/finance'));
const isUserManagementRoute = computed(() => route.path.startsWith('/user-management'));
const isWorkflowRoute = computed(() => route.path.startsWith('/workflow'));
const isCompetitionRoute = computed(() => route.path.startsWith('/competition'));
const isSummarizeRoute = computed(() => route.path.startsWith('/summarize'));

watch(
  () => route.path,
  (path) => {
    Badge();
    if (path.startsWith('/dailyreports')) dailyreportMenuOpen.value = true;
    if (path.startsWith('/profiles')) profileMenuOpen.value = true;
    if (path.startsWith('/assignments')) assignmentMenuOpen.value = true;
    if (path.startsWith('/finance')) financeMenuOpen.value = true;
    if (path.startsWith('/user-management')) userManagementMenuOpen.value = true;
    if (path.startsWith('/workflow')) workflowMenuOpen.value = true;
    if (path.startsWith('/competition')) competitionMenuOpen.value = true;
    if (path.startsWith('/summarize')) summarizeMenuOpen.value = true;
    userMenuOpen.value = false;
  },
  { immediate: true }
);

const currentPageTitle = computed(
  () => route.meta.title || 'Team Management'
);

const formatRole = (role) =>
  role === ROLES.SYSTEM_ADMIN
    ? 'Admin'
    : role
    ? role.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
    : '';

const handleLogout = async () => {
  await authStore.logout();
  // router.replace('/login');
};

function dateKeyToday() {
  return new Date().toLocaleDateString('en-CA');
}

function keysForPeriod(period) {
  const today = dateKeyToday();
  if (period === REPORT_PERIODS.DAILY) return [today, shiftPeriodDate(today, -1, REPORT_PERIODS.DAILY)];
  if (period === REPORT_PERIODS.WEEKLY) {
    const current = normalizeDateForPeriod(today, REPORT_PERIODS.WEEKLY);
    return [current, shiftPeriodDate(current, -1, REPORT_PERIODS.WEEKLY)];
  }
  const current = normalizeDateForPeriod(today, REPORT_PERIODS.MONTHLY);
  return [current, shiftPeriodDate(current, -1, REPORT_PERIODS.MONTHLY)];
}

async function refreshRejectWarning() {
  const uid = authStore.user?.id || authStore.user?._id;
  // Finance managers write no reports, so there is nothing to warn about.
  if (!uid || isFinanceManager.value) {
    reportRejectWarning.value = { show: false, reason: '', periodLabel: '', dateKey: '' };
    return;
  }
  try {
    const periods = [REPORT_PERIODS.DAILY, REPORT_PERIODS.WEEKLY, REPORT_PERIODS.MONTHLY];
    for (const p of periods) {
      const keys = new Set(keysForPeriod(p));
      const res = await getReportsByUser(p, uid);
      const rows = Array.isArray(res?.data) ? res.data : [];
      const hit = rows.find((r) => {
        const dateKey = String(r?.date || '').split('T')[0];
        return [3, 4].includes(Number(r?.state || 0)) && keys.has(dateKey);
      });
      if (hit) {
        reportRejectWarning.value = {
          show: true,
          reason: String(hit.rejectReason || '').trim() || 'No reason provided',
          periodLabel: p.charAt(0).toUpperCase() + p.slice(1),
          dateKey: String(hit.date || '').split('T')[0],
        };
        return;
      }
    }
    reportRejectWarning.value = { show: false, reason: '', periodLabel: '', dateKey: '' };
  } catch {
    reportRejectWarning.value = { show: false, reason: '', periodLabel: '', dateKey: '' };
  }
}

watch(
  () => [route.path, authStore.user?.id, authStore.user?._id],
  () => {
    void refreshRejectWarning();
  },
  { immediate: true }
);
</script>


<style scoped>
.main-layout {
  display: flex;
  height: 100vh;
  background: var(--bg-secondary);
  overflow: hidden;
}

.sidebar {
  width: var(--sidebar-width);
  background: var(--shell-sidebar-bg);
  color: var(--shell-nav-text);
  border-right: 1px solid var(--shell-sidebar-border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.sidebar-header {
  padding: 10px 10px 12px;
  border-bottom: 1px solid var(--shell-sidebar-border);
  background: var(--shell-sidebar-header-bg);
}

.logo-link {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  line-height: 1;
  padding: 8px;
  border-radius: 8px;
  background: var(--shell-logo-well-bg);
  border: 1px solid var(--shell-logo-well-border);
}

.brand-mark {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: var(--shell-brand-mark-bg);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.98rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  flex-shrink: 0;
}

.brand-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.brand-text strong {
  color: var(--shell-brand-strong);
  font-size: 0.84rem;
  line-height: 1.1;
  font-weight: 700;
}

.brand-text span {
  color: var(--shell-brand-muted);
  font-size: 0.75rem;
  line-height: 1.1;
  font-weight: 600;
}

.sidebar-nav {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0 10px;
}

.sidebar-nav::-webkit-scrollbar {
  width: 6px;
}

.sidebar-nav::-webkit-scrollbar-thumb {
  background: var(--shell-scrollbar-sidebar);
  border-radius: 999px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 2px 8px;
  padding: 9px 11px;
  border-radius: 8px;
  color: var(--shell-nav-text);
  font-size: 0.86rem;
  font-weight: 500;
  text-decoration: none;
  border: 1px solid transparent;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.group-icon {
  width: 17px;
  height: 17px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--shell-nav-icon);
}

.group-icon svg {
  width: 17px;
  height: 17px;
}

.nav-item:hover {
  background: var(--shell-nav-hover-bg);
  color: #f8fafc;
}

.nav-item.router-link-active {
  background: var(--shell-nav-active-bg);
  border-color: var(--shell-nav-active-border);
  color: #f8fafc;
}

.nav-item.router-link-active .group-icon {
  color: #dfefff;
}

.nav-group {
  margin: 2px 0;
}

.nav-group-header {
  cursor: pointer;
}

.nav-arrow {
  margin-left: auto;
  font-size: 0.72rem;
  opacity: 0.7;
  transition: transform 0.15s ease;
}

.nav-arrow.open {
  transform: rotate(180deg);
}

.badge {
  margin-left: 6px;
  background: #b42318;
  color: #fff;
  font-size: 0.68rem;
  padding: 1px 6px;
  border-radius: 999px;
}

.nav-submenu {
  margin: 4px 8px 0;
  padding: 5px;
  border-radius: 8px;
  background: var(--shell-submenu-bg);
  border: 1px solid var(--shell-submenu-border);
}

.report-period-group {
  margin: 5px 3px;
  border-radius: 8px;
  border: 1px solid var(--shell-period-border);
  background: var(--shell-period-bg);
}

.period-header {
  width: 100%;
  border: none;
  background: transparent;
  color: var(--shell-nav-text);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  font-size: 0.76rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.period-header:hover {
  background: rgba(148, 163, 184, 0.12);
}

.period-links {
  padding: 2px 4px 7px;
}

.nav-subitem {
  font-size: 0.81rem;
  margin: 3px 0;
  padding-left: 31px;
}

.nav-subitem.router-link-active {
  background: rgba(31, 78, 140, 0.32);
  border-color: rgba(124, 164, 214, 0.45);
}

.sidebar-footer {
  border-top: 1px solid var(--shell-sidebar-border);
  padding: 12px;
}

.user-menu-wrap {
  position: relative;
}

.user-info {
  width: 100%;
  padding: 9px;
  border-radius: 8px;
  border: 1px solid var(--shell-user-btn-border);
  background: var(--shell-user-btn-bg);
  display: flex;
  align-items: center;
  gap: 8px;
  text-align: left;
  cursor: pointer;
}

.user-meta {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
  gap: 2px;
}

.user-menu-arrow {
  font-size: 0.8rem;
  color: #9fb3c9;
}

.user-name {
  color: #f8fafc;
  font-size: 0.84rem;
  font-weight: 600;
}

.user-role {
  color: #b6c5d8;
  font-size: 0.73rem;
  text-transform: capitalize;
}

.user-menu {
  position: absolute;
  left: 0;
  right: 0;
  bottom: calc(100% + 6px);
  border: 1px solid var(--shell-dropdown-border);
  border-radius: 8px;
  background: var(--shell-dropdown-bg);
  padding: 6px;
  box-shadow: 0 8px 18px rgba(2, 8, 23, 0.35);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.user-menu-item {
  width: 100%;
  text-align: left;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--shell-dropdown-text);
  font-size: 0.8rem;
  padding: 7px 8px;
  cursor: pointer;
}

.user-menu-item:hover {
  background: rgba(148, 163, 184, 0.16);
}

.user-menu-item.danger {
  color: #fecaca;
}

.logout-btn {
  width: 100%;
  border: 1px solid #a93131;
  background: #b42318;
  color: #fff;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 0.83rem;
  font-weight: 600;
}

.logout-btn:hover {
  background: #9f1d1d;
}

.layout-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.topbar {
  height: var(--topbar-height);
  background: var(--shell-topbar-bg);
  border-bottom: 1px solid var(--border-light);
  padding: 0 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.topbar-brand-icon {
  width: 26px;
  height: 26px;
  border-radius: 7px;
  background: var(--shell-topbar-brand);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.64rem;
  font-weight: 800;
  letter-spacing: 0.03em;
  flex-shrink: 0;
}

.page-title {
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.theme-control {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.theme-control__label {
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-tertiary);
}

.theme-control__select {
  appearance: none;
  -webkit-appearance: none;
  min-width: 6.25rem;
  padding: 5px 26px 5px 8px;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-primary);
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: 8px;
  cursor: pointer;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 7px center;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.theme-control__select:hover {
  border-color: var(--border-medium);
}

.theme-control__select:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-soft);
}

.topbar-user {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 3px 6px;
  border: 1px solid var(--border-light);
  border-radius: 999px;
  background: var(--bg-primary);
  text-decoration: none;
}

.topbar-user-name {
  font-size: 0.78rem;
  color: var(--text-secondary);
  max-width: 150px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.topbar-est-clock {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-secondary);
  white-space: nowrap;
  padding: 4px 10px;
  border: 1px solid var(--border-light);
  border-radius: 999px;
  background: var(--bg-primary);
  letter-spacing: 0.01em;
  flex-shrink: 0;
}

.notify-warning-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 8px 10px 0;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid #fecdca;
  background: #fff6ed;
  color: #9a3412;
  font-size: 0.78rem;
  font-weight: 600;
}

.notify-warning-banner a {
  color: #7c2d12;
  text-decoration: underline;
}

.notify-warning-banner__dot {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #f97316;
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.72rem;
  font-weight: 800;
  flex-shrink: 0;
}

.reject-global-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 8px 10px 0;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid #fdba74;
  background: #fff7ed;
  color: #9a3412;
  font-size: 0.78rem;
  font-weight: 600;
}

.reject-global-banner__dot {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #f97316;
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.72rem;
  font-weight: 800;
  flex-shrink: 0;
}

.main-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px 10px;
  background: var(--bg-secondary);
}

.main-content::-webkit-scrollbar {
  width: 8px;
}

.main-content::-webkit-scrollbar-thumb {
  background: var(--shell-main-scrollbar);
  border-radius: 999px;
}

.content-shell {
  width: 100%;
  max-width: var(--content-max-width);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

@media (max-width: 1024px) {
  .sidebar {
    width: 248px;
  }

  .topbar,
  .main-content {
    padding-left: 12px;
    padding-right: 12px;
  }
}

@media (max-width: 768px) {
  .sidebar {
    width: 220px;
  }

  .main-content {
    padding-left: max(10px, env(safe-area-inset-left));
    padding-right: max(10px, env(safe-area-inset-right));
  }

  .topbar-user-name {
    display: none;
  }

  .topbar-est-clock {
    font-size: 0.72rem;
    padding: 3px 8px;
    max-width: min(52vw, 220px);
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .page-title {
    font-size: 0.96rem;
  }

  .brand-text strong {
    font-size: 0.8rem;
  }

  .brand-text span {
    font-size: 0.71rem;
  }

}

@media (max-width: 640px) {
  .main-layout {
    flex-direction: column;
  }

  .sidebar {
    width: 100%;
    max-height: 42vh;
  }

  .layout-content {
    min-height: 58vh;
  }
}
</style>
