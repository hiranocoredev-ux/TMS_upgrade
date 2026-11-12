/**
 * Canonical role model (5 roles)
 *
 * - SUPER_ADMIN: full system access (your “team boss” / platform owner)
 * - SYSTEM_ADMIN ("Admin"): everything a super admin can do except changing
 *   finance — finance is read-only for them (all teams). Cannot manage super
 *   admin / admin / finance manager accounts or the database backup.
 *   (Stored as SYSTEM_ADMIN because the legacy value "ADMIN" means group boss.)
 * - GROUP_BOSS: boss of one group (team lead within their group)
 * - GROUP_MEMBER: normal member within a group
 * - FINANCE_MANAGER: full control of Finance for every team (plus read-only
 *   Summarize); belongs to no group and is never listed as a team member
 *
 * Legacy values in DB (ADMIN, BOSS, MEMBER, GUEST, TEAM_BOSS degree, etc.)
 * are normalized via normalizeRole().
 */

export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  SYSTEM_ADMIN: 'SYSTEM_ADMIN',
  GROUP_BOSS: 'GROUP_BOSS',
  GROUP_MEMBER: 'GROUP_MEMBER',
  FINANCE_MANAGER: 'FINANCE_MANAGER',
};

/** Old role strings still encountered in tokens / DB */
export const LEGACY_ROLES = {
  ADMIN: 'ADMIN',
  BOSS: 'BOSS',
  MEMBER: 'MEMBER',
  GUEST: 'GUEST',
};

const ALL_CANONICAL = Object.values(ROLES);

/**
 * Map stored role (+ optional legacy degree) to a canonical role.
 * @param {string} [role]
 * @param {string} [degree] legacy User.degree when still present in DB
 */
export const normalizeRole = (role, degree) => {
  const r = role ? String(role) : '';
  const d = degree ? String(degree) : '';

  if (r === ROLES.SUPER_ADMIN) return ROLES.SUPER_ADMIN;
  if (r === ROLES.SYSTEM_ADMIN) return ROLES.SYSTEM_ADMIN;
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

/**
 * Roles that belong to no group and are never counted as team members
 * (member lists, dashboard cards, worktime, report reminders, competition).
 */
export const NON_MEMBER_ROLES = [ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMIN, ROLES.FINANCE_MANAGER];

/** Super admin and admin: full access outside finance. */
export const FULL_ADMIN_ROLES = [ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMIN];

/** Super-admin and admin may bypass ownership outside finance */
export const OVERRIDE_ROLES = FULL_ADMIN_ROLES;

/** Can manage users/groups / cross-cutting admin (not necessarily every module) */
export const PLATFORM_ADMIN_ROLES = FULL_ADMIN_ROLES;

/** Group-level leadership (old ADMIN/BOSS); admin counts as a leader too (finance writes exclude them separately). */
export const GROUP_LEADER_ROLES = [ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMIN, ROLES.GROUP_BOSS];

/** Strictly the super admin (finance writes, approvals, protected accounts, database). */
export const isSuperAdminRole = (role, degree) =>
  normalizeRole(role, degree) === ROLES.SUPER_ADMIN;

/** The "Admin" role: super admin minus finance changes. */
export const isSystemAdminRole = (role, degree) =>
  normalizeRole(role, degree) === ROLES.SYSTEM_ADMIN;

/** Super admin or admin: full access to everything that is not a finance change. */
export const isFullAdminRole = (role, degree) =>
  FULL_ADMIN_ROLES.includes(normalizeRole(role, degree));

export const isGroupBossRole = (role, degree) =>
  normalizeRole(role, degree) === ROLES.GROUP_BOSS;

export const isFinanceManagerRole = (role, degree) =>
  normalizeRole(role, degree) === ROLES.FINANCE_MANAGER;

/** Super admin, admin or finance manager: belongs to no group, not a team member. */
export const isNonMemberRole = (role, degree) =>
  NON_MEMBER_ROLES.includes(normalizeRole(role, degree));

/**
 * Manages finance for every team: the finance manager only. Super admin and
 * admin see all finance read-only; a group boss manages their own group's.
 */
export const canManageAllFinance = (role, degree) =>
  normalizeRole(role, degree) === ROLES.FINANCE_MANAGER;

/** Sees finance for every team: super admin, finance manager, or admin (read-only). */
export const canViewAllFinance = (role, degree) =>
  [ROLES.SUPER_ADMIN, ROLES.FINANCE_MANAGER, ROLES.SYSTEM_ADMIN].includes(normalizeRole(role, degree));

export const isGroupMemberRole = (role, degree) =>
  normalizeRole(role, degree) === ROLES.GROUP_MEMBER;

export const isValidRole = (role) =>
  ALL_CANONICAL.includes(role);

/**
 * "Admin" in legacy terms: super admin or group boss (team lead).
 * Used for module-level management within a group.
 */
export const isAdminRole = (role, degree) =>
  GROUP_LEADER_ROLES.includes(normalizeRole(role, degree));

/** Super admin and admin may bypass ownership / global rules (outside finance) */
export const canOverrideOwnership = (role, degree) =>
  isFullAdminRole(role, degree);

/** Can view team-level summaries (not necessarily unmasked PII) */
export const canViewTeamData = (role, degree) =>
  GROUP_LEADER_ROLES.includes(normalizeRole(role, degree));
