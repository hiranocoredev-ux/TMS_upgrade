/**
 * Client role constants  mirrors server `constants/roles.js` / API `user.role` (canonical).
 * Legacy stored values (ADMIN, BOSS, MEMBER, …) normalize via normalizeRole().
 */

export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  GROUP_BOSS: 'GROUP_BOSS',
  GROUP_MEMBER: 'GROUP_MEMBER',
  /** Full control of Finance for every team, read-only Summarize; no group. */
  FINANCE_MANAGER: 'FINANCE_MANAGER',
};

export const LEGACY_ROLES = {
  ADMIN: 'ADMIN',
  BOSS: 'BOSS',
  MEMBER: 'MEMBER',
  GUEST: 'GUEST',
};

const ALL_CANONICAL = Object.values(ROLES);

export const normalizeRole = (role, degree) => {
  const r = role ? String(role) : '';
  const d = degree ? String(degree) : '';

  if (r === ROLES.SUPER_ADMIN) return ROLES.SUPER_ADMIN;
  if (r === ROLES.GROUP_BOSS) return ROLES.GROUP_BOSS;
  if (r === ROLES.GROUP_MEMBER) return ROLES.GROUP_MEMBER;
  if (r === ROLES.FINANCE_MANAGER) return ROLES.FINANCE_MANAGER;

  // Legacy fallback only when canonical role is not explicitly set.
  if (d === 'TEAM_BOSS') return ROLES.SUPER_ADMIN;
  if (d === 'SUPER_ADMIN') return ROLES.SUPER_ADMIN;

  if (r === LEGACY_ROLES.ADMIN || r === LEGACY_ROLES.BOSS) return ROLES.GROUP_BOSS;

  if (
    r === LEGACY_ROLES.MEMBER ||
    r === LEGACY_ROLES.GUEST ||
    r === ''
  ) {
    return ROLES.GROUP_MEMBER;
  }

  if (ALL_CANONICAL.includes(r)) return r;
  return ROLES.GROUP_MEMBER;
};

export const OVERRIDE_ROLES = [ROLES.SUPER_ADMIN];

export const GROUP_LEADER_ROLES = [ROLES.SUPER_ADMIN, ROLES.GROUP_BOSS];

export const ADMIN_ROLES = GROUP_LEADER_ROLES;

export const TEAM_VIEW_ROLES = GROUP_LEADER_ROLES;

export const isAdminRole = (role, degree) =>
  GROUP_LEADER_ROLES.includes(normalizeRole(role, degree));

export const canOverrideOwnership = (role, degree) =>
  normalizeRole(role, degree) === ROLES.SUPER_ADMIN;

export const canViewTeamData = (role, degree) =>
  GROUP_LEADER_ROLES.includes(normalizeRole(role, degree));

export const isFinanceManagerRole = (role, degree) =>
  normalizeRole(role, degree) === ROLES.FINANCE_MANAGER;

/** Sees and manages finance for every team: super admin or finance manager. */
export const canManageAllFinance = (role, degree) =>
  [ROLES.SUPER_ADMIN, ROLES.FINANCE_MANAGER].includes(normalizeRole(role, degree));

/** Roles that belong to no group (no group picker in User Management). */
export const GROUPLESS_ROLES = [ROLES.SUPER_ADMIN, ROLES.FINANCE_MANAGER];

/**
 * Pages a finance manager may open: Finance, Summarize and their own profile.
 * Everything else sends them to Finance Overview.
 */
export const FINANCE_MANAGER_ROUTE_NAMES = new Set([
  'FinanceOverview',
  'MonthlyPlansView',
  'PeriodicPlansView',
  'WeeklyPlansManage',
  'PaymentRequests',
  'TransactionsView',
  'SummarizeWeekly',
  'SummarizeMonthly',
  'MyProfile',
  'Forbidden',
]);

export const getRoleDisplayName = (role, degree) => {
  const n = normalizeRole(role, degree);
  switch (n) {
    case ROLES.SUPER_ADMIN:
      return 'Super Admin';
    case ROLES.GROUP_BOSS:
      return 'Group Boss';
    case ROLES.GROUP_MEMBER:
      return 'Member';
    case ROLES.FINANCE_MANAGER:
      return 'Finance Manager';
    default:
      return role || 'Unknown';
  }
};

export const hasRole = (user, role) => {
  if (!user) return false;
  return normalizeRole(user.role, user.degree) === normalizeRole(role);
};

export const hasAnyRole = (user, roles) => {
  if (!user) return false;
  const userNorm = normalizeRole(user.role, user.degree);
  return roles.some((r) => normalizeRole(r) === userNorm);
};
