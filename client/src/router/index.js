import { createRouter, createWebHistory } from 'vue-router';
import store from '../store';
import { canAccessAdmin, canViewAuditLogs, hasAnyRole } from '../utils/permissions';
import {
  ROLES,
  LEGACY_ROLES,
  normalizeRole,
  isFinanceManagerRole,
  isFullAdminRole,
  FINANCE_MANAGER_ROUTE_NAMES,
} from '../constants/roles.js';

/**
 * Report RBAC is identical for daily, weekly, and monthly  only `reportPeriod` / URLs differ.
 * - Authors + personal history: group boss/member + legacy admin/member.
 * - Group team history: group boss + legacy boss/admin (not plain members).
 * - Cross-team “All … Reports”: super admin and Admin (SYSTEM_ADMIN).
 */
const REPORT_AUTHOR_AND_HISTORY_ROLES = [
  ROLES.GROUP_BOSS,
  ROLES.GROUP_MEMBER,
  LEGACY_ROLES.ADMIN,
  LEGACY_ROLES.MEMBER,
];

const REPORT_GROUP_TEAM_HISTORY_ROLES = [
  ROLES.GROUP_BOSS,
  LEGACY_ROLES.ADMIN,
  LEGACY_ROLES.BOSS,
];

const REPORT_SUPER_ADMIN_ALL_TEAMS_ROLES = [ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMIN];

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: () => import('../views/Login.vue'),
      meta: { requiresAuth: false, title: 'Login' }
    },
    {
      path: '/',
      component: () => import('../layouts/MainLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          redirect: '/dashboard'
        },
        {
          path: 'dashboard',
          name: 'Dashboard',
          component: () => import('../views/DashboardView.vue'),
          meta: { title: 'Dashboard' }
        },
        {
          path: 'user-management',
          name: 'UserManagement',
          component: () => import('../views/AdminUsers.vue'),
          meta: {
            title: 'User Management',
            requiresRole: ROLES.SUPER_ADMIN // BOSS for backward compatibility
          }
        },
        {
          path: 'user-management/group-tree',
          name: 'GroupTreeManagement',
          component: () => import('../views/GroupTreeManagement.vue'),
          meta: {
            title: 'Group Tree Management',
            requiresRole: ROLES.SUPER_ADMIN
          }
        },

        {
          path: 'dailyreports/dailyreport',
          name: 'dailyreport',
          component: () => import('../views/DailyReportView.vue'),
          meta: {
            title: 'Daily Report',
            reportPeriod: 'daily',
            documentKind: 'report',
            deniedForSuperAdmin: true,
            requiresRole: REPORT_AUTHOR_AND_HISTORY_ROLES,
          }
        },
        {
          path: 'dailyreports/weeklyreport',
          name: 'weeklyreport',
          component: () => import('../views/DailyReportView.vue'),
          meta: {
            title: 'Weekly Report',
            reportPeriod: 'weekly',
            documentKind: 'report',
            deniedForSuperAdmin: true,
            requiresRole: REPORT_AUTHOR_AND_HISTORY_ROLES,
          }
        },
        {
          path: 'dailyreports/monthlyreport',
          name: 'monthlyreport',
          component: () => import('../views/DailyReportView.vue'),
          meta: {
            title: 'Monthly Report',
            reportPeriod: 'monthly',
            documentKind: 'report',
            deniedForSuperAdmin: true,
            requiresRole: REPORT_AUTHOR_AND_HISTORY_ROLES,
          }
        },
        {
          path: 'dailyreports/dailyplan',
          name: 'dailyplan',
          component: () => import('../views/DailyReportView.vue'),
          meta: {
            title: 'Daily Plan',
            reportPeriod: 'daily',
            documentKind: 'plan',
            deniedForSuperAdmin: true,
            requiresRole: REPORT_AUTHOR_AND_HISTORY_ROLES,
          }
        },
        {
          path: 'dailyreports/weeklyplan',
          name: 'weeklyplan',
          component: () => import('../views/DailyReportView.vue'),
          meta: {
            title: 'Weekly Plan',
            reportPeriod: 'weekly',
            documentKind: 'plan',
            deniedForSuperAdmin: true,
            requiresRole: REPORT_AUTHOR_AND_HISTORY_ROLES,
          }
        },
        {
          path: 'dailyreports/monthlyplan',
          name: 'monthlyplan',
          component: () => import('../views/DailyReportView.vue'),
          meta: {
            title: 'Monthly Plan',
            reportPeriod: 'monthly',
            documentKind: 'plan',
            deniedForSuperAdmin: true,
            requiresRole: REPORT_AUTHOR_AND_HISTORY_ROLES,
          }
        },

        {
          path: 'dailyreports/reportHistory',
          name: 'reportHistory',
          component: () => import('../views/ReportHistoryView.vue'),
          meta: {
            title: 'Daily Report History',
            reportPeriod: 'daily',
            documentKind: 'report',
            deniedForSuperAdmin: true,
            requiresRole: REPORT_AUTHOR_AND_HISTORY_ROLES,
          }
        },
        {
          path: 'dailyreports/weeklyReportHistory',
          name: 'weeklyReportHistory',
          component: () => import('../views/ReportHistoryView.vue'),
          meta: {
            title: 'Weekly Report History',
            reportPeriod: 'weekly',
            documentKind: 'report',
            deniedForSuperAdmin: true,
            requiresRole: REPORT_AUTHOR_AND_HISTORY_ROLES,
          }
        },
        {
          path: 'dailyreports/monthlyReportHistory',
          name: 'monthlyReportHistory',
          component: () => import('../views/ReportHistoryView.vue'),
          meta: {
            title: 'Monthly Report History',
            reportPeriod: 'monthly',
            documentKind: 'report',
            deniedForSuperAdmin: true,
            requiresRole: REPORT_AUTHOR_AND_HISTORY_ROLES,
          }
        },
        {
          path: 'dailyreports/planHistory',
          name: 'planHistory',
          component: () => import('../views/ReportHistoryView.vue'),
          meta: {
            title: 'Daily Plan History',
            reportPeriod: 'daily',
            documentKind: 'plan',
            deniedForSuperAdmin: true,
            requiresRole: REPORT_AUTHOR_AND_HISTORY_ROLES,
          }
        },
        {
          path: 'dailyreports/weeklyPlanHistory',
          name: 'weeklyPlanHistory',
          component: () => import('../views/ReportHistoryView.vue'),
          meta: {
            title: 'Weekly Plan History',
            reportPeriod: 'weekly',
            documentKind: 'plan',
            deniedForSuperAdmin: true,
            requiresRole: REPORT_AUTHOR_AND_HISTORY_ROLES,
          }
        },
        {
          path: 'dailyreports/monthlyPlanHistory',
          name: 'monthlyPlanHistory',
          component: () => import('../views/ReportHistoryView.vue'),
          meta: {
            title: 'Monthly Plan History',
            reportPeriod: 'monthly',
            documentKind: 'plan',
            deniedForSuperAdmin: true,
            requiresRole: REPORT_AUTHOR_AND_HISTORY_ROLES,
          }
        },

        {
          path: 'dailyreports/groupReportHistory',
          name: 'groupReportHistory',
          component: () => import('../views/GroupReportHistory.vue'),
          meta: {
            title: 'Group Report History',
            reportPeriod: 'daily',
            documentKind: 'report',
            deniedForSuperAdmin: true,
            requiresRole: REPORT_GROUP_TEAM_HISTORY_ROLES,
          }
        },
        {
          path: 'dailyreports/groupWeeklyReportHistory',
          name: 'groupWeeklyReportHistory',
          component: () => import('../views/GroupReportHistory.vue'),
          meta: {
            title: 'Group Weekly Report History',
            reportPeriod: 'weekly',
            documentKind: 'report',
            deniedForSuperAdmin: true,
            requiresRole: REPORT_GROUP_TEAM_HISTORY_ROLES,
          }
        },
        {
          path: 'dailyreports/groupMonthlyReportHistory',
          name: 'groupMonthlyReportHistory',
          component: () => import('../views/GroupReportHistory.vue'),
          meta: {
            title: 'Group Monthly Report History',
            reportPeriod: 'monthly',
            documentKind: 'report',
            deniedForSuperAdmin: true,
            requiresRole: REPORT_GROUP_TEAM_HISTORY_ROLES,
          }
        },
        {
          path: 'dailyreports/groupPlanHistory',
          name: 'groupPlanHistory',
          component: () => import('../views/GroupReportHistory.vue'),
          meta: {
            title: 'Group Daily Plan History',
            reportPeriod: 'daily',
            documentKind: 'plan',
            deniedForSuperAdmin: true,
            requiresRole: REPORT_GROUP_TEAM_HISTORY_ROLES,
          }
        },
        {
          path: 'dailyreports/groupWeeklyPlanHistory',
          name: 'groupWeeklyPlanHistory',
          component: () => import('../views/GroupReportHistory.vue'),
          meta: {
            title: 'Group Weekly Plan History',
            reportPeriod: 'weekly',
            documentKind: 'plan',
            deniedForSuperAdmin: true,
            requiresRole: REPORT_GROUP_TEAM_HISTORY_ROLES,
          }
        },
        {
          path: 'dailyreports/groupMonthlyPlanHistory',
          name: 'groupMonthlyPlanHistory',
          component: () => import('../views/GroupReportHistory.vue'),
          meta: {
            title: 'Group Monthly Plan History',
            reportPeriod: 'monthly',
            documentKind: 'plan',
            deniedForSuperAdmin: true,
            requiresRole: REPORT_GROUP_TEAM_HISTORY_ROLES,
          }
        },

        {
          path: 'dailyreports/all',
          name: 'all',
          component: () => import('../views/AllGroupReportHistory.vue'),
          meta: {
            title: 'All of my Team',
            reportPeriod: 'daily',
            documentKind: 'report',
            requiresRole: REPORT_SUPER_ADMIN_ALL_TEAMS_ROLES,
            superAdminTeamsReview: true,
          }
        },
        {
          path: 'dailyreports/all-weekly',
          name: 'allWeekly',
          component: () => import('../views/AllGroupReportHistory.vue'),
          meta: {
            title: 'All Weekly Reports',
            reportPeriod: 'weekly',
            documentKind: 'report',
            requiresRole: REPORT_SUPER_ADMIN_ALL_TEAMS_ROLES,
            superAdminTeamsReview: true,
          }
        },
        {
          path: 'dailyreports/all-monthly',
          name: 'allMonthly',
          component: () => import('../views/AllGroupReportHistory.vue'),
          meta: {
            title: 'All Monthly Reports',
            reportPeriod: 'monthly',
            documentKind: 'report',
            requiresRole: REPORT_SUPER_ADMIN_ALL_TEAMS_ROLES,
            superAdminTeamsReview: true,
          }
        },
        {
          path: 'dailyreports/all-plans',
          name: 'allPlans',
          component: () => import('../views/AllGroupReportHistory.vue'),
          meta: {
            title: 'All Daily Plans',
            reportPeriod: 'daily',
            documentKind: 'plan',
            requiresRole: REPORT_SUPER_ADMIN_ALL_TEAMS_ROLES,
            superAdminTeamsReview: true,
          }
        },
        {
          path: 'dailyreports/all-plans-weekly',
          name: 'allPlansWeekly',
          component: () => import('../views/AllGroupReportHistory.vue'),
          meta: {
            title: 'All Weekly Plans',
            reportPeriod: 'weekly',
            documentKind: 'plan',
            requiresRole: REPORT_SUPER_ADMIN_ALL_TEAMS_ROLES,
            superAdminTeamsReview: true,
          }
        },
        {
          path: 'dailyreports/all-plans-monthly',
          name: 'allPlansMonthly',
          component: () => import('../views/AllGroupReportHistory.vue'),
          meta: {
            title: 'All Monthly Plans',
            reportPeriod: 'monthly',
            documentKind: 'plan',
            requiresRole: REPORT_SUPER_ADMIN_ALL_TEAMS_ROLES,
            superAdminTeamsReview: true,
          }
        },
        {
          path: 'dailyreports/plan-ticket-templates',
          redirect: { name: 'planTicketTemplatesDaily' }
        },
        {
          path: 'dailyreports/plan-tickets/daily',
          name: 'planTicketTemplatesDaily',
          component: () => import('../views/PlanTicketTemplatesView.vue'),
          meta: {
            title: 'Daily Plan Ticket Templates',
            reportPeriod: 'daily',
            requiresRole: ROLES.SUPER_ADMIN
          }
        },
        {
          path: 'dailyreports/plan-tickets/weekly',
          name: 'planTicketTemplatesWeekly',
          component: () => import('../views/PlanTicketTemplatesView.vue'),
          meta: {
            title: 'Weekly Plan Ticket Templates',
            reportPeriod: 'weekly',
            requiresRole: ROLES.SUPER_ADMIN
          }
        },
        {
          path: 'dailyreports/plan-tickets/monthly',
          name: 'planTicketTemplatesMonthly',
          component: () => import('../views/PlanTicketTemplatesView.vue'),
          meta: {
            title: 'Monthly Plan Ticket Templates',
            reportPeriod: 'monthly',
            requiresRole: ROLES.SUPER_ADMIN
          }
        },




        {
          path: 'profiles',
          redirect: { name: 'CitizenProfiles' }
        },
        {
          path: 'profiles/citizens',
          name: 'CitizenProfiles',
          component: () => import('../views/profiles/CitizenProfilesView.vue'),
          meta: { title: 'Citizen Profiles' }
        },
        {
          path: 'profiles/citizens/:id',
          name: 'CitizenProfileDetail',
          component: () => import('../views/profiles/CitizenProfileDetailView.vue'),
          meta: { title: 'Citizen Profile' }
        },
        {
          path: 'profiles/members',
          name: 'MemberProfiles',
          component: () => import('../views/profiles/MemberProfilesView.vue'),
          meta: { title: "Member's Summarize" }
        },
        {
          path: 'interview-boards',
          name: 'InterviewBoardsList',
          component: () => import('../views/InterviewBoardsList.vue'),
          meta: { title: 'Interview Boards' }
        },
        {
          path: 'interview-boards/:id',
          name: 'InterviewBoardView',
          component: () => import('../views/InterviewBoardView.vue'),
          meta: { title: 'Interview Board' }
        },
        {
          path: 'project-job-management',
          name: 'ProjectJobManagement',
          component: () => import('../views/Kanban.vue'),
          meta: { title: 'Project & Task & Job Management' }
        },
        {
          path: 'projects',
          name: 'Projects',
          component: () => import('../views/Projects.vue'),
          meta: { title: 'Projects' }
        },
        {
          path: 'projects/:id',
          name: 'ProjectDetail',
          component: () => import('../views/ProjectDetail.vue'),
          meta: { title: 'Project Detail' }
        },
        /* ===============================
   * Assignments (CORE FEATURE)
   * =============================== */
        {
          path: 'assignments',
          name: 'Assignments',
          component: () => import('../views/assignments/AssignmentsList.vue'),
          meta: { title: 'Assignments' },
        },
        {
          path: 'assignments/new',
          name: 'AssignmentCreate',
          component: () => import('../views/assignments/AssignmentCreate.vue'),
          meta: { title: 'Create Assignment' }
        },
        {
          path: 'assignments/:id',
          name: 'AssignmentDetail',
          component: () => import('../views/assignments/AssignmentDetail.vue'),
          meta: { title: 'Assignment Detail' }
        },
        /* =========================
           FINANCE (NEW STRUCTURE)
        ========================== */
        {
          path: 'finance/overview',
          name: 'FinanceOverview',
          component: () => import('../views/FinanceOverview.vue'),
          meta: {
            title: 'Finance Overview',
          }
        },
        {
          path: 'finance/monthly-plans',
          name: 'MonthlyPlansView',
          component: () => import('../views/MonthlyPlansView.vue'),
          meta: { title: 'Monthly Plans' }
        },
        {
          path: 'finance/periodic-plans',
          name: 'PeriodicPlansView',
          component: () => import('../views/PeriodicPlansView.vue'),
          meta: { title: 'Weekly Plans' }
        },
        {
          path: 'finance/periodic-plans/manage',
          name: 'WeeklyPlansManage',
          component: () => import('../views/WeeklyPlansManageView.vue'),
          meta: { title: 'Manage weeks & plans' }
        },
        {
          path: 'finance/payment-requests',
          name: 'PaymentRequests',
          component: () => import('../views/PaymentRequestsView.vue'),
          meta: { title: 'Payment requests' },
        },
        {
          path: 'finance/transactions',
          name: 'TransactionsView',
          component: () => import('../views/TransactionsView.vue'),
          meta: { title: 'Transactions' }
        },
        /* =========================
           SUMMARIZE
        ========================== */
        {
          path: 'summarize',
          redirect: { name: 'SummarizeWeekly' }
        },
        {
          path: 'summarize/weekly',
          name: 'SummarizeWeekly',
          component: () => import('../views/SummarizeView.vue'),
          meta: { title: 'Weekly Summarize', summarizeMode: 'week' }
        },
        {
          path: 'summarize/monthly',
          name: 'SummarizeMonthly',
          component: () => import('../views/SummarizeView.vue'),
          meta: { title: 'Monthly Summarize', summarizeMode: 'month' }
        },
        {
          path: 'kanban',
          redirect: '/project-job-management'
        },
        {
          path: 'freelancer-accounts',
          redirect: '/profile-management'
        },
        {
          path: 'personal-profile',
          redirect: '/profile-management'
        },
        {
          path: 'projects',
          redirect: '/project-job-management'
        },
        {
          path: 'admin/users',
          redirect: '/user-management'
        },
        {
          path: 'admin/audit-logs',
          name: 'AuditLogs',
          component: () => import('../views/AuditLogs.vue'),
          meta: {
            title: 'Audit Logs',
            requiresRole: [ROLES.SUPER_ADMIN, ROLES.GROUP_BOSS, LEGACY_ROLES.ADMIN, LEGACY_ROLES.BOSS]
          }
        },
        {
          path: 'admin/database',
          name: 'DatabaseManagement',
          component: () => import('../views/DatabaseManagement.vue'),
          meta: {
            title: 'Database Management',
            // Super admin only among the full admins: the Admin (SYSTEM_ADMIN) role is denied.
            deniedForSystemAdmin: true,
            requiresRole: [ROLES.SUPER_ADMIN, ROLES.GROUP_BOSS, LEGACY_ROLES.ADMIN, LEGACY_ROLES.BOSS]
          }
        },
        {
          path: 'hubstaff',
          name: 'Hubstaff',
          component: () => import('../views/HubstaffView.vue'),
          meta: { title: 'Time & Activity' }
        },
        {
          path: 'workflow',
          name: 'Workflow',
          redirect: '/workflow/graph'
        },
        {
          path: 'workflow/graph',
          name: 'WorkflowGraph',
          component: () => import('../views/WorkflowView.vue'),
          meta: { title: 'Worktime Summarize' }
        },
        {
          path: 'workflow/settings',
          name: 'WorkflowSettings',
          component: () => import('../views/WorkflowSettingsView.vue'),
          meta: { title: 'WorkTime Settings' }
        },
        {
          path: 'competition',
          name: 'CompetitionDashboard',
          component: () => import('../views/competition/CompetitionDashboard.vue'),
          meta: { title: 'Monthly competition' }
        },
        {
          path: 'competition/rules',
          name: 'CompetitionRules',
          component: () => import('../views/competition/CompetitionRulesView.vue'),
          meta: { title: 'Competition rules' }
        },
        {
          path: 'competition/history',
          name: 'CompetitionHistory',
          component: () => import('../views/competition/CompetitionHistoryView.vue'),
          meta: { title: 'Competition history' }
        },
        {
          path: 'competition/detail',
          name: 'CompetitionDetail',
          component: () => import('../views/competition/CompetitionDetail.vue'),
          meta: { title: 'Competition detail' }
        },
        {
          path: 'my-profile',
          name: 'MyProfile',
          component: () => import('../views/MyProfileView.vue'),
          meta: { title: 'My Profile' }
        },
        {
          path: 'notifications',
          name: 'NotificationSettings',
          component: () => import('../views/NotificationSettingsView.vue'),
          meta: { title: 'Notify Settings' }
        },
        {
          path: 'send-message',
          name: 'SendMessage',
          component: () => import('../views/SendMessageView.vue'),
          meta: { title: 'Send Message' }
        },
        {
          path: 'forbidden',
          name: 'Forbidden',
          component: () => import('../views/Forbidden.vue'),
          meta: { title: 'Access Forbidden' }
        }
      ]
    }
  ]
});

// Route guard - requireAuth
router.beforeEach((to, from, next) => {
  const hasToken = !!localStorage.getItem('token');
  const hasUser = !!localStorage.getItem('user');
  const isAuthenticated = hasToken && hasUser;

  if (!store.getters['auth/isAuthenticated'] && isAuthenticated) {
    store.dispatch('auth/restoreAuth');
  }

  // Check if route requires authentication - use localStorage check for immediate response
  if (to.meta.requiresAuth !== false && !isAuthenticated) {
    next('/login');
    return;
  }

  // Finance manager: only Dashboard, Finance, Summarize and their own profile.
  // Anything else goes to Finance Overview.
  if (isAuthenticated && to.meta.requiresAuth !== false) {
    let fmUser = store.state.auth.user;
    if (!fmUser && hasUser) {
      try {
        fmUser = JSON.parse(localStorage.getItem('user'));
      } catch {
        /* ignore */
      }
    }
    if (fmUser && isFinanceManagerRole(fmUser.role, fmUser.degree) && !FINANCE_MANAGER_ROUTE_NAMES.has(to.name)) {
      next({ name: 'FinanceOverview', replace: true });
      return;
    }
  }

  // Super admin / Admin: blocked from author/group-team routes for daily, weekly, and monthly (redirect to matching "All …" page).
  if (to.meta.deniedForSuperAdmin && isAuthenticated) {
    let user = store.state.auth.user;
    if (!user && hasUser) {
      try {
        user = JSON.parse(localStorage.getItem('user'));
      } catch {
        /* ignore */
      }
    }
    if (user && isFullAdminRole(user.role, user.degree)) {
      const period = to.meta.reportPeriod || 'daily';
      const isPlan = to.meta.documentKind === 'plan';
      const byPeriodReport = { daily: 'all', weekly: 'allWeekly', monthly: 'allMonthly' };
      const byPeriodPlan = { daily: 'allPlans', weekly: 'allPlansWeekly', monthly: 'allPlansMonthly' };
      const map = isPlan ? byPeriodPlan : byPeriodReport;
      const target = map[period] || (isPlan ? 'allPlans' : 'all');
      next({ name: target, replace: true });
      return;
    }
  }

  // Check if route requires specific role (with normalization for BOSS → ADMIN)
  if (to.meta.requiresRole) {
    const requiredRoles = Array.isArray(to.meta.requiresRole)
      ? to.meta.requiresRole
      : [to.meta.requiresRole];

    // Get user from store or localStorage
    let user = store.state.auth.user;
    if (!user && hasUser) {
      try {
        user = JSON.parse(localStorage.getItem('user'));
      } catch (e) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        next('/login');
        return;
      }
    }

    // SUPER_ADMIN bypasses all role checks; Admin (SYSTEM_ADMIN) too, except routes flagged deniedForSystemAdmin.
    if (!user) {
      next('/forbidden');
      return;
    }
    const role = normalizeRole(user.role, user.degree);
    if (role === ROLES.SYSTEM_ADMIN && to.meta.deniedForSystemAdmin) {
      next('/forbidden');
      return;
    }
    if (!isFullAdminRole(user.role, user.degree) && !hasAnyRole(user, requiredRoles)) {
      next('/forbidden');
      return;
    }
  }

  // Redirect authenticated users away from login page
  // But allow navigation to login if explicitly navigating there (e.g., during logout)
  if (to.path === '/login' && isAuthenticated && from.path !== '/login') {
    next('/');
    return;
  }

  next();
});
// router.beforeEach((to) => {
//   const auth = useAuthStore();

//   if (to.meta.requiresAuth && !auth.isAuthenticated) {
//     return '/login';
//   }

//   if (to.meta.requiresAdmin && auth.user?.role !== 'ADMIN') {
//     return '/';
//   }
// });

export default router;
